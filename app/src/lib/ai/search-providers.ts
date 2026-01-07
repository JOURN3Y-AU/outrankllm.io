/**
 * Search-Enabled Query Providers
 * Executes queries with web search capabilities for each AI platform
 *
 * Uses DIRECT API calls with native web search for visibility queries:
 * - OpenAI: web_search_preview tool for real-time search
 * - Claude: Native web search tool (with Tavily fallback)
 * - Gemini: Google Search grounding
 *
 * Uses Vercel AI Gateway for auxiliary tasks (competitor extraction)
 */

import { generateText, createGateway } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createPerplexity } from '@ai-sdk/perplexity'
import { trackCost } from './costs'
import { log } from '@/lib/logger'

// Initialize Vercel AI Gateway (for auxiliary tasks only)
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

// Initialize direct API clients for native web search
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '',
})

const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
})

export type SearchPlatform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export interface SearchSource {
  url: string
  title: string
  snippet?: string
}

export interface SearchQueryResult {
  platform: SearchPlatform
  query: string
  response: string
  sources: SearchSource[]
  searchEnabled: boolean
  domainMentioned: boolean
  mentionPosition: number | null // 1, 2, or 3 (thirds of response)
  competitorsMentioned: { name: string; context: string }[]
  responseTimeMs: number
  error?: string
}

/**
 * Location context for search queries - passed from the business analysis
 */
export interface LocationContext {
  location?: string      // Full location string: "Sydney, Australia"
  city?: string          // City name: "Sydney"
  country?: string       // Country name: "Australia"
  countryCode?: string   // ISO country code: "AU"
}

const SYSTEM_PROMPT = `You are a helpful assistant providing information based on current web search results. When users ask for recommendations or information about businesses and services:
- Be specific and mention actual company/business names when your search results include them
- Include location context when relevant
- Cite your sources when possible
- Be objective and balanced in your recommendations`

const COMPETITOR_EXTRACTION_PROMPT = `Extract company/business names mentioned in this AI response. Only extract actual company names, NOT:
- Generic terms (e.g., "AI consulting firms", "marketing agencies")
- Locations (cities, countries, regions)
- Common nouns or phrases
- The target domain being searched for

Target domain to EXCLUDE: {domain}

AI Response:
{response}

Return a JSON array of company names found. If no specific companies are mentioned, return an empty array.
Example: ["Accenture", "Deloitte", "PwC"]
Return ONLY the JSON array, nothing else.`

/**
 * Extract competitor mentions from response using AI
 */
