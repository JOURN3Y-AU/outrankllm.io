/**
 * Search-Enabled Query Providers
 * Executes queries with web search capabilities for each AI platform
 *
 * Uses DIRECT API calls (bypasses Vercel AI Gateway to avoid rate limits):
 * - OpenAI: web_search_preview tool for real-time search
 * - Claude: Tavily search + Claude for response
 * - Gemini: Google Search grounding
 * - Perplexity: Native search (sonar-pro)
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createPerplexity } from '@ai-sdk/perplexity'
import { trackCost } from './costs'
import { log } from '@/lib/logger'

// Initialize direct API clients (bypasses Vercel AI Gateway rate limits)
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

    // Use direct OpenAI API instead of Vercel AI Gateway to avoid rate limits
    const result = await generateText({
      model: openai('gpt-4o-mini'),
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
      maxOutputTokens: 4000, // Increased for web search responses which can be long
    })

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Log if response was truncated due to length limit
    if (result.finishReason === 'length') {
      log.warn(runId, `ChatGPT response truncated (hit token limit): "${query.slice(0, 40)}..."`)
    }

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
 *
 * Includes 60s per-request timeout and retry logic for transient failures
 * (connection resets, timeouts) since Perplexity's search can be slow.
 */
const PERPLEXITY_TIMEOUT_MS = 60_000 // 60s per query
const PERPLEXITY_MAX_RETRIES = 2