async function extractCompetitorsFromResponse(
  response: string,
  domain: string,
  runId: string
): Promise<{ name: string; context: string }[]> {
  // Skip extraction if response is too short or empty
  if (!response || response.length < 50) {
    return []
  }

  try {
    const prompt = COMPETITOR_EXTRACTION_PROMPT
      .replace('{domain}', domain)
      .replace('{response}', response.slice(0, 2000))

    const result = await generateText({
      model: gateway('openai/gpt-4o-mini'),
      prompt,
      maxOutputTokens: 200,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'competitors_search',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse JSON response
    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return []
    }

    const names = JSON.parse(jsonMatch[0]) as string[]

    // Filter out the target domain and return with context
    const domainBase = domain.toLowerCase().split('.')[0]
    return names
      .filter(name => !name.toLowerCase().includes(domainBase))
      .slice(0, 5)
      .map(name => {
        const index = response.toLowerCase().indexOf(name.toLowerCase())
        if (index !== -1) {
          const start = Math.max(0, index - 30)
          const end = Math.min(response.length, index + name.length + 30)
          const context = response.substring(start, end).trim()
          return { name, context: `...${context}...` }
        }
        return { name, context: '' }
      })
  } catch (error) {
    console.error('Error extracting competitors:', error)
    return []
  }
}

/**
 * Query OpenAI with o4-mini reasoning model and web_search tool
 * Uses direct API for real-time web search with agentic multi-step reasoning
 * o4-mini is better at deciding when to search again and synthesizing results
 */
async function queryOpenAIWithSearch(
  query: string,
  domain: string,
  runId: string,
  locationContext?: LocationContext,
  retryCount = 0
): Promise<SearchQueryResult> {
  const startTime = Date.now()
  const platform: SearchPlatform = 'chatgpt'
  const MAX_RETRIES = 2

  try {
    // Extract location from query for better search targeting
    // Map common locations to country codes and cities
    const locationMap: Record<string, { country: string; city?: string; region?: string }> = {
      'sydney': { country: 'AU', city: 'Sydney', region: 'New South Wales' },
      'melbourne': { country: 'AU', city: 'Melbourne', region: 'Victoria' },
      'brisbane': { country: 'AU', city: 'Brisbane', region: 'Queensland' },
      'perth': { country: 'AU', city: 'Perth', region: 'Western Australia' },
      'adelaide': { country: 'AU', city: 'Adelaide', region: 'South Australia' },
      'gold coast': { country: 'AU', city: 'Gold Coast', region: 'Queensland' },
      'canberra': { country: 'AU', city: 'Canberra', region: 'Australian Capital Territory' },
      'australia': { country: 'AU' },
      'new york': { country: 'US', city: 'New York', region: 'New York' },
      'los angeles': { country: 'US', city: 'Los Angeles', region: 'California' },
      'london': { country: 'GB', city: 'London' },
    }

    const queryLower = query.toLowerCase()
    let detectedLocation: { country: string; city?: string; region?: string } | null = null
    for (const [loc, info] of Object.entries(locationMap)) {
      if (queryLower.includes(loc)) {
        detectedLocation = info
        break
      }
    }

    // Fall back to business location context if no location detected in query
    // This ensures queries like "best AI solutions near me" use the business's location
    if (!detectedLocation && locationContext?.countryCode) {
      detectedLocation = {
        country: locationContext.countryCode,
        city: locationContext.city,
      }
    }

    // Use OpenAI Responses API with o4-mini reasoning model and web_search tool
    // o4-mini provides agentic multi-step search for more comprehensive results
    // Using 'high' context size for more search coverage
    const result = await generateText({
      model: openai.responses('o4-mini'),
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: 'high',
          userLocation: {
            type: 'approximate',
            // Set country/city/region based on detected location in query or business context
            ...(detectedLocation?.country && { country: detectedLocation.country }),
            ...(detectedLocation?.city && { city: detectedLocation.city }),
            ...(detectedLocation?.region && { region: detectedLocation.region }),
          },
        }),
      },
      system: SYSTEM_PROMPT,
      prompt: query,
      maxOutputTokens: 2000,
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Check for empty response (API succeeded but returned nothing)
    if (!responseText || responseText.trim() === '') {
      if (retryCount < MAX_RETRIES) {
        log.warn(runId, `ChatGPT empty response, retrying (${retryCount + 1}/${MAX_RETRIES}): "${query.slice(0, 40)}..."`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
        return queryOpenAIWithSearch(query, domain, runId, locationContext, retryCount + 1)
      }
      log.error(runId, `ChatGPT returned empty after ${MAX_RETRIES} retries: "${query.slice(0, 50)}..."`)
      return {
        platform,
        query,
        response: '',
        sources: [],
        searchEnabled: true,
        domainMentioned: false,
        mentionPosition: null,
        competitorsMentioned: [],
        responseTimeMs,
        error: 'Empty response from API after retries',
      }
    }

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `search_${platform}`,
        model: 'openai/o4-mini-search',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Extract sources from provider metadata
    const sources: SearchSource[] = []
    const providerMeta = result.providerMetadata as Record<string, unknown> | undefined
    if (providerMeta?.openai) {
      const openaiMeta = providerMeta.openai as Record<string, unknown>
      // Check for annotations with URL citations
      if (Array.isArray(openaiMeta.annotations)) {
        for (const annotation of openaiMeta.annotations) {
          if (annotation && typeof annotation === 'object') {
            const a = annotation as Record<string, unknown>
            if (a.type === 'url_citation' && a.url) {
              sources.push({
                url: String(a.url),
                title: String(a.title || ''),
                snippet: undefined,
              })
            }
          }
        }
      }
    }

    // Check if domain is mentioned
    const { mentioned, position } = checkDomainMention(responseText, domain)

    // Extract competitors
    const competitors = await extractCompetitorsFromResponse(responseText, domain, runId)

    log.platform(runId, 'ChatGPT', `✓ ${mentioned ? 'mentioned' : 'no mention'} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)

    return {
      platform,
      query,
      response: responseText,
      sources,
      searchEnabled: true,
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    log.error(runId, `ChatGPT query failed: "${query.slice(0, 50)}..."`, error)
    return {
      platform,
      query,
      response: '',
      sources: [],
      searchEnabled: false,
      domainMentioned: false,
      mentionPosition: null,
      competitorsMentioned: [],
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Query Claude with Tavily-based web search
 * Note: Native Claude web search is not yet available in the Vercel AI SDK
 * Using Tavily provides real-time search context for Claude responses
 */
async function queryClaudeWithSearch(
  query: string,
  domain: string,
  runId: string
): Promise<SearchQueryResult> {
  const startTime = Date.now()
  // Use Tavily for Claude's search capability until native support is added
  return queryClaudeWithTavily(query, domain, runId, startTime)
}

/**
 * Query Claude with Tavily search as fallback
 */
async function queryClaudeWithTavily(
  query: string,
  domain: string,
  runId: string,
  startTime: number
): Promise<SearchQueryResult> {
  const platform: SearchPlatform = 'claude'

  try {
    // First, search with Tavily
    const tavilyResults = await searchWithTavily(query)

    if (!tavilyResults.success) {
      throw new Error('Tavily search failed')
    }

    // Build context from Tavily results
    const searchContext = tavilyResults.results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
      .join('\n\n')

    // Query Claude with the search context via direct API
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: SYSTEM_PROMPT,
      prompt: `Based on these search results, answer the user's question.

SEARCH RESULTS:
${searchContext}

USER QUESTION: ${query}

Provide a helpful answer based on the search results. Mention specific businesses and sources when relevant.`,
      maxOutputTokens: 1500,
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Track cost (including Tavily cost estimate)
    if (result.usage) {
      await trackCost({
        runId,
        step: `search_${platform}_tavily`,
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    const { mentioned, position } = checkDomainMention(responseText, domain)

    // Extract competitors
    const competitors = await extractCompetitorsFromResponse(responseText, domain, runId)

    log.platform(runId, 'Claude', `✓ ${mentioned ? 'mentioned' : 'no mention'} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)

    return {
      platform,
      query,
      response: responseText,
      sources: tavilyResults.results,
      searchEnabled: true,
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    log.error(runId, `Claude query failed: "${query.slice(0, 50)}..."`, error)
    return {
      platform,
      query,
      response: '',
      sources: [],
      searchEnabled: false,
      domainMentioned: false,
      mentionPosition: null,
      competitorsMentioned: [],
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Search with Tavily API
 */
async function searchWithTavily(
  query: string
): Promise<{ success: boolean; results: SearchSource[] }> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    console.error('TAVILY_API_KEY not configured')
    return { success: false, results: [] }
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 5,
      }),
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = await response.json() as {
      results?: Array<{
        url?: string
        title?: string
        content?: string
      }>
    }

    const results: SearchSource[] = (data.results || []).map(r => ({
      url: r.url || '',
      title: r.title || '',
      snippet: r.content,
    }))

    return { success: true, results }
  } catch (error) {
    console.error('Tavily search error:', error)
    return { success: false, results: [] }
  }
}

/**
 * Query Gemini with Google Search grounding
 * Uses google_search tool for real-time web search
 * Falls back to Tavily if Google Search grounding fails (permission issues)
 */
async function queryGeminiWithSearch(
  query: string,
  domain: string,
  runId: string
): Promise<SearchQueryResult> {
  const startTime = Date.now()
  const platform: SearchPlatform = 'gemini'

  try {
    // Try Gemini with Google Search tool for grounding
    // Using gemini-2.5-flash for better search grounding support
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      system: SYSTEM_PROMPT,
      prompt: query,
      maxOutputTokens: 1500,
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `search_${platform}`,
        model: 'google/gemini-2.5-flash-grounded',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Extract grounding sources from provider metadata
    const sources: SearchSource[] = []
    const providerMeta = result.providerMetadata as Record<string, unknown> | undefined
    if (providerMeta?.google) {
      const googleMeta = providerMeta.google as Record<string, unknown>
      const groundingMeta = googleMeta.groundingMetadata as Record<string, unknown> | undefined
      if (groundingMeta?.groundingChunks && Array.isArray(groundingMeta.groundingChunks)) {
        for (const chunk of groundingMeta.groundingChunks) {
          if (chunk && typeof chunk === 'object') {
            const c = chunk as Record<string, unknown>
            const web = c.web as Record<string, unknown> | undefined
            if (web) {
              sources.push({
                url: String(web.uri || ''),
                title: String(web.title || ''),
              })
            }
          }
        }
      }
      // Also check for searchEntryPoint which contains rendered search results
      if (groundingMeta?.searchEntryPoint) {
        // Search grounding is active
      }
    }

    const { mentioned, position } = checkDomainMention(responseText, domain)

    // Extract competitors
    const competitors = await extractCompetitorsFromResponse(responseText, domain, runId)

    log.platform(runId, 'Gemini', `✓ ${mentioned ? 'mentioned' : 'no mention'} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)

    return {
      platform,
      query,
      response: responseText,
      sources,
      searchEnabled: true, // Search grounding is always enabled with this config
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    log.warn(runId, `Gemini Google Search failed, trying Tavily: "${query.slice(0, 40)}..."`)

    // Fallback to Tavily-based search for Gemini
    return queryGeminiWithTavily(query, domain, runId, startTime)
  }
}

/**
 * Query Gemini with Tavily search as fallback
 * Used when Google Search grounding is not available (permission issues)
 */
async function queryGeminiWithTavily(
  query: string,
  domain: string,
  runId: string,
  startTime: number
): Promise<SearchQueryResult> {
  const platform: SearchPlatform = 'gemini'

  try {
    // First, search with Tavily
    const tavilyResults = await searchWithTavily(query)

    if (!tavilyResults.success) {
      throw new Error('Tavily search failed')
    }

    // Build context from Tavily results
    const searchContext = tavilyResults.results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
      .join('\n\n')

    // Query Gemini with the search context via direct API
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt: `Based on these search results, answer the user's question.

SEARCH RESULTS:
${searchContext}

USER QUESTION: ${query}

Provide a helpful answer based on the search results. Mention specific businesses and sources when relevant.`,
      maxOutputTokens: 1500,
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Track cost (including Tavily cost estimate)
    if (result.usage) {
      await trackCost({
        runId,
        step: `search_${platform}_tavily`,
        model: 'google/gemini-2.5-flash',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    const { mentioned, position } = checkDomainMention(responseText, domain)

    // Extract competitors
    const competitors = await extractCompetitorsFromResponse(responseText, domain, runId)

    return {
      platform,
      query,
      response: responseText,
      sources: tavilyResults.results,
      searchEnabled: true,
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    log.error(runId, `Gemini query failed: "${query.slice(0, 50)}..."`, error)
    return {
      platform,
      query,
      response: '',
      sources: [],
      searchEnabled: false,
      domainMentioned: false,
      mentionPosition: null,
      competitorsMentioned: [],
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Query Perplexity with native search
 * Perplexity is search-native - it always uses web search
 * Using sonar-pro for best quality search results
 */
async function queryPerplexityWithSearch(
  query: string,
  domain: string,
  runId: string
): Promise<SearchQueryResult> {
  const startTime = Date.now()
  const platform: SearchPlatform = 'perplexity'

  try {
    const result = await generateText({
      model: perplexity('sonar-pro'),
      system: SYSTEM_PROMPT,
      prompt: query,
      maxOutputTokens: 1500,
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `search_${platform}`,
        model: 'perplexity/sonar-pro',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Extract sources from provider metadata
    const sources: SearchSource[] = []
    const providerMeta = result.providerMetadata as Record<string, unknown> | undefined
    if (providerMeta?.perplexity) {
      const perplexityMeta = providerMeta.perplexity as Record<string, unknown>
      // Check for citations array
      if (Array.isArray(perplexityMeta.citations)) {
        for (const citation of perplexityMeta.citations) {
          if (typeof citation === 'string') {
            sources.push({
              url: citation,
              title: '',
            })
          }
        }
      }
    }

    const { mentioned, position } = checkDomainMention(responseText, domain)

    // Extract competitors
    const competitors = await extractCompetitorsFromResponse(responseText, domain, runId)

    log.platform(runId, 'Perplexity', `✓ ${mentioned ? 'mentioned' : 'no mention'} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)

    return {
      platform,
      query,
      response: responseText,
      sources,
      searchEnabled: true, // Perplexity always uses search
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    log.error(runId, `Perplexity query failed: "${query.slice(0, 50)}..."`, error)
    return {
      platform,
      query,
      response: '',
      sources: [],
      searchEnabled: false,
      domainMentioned: false,
      mentionPosition: null,
      competitorsMentioned: [],
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if domain is mentioned in response and where
 */
function checkDomainMention(
  response: string,
  domain: string
): { mentioned: boolean; position: number | null } {
  const lowerResponse = response.toLowerCase()
  const lowerDomain = domain.toLowerCase()

  // Also check for domain without TLD
  const domainWithoutTld = lowerDomain.split('.')[0]

  const mentioned =
    lowerResponse.includes(lowerDomain) ||
    lowerResponse.includes(domainWithoutTld)

  if (!mentioned) {
    return { mentioned: false, position: null }
  }

  // Find first mention position
  let firstIndex = lowerResponse.indexOf(lowerDomain)
  if (firstIndex === -1) {
    firstIndex = lowerResponse.indexOf(domainWithoutTld)
  }

  // Calculate which third of the response
  const totalLength = response.length
  const relativePosition = firstIndex / totalLength

  let position: number
  if (relativePosition < 0.33) {
    position = 1 // First third
  } else if (relativePosition < 0.66) {
    position = 2 // Second third
  } else {
    position = 3 // Third third
  }

  return { mentioned: true, position }
}

/**
 * Query a single platform with search enabled
 */
export async function queryWithSearch(
  platform: SearchPlatform,
  query: string,
  domain: string,
  runId: string,
  locationContext?: LocationContext
): Promise<SearchQueryResult> {
  switch (platform) {
    case 'chatgpt':
      return queryOpenAIWithSearch(query, domain, runId, locationContext)
    case 'claude':
      return queryClaudeWithSearch(query, domain, runId)
    case 'gemini':
      return queryGeminiWithSearch(query, domain, runId)
    case 'perplexity':
      return queryPerplexityWithSearch(query, domain, runId)
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }
}

/**
 * Query all platforms with search enabled
 */
export async function queryAllPlatformsWithSearch(
  queries: Array<{ id: string; text: string; category?: string }>,
  domain: string,
  runId: string,
  onProgress?: (completed: number, total: number) => void,
  locationContext?: LocationContext
): Promise<Array<{ promptId: string; results: SearchQueryResult[] }>> {
  const platforms: SearchPlatform[] = ['chatgpt', 'claude', 'gemini', 'perplexity']
  const allResults: Array<{ promptId: string; results: SearchQueryResult[] }> = []
  const total = queries.length * platforms.length
  let completed = 0

  // Log all questions at the start
  log.questions(runId, 'AI Visibility Queries', queries.map(q => q.text))

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]

    // Log which question we're starting
    log.questionStart(runId, i, queries.length, query.text)

    // Query all platforms in parallel for each query
    const platformResults = await Promise.all(
      platforms.map(platform => queryWithSearch(platform, query.text, domain, runId, locationContext))
    )

    allResults.push({
      promptId: query.id,
      results: platformResults,
    })

    // Log question completion with platform results
    log.questionDone(runId, i, queries.length, platformResults.map(r => ({
      name: r.platform,
      mentioned: r.domainMentioned,
    })))

    completed += platforms.length
    onProgress?.(completed, total)

    // Small delay between queries to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return allResults
}

/**
 * Calculate visibility scores from search results
 */
export function calculateSearchVisibilityScore(
  results: Array<{ promptId: string; results: SearchQueryResult[] }>
): {
  overall: number
  byPlatform: Record<SearchPlatform, { score: number; mentioned: number; total: number }>
} {
  const platformStats: Record<SearchPlatform, { mentioned: number; total: number }> = {
    chatgpt: { mentioned: 0, total: 0 },
    claude: { mentioned: 0, total: 0 },
    gemini: { mentioned: 0, total: 0 },
    perplexity: { mentioned: 0, total: 0 },
  }

  for (const queryResult of results) {
    for (const result of queryResult.results) {
      platformStats[result.platform].total++
      if (result.domainMentioned) {
        platformStats[result.platform].mentioned++
      }
    }
  }

  const byPlatform: Record<SearchPlatform, { score: number; mentioned: number; total: number }> = {
    chatgpt: {
      ...platformStats.chatgpt,
      score: platformStats.chatgpt.total > 0
        ? Math.round((platformStats.chatgpt.mentioned / platformStats.chatgpt.total) * 100)
        : 0,
    },
    claude: {
      ...platformStats.claude,
      score: platformStats.claude.total > 0
        ? Math.round((platformStats.claude.mentioned / platformStats.claude.total) * 100)
        : 0,
    },
    gemini: {
      ...platformStats.gemini,
      score: platformStats.gemini.total > 0
        ? Math.round((platformStats.gemini.mentioned / platformStats.gemini.total) * 100)
        : 0,
    },
    perplexity: {
      ...platformStats.perplexity,
      score: platformStats.perplexity.total > 0
        ? Math.round((platformStats.perplexity.mentioned / platformStats.perplexity.total) * 100)
        : 0,
    },
  }

  // Overall score
  const totalMentioned = Object.values(platformStats).reduce((sum, p) => sum + p.mentioned, 0)
  const totalQueries = Object.values(platformStats).reduce((sum, p) => sum + p.total, 0)
  const overall = totalQueries > 0 ? Math.round((totalMentioned / totalQueries) * 100) : 0

  return { overall, byPlatform }
}