async function queryPerplexityWithSearch(
  query: string,
  domain: string,
  runId: string,
  retryCount: number = 0
): Promise<SearchQueryResult> {
  const startTime = Date.now()
  const platform: SearchPlatform = 'perplexity'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PERPLEXITY_TIMEOUT_MS)

    let result
    try {
      result = await generateText({
        model: perplexity('sonar-pro'),
        system: SYSTEM_PROMPT,
        prompt: query,
        maxOutputTokens: 1500,
        abortSignal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const responseTimeMs = Date.now() - startTime
    const responseText = result.text

    // Retry on empty response (same pattern as ChatGPT)
    if (!responseText || responseText.trim() === '') {
      if (retryCount < PERPLEXITY_MAX_RETRIES) {
        log.warn(runId, `Perplexity empty response, retrying (${retryCount + 1}/${PERPLEXITY_MAX_RETRIES}): "${query.slice(0, 40)}..."`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return queryPerplexityWithSearch(query, domain, runId, retryCount + 1)
      }
    }

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
    // Retry on transient errors (connection reset, timeout, abort)
    const isTransient = error instanceof Error && (
      error.message.includes('ECONNRESET') ||
      error.message.includes('socket hang up') ||
      error.message.includes('aborted') ||
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT') ||
      error.name === 'AbortError'
    )

    if (isTransient && retryCount < PERPLEXITY_MAX_RETRIES) {
      const backoffMs = 2000 * (retryCount + 1) // 2s, 4s
      log.warn(runId, `Perplexity transient error, retrying in ${backoffMs}ms (${retryCount + 1}/${PERPLEXITY_MAX_RETRIES}): ${error instanceof Error ? error.message : 'Unknown'}`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
      return queryPerplexityWithSearch(query, domain, runId, retryCount + 1)
    }

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
 * Generate possible spaced versions of a domain name
 * e.g., "loungelovers" -> ["lounge lovers"]
 * Uses a dictionary of common word endings to find split points
 */
function generateSpacedVersions(domainWithoutTld: string): string[] {
  const versions: string[] = []
  const lower = domainWithoutTld.toLowerCase()

  // Common word endings that might indicate a split point
  const commonEndings = [
    'lovers', 'works', 'labs', 'hub', 'hq', 'studio', 'studios',
    'shop', 'store', 'market', 'place', 'space', 'box', 'bay',
    'cloud', 'tech', 'soft', 'ware', 'app', 'apps', 'io', 'ly',
    'ify', 'able', 'er', 'ers', 'ing', 'tion', 'sion', 'ment',
    'ness', 'ful', 'less', 'ous', 'ive', 'al', 'ical', 'ology',
    'house', 'home', 'land', 'world', 'zone', 'spot', 'point',
    'direct', 'online', 'digital', 'media', 'group', 'team',
    'company', 'solutions', 'services', 'partners', 'consulting',
  ]

  // Common word beginnings
  const commonBeginnings = [
    'the', 'my', 'our', 'your', 'get', 'go', 'pro', 'super',
    'mega', 'ultra', 'smart', 'easy', 'fast', 'quick', 'best',
    'top', 'prime', 'first', 'new', 'big', 'little', 'red',
    'blue', 'green', 'black', 'white', 'gold', 'silver',
  ]

  // Try splitting at common endings
  for (const ending of commonEndings) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      const prefix = lower.slice(0, -ending.length)
      if (prefix.length >= 2) {
        versions.push(`${prefix} ${ending}`)
      }
    }
  }

  // Try splitting at common beginnings
  for (const beginning of commonBeginnings) {
    if (lower.startsWith(beginning) && lower.length > beginning.length + 2) {
      const suffix = lower.slice(beginning.length)
      if (suffix.length >= 2) {
        versions.push(`${beginning} ${suffix}`)

        // Recursively try splitting the suffix too
        // e.g., "therecruitmentcompany" -> "the" + "recruitmentcompany" -> "the recruitment company"
        for (const ending of commonEndings) {
          if (suffix.endsWith(ending) && suffix.length > ending.length + 2) {
            const middle = suffix.slice(0, -ending.length)
            if (middle.length >= 2) {
              versions.push(`${beginning} ${middle} ${ending}`)
            }
          }
        }
      }
    }
  }

  return versions
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

  // Check for brand name with spaces (e.g., "loungelovers" -> "lounge lovers")
  // Common patterns: camelCase separation, number separation
  const brandWithSpaces = domainWithoutTld
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
    .replace(/([a-zA-Z])(\d)/g, '$1 $2') // letters before numbers
    .replace(/(\d)([a-zA-Z])/g, '$1 $2') // numbers before letters
    .toLowerCase()

  // Also try inserting space between common word boundaries
  // e.g., "loungelovers" -> check for "lounge lovers"
  const possibleSpacedVersions = generateSpacedVersions(domainWithoutTld)

  const mentioned =
    lowerResponse.includes(lowerDomain) ||
    lowerResponse.includes(domainWithoutTld) ||
    (brandWithSpaces !== domainWithoutTld && lowerResponse.includes(brandWithSpaces)) ||
    possibleSpacedVersions.some(v => lowerResponse.includes(v))

  if (!mentioned) {
    return { mentioned: false, position: null }
  }

  // Find first mention position
  let firstIndex = lowerResponse.indexOf(lowerDomain)
  if (firstIndex === -1) {
    firstIndex = lowerResponse.indexOf(domainWithoutTld)
  }
  if (firstIndex === -1 && brandWithSpaces !== domainWithoutTld) {
    firstIndex = lowerResponse.indexOf(brandWithSpaces)
  }
  if (firstIndex === -1) {
    for (const v of possibleSpacedVersions) {
      const idx = lowerResponse.indexOf(v)
      if (idx !== -1) {
        firstIndex = idx
        break
      }
    }
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
 *
 * Strategy: Run all queries in parallel, grouped by platform to avoid rate limits.
 * This is much faster than sequential query-by-query execution.
 *
 * For 7 queries × 4 platforms:
 * - Old: ~7 × 60s (ChatGPT) = 7 minutes sequential
 * - New: ~60s (longest ChatGPT query) + small overhead = ~2-3 minutes parallel
 */
export async function queryAllPlatformsWithSearch(
  queries: Array<{ id: string; text: string; category?: string }>,
  domain: string,
  runId: string,
  onProgress?: (completed: number, total: number) => void,
  locationContext?: LocationContext
): Promise<Array<{ promptId: string; results: SearchQueryResult[] }>> {
  const platforms: SearchPlatform[] = ['chatgpt', 'claude', 'gemini', 'perplexity']
  const total = queries.length * platforms.length
  let completed = 0

  // Log all questions at the start
  log.questions(runId, 'AI Visibility Queries', queries.map(q => q.text))

  // Create all query-platform combinations
  const allTasks: Array<{
    queryIndex: number
    promptId: string
    queryText: string
    platform: SearchPlatform
  }> = []

  for (let i = 0; i < queries.length; i++) {
    for (const platform of platforms) {
      allTasks.push({
        queryIndex: i,
        promptId: queries[i].id,
        queryText: queries[i].text,
        platform,
      })
    }
  }

  // Run all tasks in parallel, but limit concurrency per platform to avoid rate limits
  // Group tasks by platform and run each platform's queries in parallel
  const platformTasks = new Map<SearchPlatform, typeof allTasks>()
  for (const task of allTasks) {
    if (!platformTasks.has(task.platform)) {
      platformTasks.set(task.platform, [])
    }
    platformTasks.get(task.platform)!.push(task)
  }

  // Execute all platforms in parallel, each platform runs its queries in parallel
  const platformPromises = Array.from(platformTasks.entries()).map(async ([_platform, tasks]) => {
    // Run all queries for this platform in parallel (API handles rate limits)
    const platformResults = await Promise.all(
      tasks.map(async (task) => {
        const result = await queryWithSearch(task.platform, task.queryText, domain, runId, locationContext)
        completed++
        onProgress?.(completed, total)
        return {
          promptId: task.promptId,
          queryIndex: task.queryIndex,
          result,
        }
      })
    )

    return platformResults
  })

  const allPlatformResults = await Promise.all(platformPromises)

  // Flatten and group results by promptId
  const resultsByPrompt = new Map<string, { promptId: string; queryIndex: number; results: SearchQueryResult[] }>()

  for (const platformResults of allPlatformResults) {
    for (const { promptId, queryIndex, result } of platformResults) {
      if (!resultsByPrompt.has(promptId)) {
        resultsByPrompt.set(promptId, { promptId, queryIndex, results: [] })
      }
      resultsByPrompt.get(promptId)!.results.push(result)
    }
  }

  // Convert to array and sort by original query order
  const allResults = Array.from(resultsByPrompt.values())
    .sort((a, b) => a.queryIndex - b.queryIndex)
    .map(({ promptId, results }) => ({ promptId, results }))

  // Log summary for each query
  for (let i = 0; i < allResults.length; i++) {
    const queryResult = allResults[i]
    log.questionDone(runId, i, queries.length, queryResult.results.map(r => ({
      name: r.platform,
      mentioned: r.domainMentioned,
    })))
  }

  return allResults
}

/**
 * Reach-Weighted Scoring System
 *
 * Points are assigned based on real-world AI traffic share:
 * - ChatGPT: ~80% of AI referral traffic → 10 points per mention
 * - Perplexity: ~12% of AI referral traffic → 4 points per mention
 * - Gemini: ~5% of AI referral traffic → 2 points per mention
 * - Claude: ~1% of AI referral traffic → 1 point per mention
 *
 * This means showing up in ChatGPT is worth 10x more than Claude,
 * reflecting the actual user reach of each platform.
 */
export const REACH_WEIGHTS: Record<SearchPlatform, number> = {
  chatgpt: 10,    // ~80% market share - highest impact
  perplexity: 4,  // ~12% market share - growing fast
  gemini: 2,      // ~5% market share
  claude: 1,      // ~1% market share - baseline
}

// Maximum possible points if mentioned by all platforms
export const MAX_REACH_POINTS = Object.values(REACH_WEIGHTS).reduce((sum, w) => sum + w, 0) // 17

/**
 * Calculate visibility scores from search results
 *
 * Uses reach-weighted scoring: platforms with more users are worth more points.
 * A 100% score means you're mentioned by all platforms on all queries.
 */
// Re-export types for easier imports
export type PlatformResult = SearchQueryResult

/**
 * Query a single platform with search enabled
 * Wrapper around queryWithSearch for cleaner imports
 */
export async function queryPlatformWithSearch(
  platform: SearchPlatform,
  query: string,
  domain: string,
  runId: string,
  locationContext?: LocationContext
): Promise<SearchQueryResult> {
  return queryWithSearch(platform, query, domain, runId, locationContext)
}

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

  // Calculate per-platform scores (percentage of queries where mentioned)
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

  // Reach-weighted overall score
  // Each platform's contribution = (mention rate 0-1) × reach weight
  // Normalized to 0-100 scale
  const reachWeightedSum =
    (byPlatform.chatgpt.score / 100) * REACH_WEIGHTS.chatgpt +
    (byPlatform.perplexity.score / 100) * REACH_WEIGHTS.perplexity +
    (byPlatform.gemini.score / 100) * REACH_WEIGHTS.gemini +
    (byPlatform.claude.score / 100) * REACH_WEIGHTS.claude

  const overall = Math.round((reachWeightedSum / MAX_REACH_POINTS) * 100)

  return { overall, byPlatform }
}
