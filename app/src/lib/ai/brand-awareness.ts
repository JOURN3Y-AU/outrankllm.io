/**
 * Brand Awareness Module
 * Tests what AI assistants actually know about a business
 * compared to what the website claims
 *
 * Uses grounded search (web search enabled) for more accurate results:
 * - ChatGPT: o4-mini with web_search tool
 * - Claude: Tavily search + Claude for response
 * - Gemini: Google Search grounding
 * - Perplexity: Native search (sonar-pro) - already grounded
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createPerplexity } from '@ai-sdk/perplexity'
import { trackCost, trackTavilyCost } from './costs'
import { log } from '@/lib/logger'
import type { BusinessAnalysis } from './analyze'

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

const BRAND_SYSTEM_PROMPT = `You are a helpful assistant providing information about businesses based on current web search results. When asked about a specific company:
- Share what you find about the business from your search
- Be specific about their services, products, and location
- If you can't find specific information, say so clearly
- Do not make up information about businesses you can't verify`

export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export interface BrandAwarenessQuery {
  type: 'brand_recall' | 'service_check' | 'competitor_compare'
  prompt: string
  testedEntity: string
  testedDomain?: string  // Domain URL for better recognition
  testedAttribute?: string
  comparedTo?: string
  /** For batch competitor queries - list of all competitors being compared */
  competitors?: string[]
  /** Whether this is a batch query that needs special parsing */
  isBatchQuery?: boolean
}

export interface BrandAwarenessResult {
  platform: Platform
  queryType: string
  testedEntity: string
  testedAttribute?: string
  recognized: boolean
  attributeMentioned: boolean
  responseText: string
  confidenceScore: number
  comparedTo?: string
  positioning?: 'stronger' | 'weaker' | 'equal' | 'not_compared'
  responseTimeMs: number
}

export interface BrandAwarenessAnalysis {
  overallRecognition: number // 0-100: % of platforms that recognize the brand
  serviceKnowledge: {
    service: string
    knownBy: Platform[]
    unknownBy: Platform[]
  }[]
  knowledgeGaps: string[] // Services no platform knows about
  competitorPositioning?: {
    competitor: string
    positioning: Record<Platform, string>
  }
}

/**
 * Generate brand awareness queries based on website analysis
 *
 * @param analysis - Business analysis data
 * @param domain - Business domain
 * @param competitors - Array of competitor names to compare against (batch mode)
 *                      If single string provided for backwards compat, wraps in array
 */
export function generateBrandAwarenessQueries(
  analysis: BusinessAnalysis,
  domain: string,
  competitors?: string | string[]
): BrandAwarenessQuery[] {
  const queries: BrandAwarenessQuery[] = []
  const businessName = analysis.businessName || domain

  // Build a combined identifier that includes both brand name and domain
  // This helps AI recognize the business even if it knows it by URL rather than name
  const brandIdentifier = analysis.businessName
    ? `${businessName} (${domain})`
    : domain

  // 1. Brand Recall Query - Does the AI know this business?
  // Include both the brand name and domain URL for better recognition
  queries.push({
    type: 'brand_recall',
    prompt: `What do you know about ${brandIdentifier}? What services do they offer and where are they located? Please include any information you have about their website at ${domain}.`,
    testedEntity: businessName,
    testedDomain: domain,
  })

  // 2. Service Check Queries - Top 3 services from analysis
  // Be very specific that we're asking if THIS BUSINESS offers THIS SERVICE
  // Not just whether the service exists in general
  const topServices = analysis.services.slice(0, 3)
  for (const service of topServices) {
    queries.push({
      type: 'service_check',
      prompt: `I found ${brandIdentifier} online. Based on your knowledge, does this specific company offer "${service}" as one of their services? I'm specifically asking about ${businessName} at ${domain}, not about ${service} in general.`,
      testedEntity: businessName,
      testedDomain: domain,
      testedAttribute: service,
    })
  }

  // 3. Competitor Comparison Queries - One query per competitor for reliability
  // Normalize input: string becomes single-item array, undefined becomes empty array
  const competitorList = competitors
    ? (typeof competitors === 'string' ? [competitors] : competitors)
    : []

  // Create a separate query for each competitor
  // This is more reliable than batch queries and produces cleaner, focused responses
  // Cost: ~$0.02 per competitor across all 4 platforms
  const locationClause = analysis.location ? ` in ${analysis.location}` : ''
  for (const competitor of competitorList) {
    queries.push({
      type: 'competitor_compare',
      prompt: `I'm choosing between ${businessName} and ${competitor} for ${analysis.businessType} services${locationClause}. Compare these two companies directly - what are the pros and cons of each? Which would you recommend and why?`,
      testedEntity: businessName,
      testedDomain: domain,
      comparedTo: competitor,
    })
  }

  return queries
}

/**
 * Search with Tavily API for Claude's web search capability
 */
async function searchWithTavily(
  query: string,
  runId?: string,
  step?: string
): Promise<{ success: boolean; results: { url: string; title: string; snippet?: string }[] }> {
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
        search_depth: 'basic', // Use basic for brand awareness (faster)
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

    const results = (data.results || []).map(r => ({
      url: r.url || '',
      title: r.title || '',
      snippet: r.content,
    }))

    // Track Tavily cost if runId provided
    if (runId) {
      await trackTavilyCost(runId, step || 'tavily_search')
    }

    return { success: true, results }
  } catch (error) {
    console.error('Tavily search error:', error)
    return { success: false, results: [] }
  }
}

/**
 * Run ChatGPT query with retry logic and Tavily fallback for inadequate responses
 */
async function runChatGPTQuery(
  query: BrandAwarenessQuery,
  runId: string,
  retryCount = 0
): Promise<{ text: string; usage?: { inputTokens?: number; outputTokens?: number }; usedTavily?: boolean }> {
  const MAX_RETRIES = 1 // Reduce retries since we have Tavily fallback
  const MIN_RESPONSE_LENGTH = 100 // Minimum chars for a useful response

  let result: { text: string; usage?: { inputTokens?: number; outputTokens?: number } } | null = null

  try {
    result = await generateText({
      model: openai.responses('gpt-4o'),
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: 'medium',
        }),
      },
      system: BRAND_SYSTEM_PROMPT,
      prompt: query.prompt,
      maxOutputTokens: 4000,  // Increased to capture full rich comparisons
    })
  } catch (error) {
    log.warn(runId, `ChatGPT gpt-4o failed for ${query.type}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result = { text: '' }
  }

  const responseLength = result?.text?.trim().length || 0
  log.info(runId, `ChatGPT gpt-4o response for ${query.type}: ${responseLength} chars`)

  // Retry once on empty or suspiciously short response
  if (responseLength < MIN_RESPONSE_LENGTH && retryCount < MAX_RETRIES) {
    log.warn(runId, `ChatGPT inadequate response for brand ${query.type} (${responseLength} chars), retrying (${retryCount + 1}/${MAX_RETRIES})`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    return runChatGPTQuery(query, runId, retryCount + 1)
  }

  // If still inadequate after retries, fall back to Tavily + GPT-4o
  if (responseLength < MIN_RESPONSE_LENGTH) {
    log.warn(runId, `ChatGPT web search failed for brand ${query.type}, falling back to Tavily + GPT-4o`)
    const tavilyResults = await searchWithTavily(query.prompt, runId, `brand_${query.type}_chatgpt_tavily`)

    log.info(runId, `Tavily search returned ${tavilyResults.results.length} results for ${query.type}`)

    if (tavilyResults.success && tavilyResults.results.length > 0) {
      const searchContext = tavilyResults.results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
        .join('\n\n')

      try {
        const tavilyResult = await generateText({
          model: openai('gpt-4o'),
          system: BRAND_SYSTEM_PROMPT,
          prompt: `Based on these search results, answer the user's question.

SEARCH RESULTS:
${searchContext}

USER QUESTION: ${query.prompt}

Provide a helpful answer based on the search results.`,
          maxOutputTokens: 1500,
        })

        log.info(runId, `GPT-4o with Tavily response for ${query.type}: ${tavilyResult.text?.length || 0} chars`)
        return { text: tavilyResult.text, usage: tavilyResult.usage, usedTavily: true }
      } catch (error) {
        log.error(runId, `GPT-4o with Tavily failed for ${query.type}`, error instanceof Error ? error.message : 'Unknown error')
      }
    } else {
      log.warn(runId, `Tavily search failed or returned no results for ${query.type}`)

      // Final fallback: Use GPT-4o without search context
      // This is better than returning nothing
      try {
        log.info(runId, `Trying GPT-4o without search for ${query.type}`)
        const fallbackResult = await generateText({
          model: openai('gpt-4o'),
          system: BRAND_SYSTEM_PROMPT,
          prompt: query.prompt,
          maxOutputTokens: 1500,
        })

        if (fallbackResult.text && fallbackResult.text.length > 50) {
          log.info(runId, `GPT-4o fallback response for ${query.type}: ${fallbackResult.text.length} chars`)
          return { text: fallbackResult.text, usage: fallbackResult.usage, usedTavily: false }
        }
      } catch (error) {
        log.error(runId, `GPT-4o fallback failed for ${query.type}`, error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  return { text: result?.text || '', usage: result?.usage }
}

/**
 * Run a single brand awareness query against a specific platform
 * Uses grounded search (web search enabled) for more accurate results
 */
async function runQueryOnPlatform(
  query: BrandAwarenessQuery,
  platform: Platform,
  runId: string
): Promise<BrandAwarenessResult> {
  const startTime = Date.now()

  try {
    let responseText = ''
    let modelString = ''

    switch (platform) {
      case 'chatgpt': {
        // Use gpt-4o with web_search tool for grounded search (with retry + Tavily fallback)
        const result = await runChatGPTQuery(query, runId)
        modelString = result.usedTavily ? 'openai/gpt-4o-tavily' : 'openai/gpt-4o-search'

        responseText = result.text

        if (result.usage) {
          await trackCost({
            runId,
            step: result.usedTavily ? `brand_${query.type}_${platform}_tavily` : `brand_${query.type}_${platform}`,
            model: modelString,
            usage: {
              inputTokens: result.usage.inputTokens || 0,
              outputTokens: result.usage.outputTokens || 0,
              totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
            },
          })
        }
        break
      }

      case 'claude': {
        // Use Tavily search + Claude for grounded response
        modelString = 'anthropic/claude-sonnet-4-20250514'

        // For competitor comparisons, search for each business individually
        // rather than searching for the conversational question
        let searchContext = ''

        if (query.type === 'competitor_compare' && (query.competitors || query.comparedTo)) {
          // Build list of all businesses to search for
          const businessesToSearch = [query.testedEntity]
          if (query.competitors) {
            businessesToSearch.push(...query.competitors)
          } else if (query.comparedTo) {
            businessesToSearch.push(query.comparedTo)
          }

          // Search for each business in parallel
          const searchPromises = businessesToSearch.map(async (business) => {
            const searchQuery = query.testedDomain && business === query.testedEntity
              ? `${business} ${query.testedDomain}`
              : `${business} company`
            const results = await searchWithTavily(searchQuery, runId, `brand_${query.type}_claude_tavily`)
            return { business, results }
          })

          const allSearchResults = await Promise.all(searchPromises)

          // Build context organized by business
          const contextParts: string[] = []
          for (const { business, results } of allSearchResults) {
            if (results.success && results.results.length > 0) {
              const businessContext = results.results
                .slice(0, 3) // Top 3 results per business
                .map((r, i) => `  [${i + 1}] ${r.title}\n  ${r.snippet}\n  Source: ${r.url}`)
                .join('\n\n')
              contextParts.push(`## ${business}\n${businessContext}`)
            }
          }
          searchContext = contextParts.join('\n\n')
        } else {
          // For other queries, use the prompt directly
          const tavilyResults = await searchWithTavily(query.prompt, runId, `brand_${query.type}_claude_tavily`)
          if (tavilyResults.success && tavilyResults.results.length > 0) {
            searchContext = tavilyResults.results
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
              .join('\n\n')
          }
        }

        if (searchContext) {
          const result = await generateText({
            model: anthropic('claude-sonnet-4-20250514'),
            system: BRAND_SYSTEM_PROMPT,
            prompt: `Based on these search results, answer the user's question.

SEARCH RESULTS:
${searchContext}

USER QUESTION: ${query.prompt}

Provide a helpful answer based on the search results.`,
            maxOutputTokens: 4000,  // Increased to capture full rich comparisons
          })

          responseText = result.text

          if (result.usage) {
            await trackCost({
              runId,
              step: `brand_${query.type}_${platform}`,
              model: modelString,
              usage: {
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
              },
            })
          }
        } else {
          // Fallback to standard Claude if Tavily fails
          const result = await generateText({
            model: anthropic('claude-sonnet-4-20250514'),
            system: BRAND_SYSTEM_PROMPT,
            prompt: query.prompt,
            maxOutputTokens: 800,
          })

          responseText = result.text

          if (result.usage) {
            await trackCost({
              runId,
              step: `brand_${query.type}_${platform}`,
              model: modelString,
              usage: {
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
              },
            })
          }
        }
        break
      }

      case 'gemini': {
        // Use Gemini with Google Search grounding
        modelString = 'google/gemini-2.5-flash-grounded'
        try {
          const result = await generateText({
            model: google('gemini-2.5-flash'),
            tools: {
              google_search: google.tools.googleSearch({}),
            },
            system: BRAND_SYSTEM_PROMPT,
            prompt: query.prompt,
            maxOutputTokens: 4000,  // Increased to capture full rich comparisons
          })

          responseText = result.text

          if (result.usage) {
            await trackCost({
              runId,
              step: `brand_${query.type}_${platform}`,
              model: modelString,
              usage: {
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
              },
            })
          }
        } catch {
          // Fallback to Tavily if Google Search fails
          log.warn(runId, `Gemini Google Search failed for brand awareness, trying Tavily`)
          const tavilyResults = await searchWithTavily(query.prompt, runId, `brand_${query.type}_gemini_tavily`)

          if (tavilyResults.success && tavilyResults.results.length > 0) {
            const searchContext = tavilyResults.results
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
              .join('\n\n')

            const result = await generateText({
              model: google('gemini-2.5-flash'),
              system: BRAND_SYSTEM_PROMPT,
              prompt: `Based on these search results, answer the user's question.

SEARCH RESULTS:
${searchContext}

USER QUESTION: ${query.prompt}`,
              maxOutputTokens: 4000,  // Increased to capture full rich comparisons
            })

            responseText = result.text
            modelString = 'google/gemini-2.5-flash'

            if (result.usage) {
              await trackCost({
                runId,
                step: `brand_${query.type}_${platform}_tavily`,
                model: modelString,
                usage: {
                  inputTokens: result.usage.inputTokens || 0,
                  outputTokens: result.usage.outputTokens || 0,
                  totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
                },
              })
            }
          } else {
            throw new Error('Both Google Search and Tavily failed')
          }
        }
        break
      }

      case 'perplexity': {
        // Perplexity is already search-native - keep as-is
        modelString = 'perplexity/sonar-pro'
        const result = await generateText({
          model: perplexity('sonar-pro'),
          system: BRAND_SYSTEM_PROMPT,
          prompt: query.prompt,
          maxOutputTokens: 4000,  // Increased to capture full rich comparisons
        })

        responseText = result.text

        if (result.usage) {
          await trackCost({
            runId,
            step: `brand_${query.type}_${platform}`,
            model: modelString,
            usage: {
              inputTokens: result.usage.inputTokens || 0,
              outputTokens: result.usage.outputTokens || 0,
              totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
            },
          })
        }
        break
      }
    }

    const responseTimeMs = Date.now() - startTime
    const lowerResponse = responseText.toLowerCase()
    const lowerEntity = query.testedEntity.toLowerCase()

    // Analyze the response - pass domain for better recognition
    const recognized = checkEntityRecognized(lowerResponse, lowerEntity, query.testedDomain)
    const attributeMentioned = query.testedAttribute
      ? lowerResponse.includes(query.testedAttribute.toLowerCase())
      : false

    // Calculate confidence score
    const confidenceScore = calculateConfidence(responseText, query, recognized)

    // Determine positioning for competitor comparison
    let positioning: 'stronger' | 'weaker' | 'equal' | 'not_compared' = 'not_compared'
    if (query.type === 'competitor_compare' && query.comparedTo) {
      positioning = analyzePositioning(responseText, query.testedEntity, query.comparedTo)
    }

    log.platform(runId, platform, `✓ brand ${query.type} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)

    return {
      platform,
      queryType: query.type,
      testedEntity: query.testedEntity,
      testedAttribute: query.testedAttribute,
      recognized,
      attributeMentioned,
      responseText,
      confidenceScore,
      comparedTo: query.comparedTo,
      positioning,
      responseTimeMs,
    }
  } catch (error) {
    console.error(`Brand awareness query failed for ${platform}:`, error)
    return {
      platform,
      queryType: query.type,
      testedEntity: query.testedEntity,
      testedAttribute: query.testedAttribute,
      recognized: false,
      attributeMentioned: false,
      responseText: error instanceof Error ? error.message : 'Query failed',
      confidenceScore: 0,
      comparedTo: query.comparedTo,
      positioning: 'not_compared',
      responseTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Check if the AI recognized the entity (not just mentioned it)
 * Now also checks for domain recognition
 */
function checkEntityRecognized(response: string, entity: string, domain?: string): boolean {
  // Check for entity name or domain
  const hasEntity = response.includes(entity)
  const hasDomain = domain ? response.includes(domain.toLowerCase()) : false

  // Must have at least one identifier present
  if (!hasEntity && !hasDomain) {
    return false
  }

  // Check for phrases indicating lack of knowledge
  const unknownPhrases = [
    "i don't have specific information",
    "i don't have specific details",
    "i don't have detailed information",
    "i'm not familiar with",
    "i don't have data about",
    "i cannot find information",
    "no specific information",
    "i'm unable to provide specific",
    "i don't have access to",
    "i don't know about",
    "i'm not aware of",
    "i couldn't find any",
    "no information available",
    "it's best to visit their official website",
    "visit their website directly",
    "contact them directly",
    "check their official website",
    "i don't have real-time",
    "i don't have current information",
    "my knowledge doesn't include",
    "i cannot provide specific details",
  ]

  for (const phrase of unknownPhrases) {
    if (response.includes(phrase)) {
      return false
    }
  }

  return true
}

/**
 * Calculate confidence score based on response quality
 */
function calculateConfidence(
  response: string,
  query: BrandAwarenessQuery,
  recognized: boolean
): number {
  if (!recognized) return 0

  let score = 50 // Base score for recognition

  const lowerResponse = response.toLowerCase()

  // Add points for specific information
  if (query.testedAttribute && lowerResponse.includes(query.testedAttribute.toLowerCase())) {
    score += 25
  }

  // Add points for response length (indicates detailed knowledge)
  if (response.length > 500) score += 10
  if (response.length > 1000) score += 10

  // Add points for confident language
  const confidentPhrases = ['known for', 'specializes in', 'recognized for', 'expertise in', 'leading provider']
  for (const phrase of confidentPhrases) {
    if (lowerResponse.includes(phrase)) {
      score += 5
    }
  }

  return Math.min(score, 100)
}

/**
 * Analyze competitive positioning from response
 */
function analyzePositioning(
  response: string,
  entity: string,
  competitor: string
): 'stronger' | 'weaker' | 'equal' | 'not_compared' {
  const lowerResponse = response.toLowerCase()
  const lowerEntity = entity.toLowerCase()
  const lowerCompetitor = competitor.toLowerCase()

  // Look for comparative language
  const strongerIndicators = [
    `${lowerEntity} is better`,
    `${lowerEntity} excels`,
    `${lowerEntity} offers more`,
    `prefer ${lowerEntity}`,
    `recommend ${lowerEntity}`,
    `${lowerEntity} stands out`,
  ]

  const weakerIndicators = [
    `${lowerCompetitor} is better`,
    `${lowerCompetitor} excels`,
    `${lowerCompetitor} is larger`,
    `${lowerCompetitor} has more`,
    `recommend ${lowerCompetitor}`,
    `${lowerCompetitor} is more established`,
  ]

  for (const indicator of strongerIndicators) {
    if (lowerResponse.includes(indicator)) {
      return 'stronger'
    }
  }

  for (const indicator of weakerIndicators) {
    if (lowerResponse.includes(indicator)) {
      return 'weaker'
    }
  }

  // If both are mentioned but no clear winner
  if (lowerResponse.includes(lowerEntity) && lowerResponse.includes(lowerCompetitor)) {
    return 'equal'
  }

  return 'not_compared'
}

/**
 * Parse batch competitor comparison response into individual results
 * Returns array of per-competitor results from a single batch response
 */
interface BatchComparisonResult {
  competitor: string
  positioning: 'stronger' | 'weaker' | 'equal'
  summary: string
}

/**
 * Extract the section of text that discusses a specific competitor
 * Handles various formats:
 * - "1. CompetitorName:" or "1. CompetitorName"
 * - "## CompetitorName" or "### CompetitorName"
 * - "**CompetitorName**" or "**CompetitorName:**"
 */
function extractCompetitorSection(
  responseText: string,
  competitor: string,
  competitors: string[]
): string {
  const escapedComp = escapeRegex(competitor)

  // Build patterns that match various section header formats
  // The competitor name might have a colon after it
  const sectionStartPatterns = [
    // Numbered sections: "1. CompetitorName:" or "1. CompetitorName" or "1) CompetitorName"
    new RegExp(`(^|\\n)\\d+[\\.\\)]\\s*${escapedComp}:?\\s*`, 'im'),
    // Markdown headers: ## CompetitorName or ### CompetitorName
    new RegExp(`(^|\\n)##?#?\\s*(?:vs\\.?\\s*)?${escapedComp}:?\\s*`, 'im'),
    // Bold headers: **CompetitorName** or **CompetitorName:**
    new RegExp(`(^|\\n)\\*\\*${escapedComp}:?\\*\\*:?\\s*`, 'im'),
    // Just the competitor name on its own line followed by content
    new RegExp(`(^|\\n)${escapedComp}:?\\s*\\n`, 'im'),
  ]

  for (const pattern of sectionStartPatterns) {
    const match = responseText.match(pattern)
    if (match && match.index !== undefined) {
      const startIndex = match.index + (match[1]?.length || 0) // Skip the newline capture group
      let endIndex = responseText.length

      // Find where the next section starts (another numbered item or competitor name)
      // Look for: another number like "2." or another competitor name
      const nextSectionPatterns = [
        // Next numbered item
        /\n\d+[\.\)]\s+/,
      ]

      // Also look for other competitors
      for (const otherComp of competitors) {
        if (otherComp.toLowerCase() !== competitor.toLowerCase()) {
          const escapedOther = escapeRegex(otherComp)
          nextSectionPatterns.push(
            new RegExp(`\\n\\d+[\\.\\)]\\s*${escapedOther}:?\\s*`, 'i'),
            new RegExp(`\\n##?#?\\s*(?:vs\\.?\\s*)?${escapedOther}:?\\s*`, 'i'),
            new RegExp(`\\n\\*\\*${escapedOther}:?\\*\\*`, 'i'),
          )
        }
      }

      // Search for the next section after the current header
      const searchStart = startIndex + match[0].length
      const searchText = responseText.slice(searchStart)

      for (const np of nextSectionPatterns) {
        const nextMatch = searchText.match(np)
        if (nextMatch && nextMatch.index !== undefined) {
          const potentialEnd = searchStart + nextMatch.index
          if (potentialEnd < endIndex) {
            endIndex = potentialEnd
          }
        }
      }

      const section = responseText.slice(startIndex, endIndex).trim()
      // Only use extracted section if it's substantial (more than just a header)
      if (section.length > 50) {
        return section
      }
    }
  }

  // Fallback: return full response - better to show all context than truncate
  return responseText
}

/**
 * Helper to escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Analyze positioning from response text about a competitor
 */
function analyzePositioningFromText(
  text: string,
  brandName: string,
  competitor: string
): 'stronger' | 'weaker' | 'equal' {
  const lowerText = text.toLowerCase()
  const lowerBrand = brandName.toLowerCase()
  const lowerComp = competitor.toLowerCase()

  // Keywords suggesting the brand is stronger
  const brandStrongerPhrases = [
    `${lowerBrand} is better`,
    `${lowerBrand} excels`,
    `${lowerBrand} offers more`,
    `${lowerBrand} has an advantage`,
    `${lowerBrand} stands out`,
    `prefer ${lowerBrand}`,
    `recommend ${lowerBrand}`,
    `${lowerBrand} is stronger`,
    `${lowerBrand} outperforms`,
  ]

  // Keywords suggesting competitor is stronger (brand is weaker)
  const compStrongerPhrases = [
    `${lowerComp} is better`,
    `${lowerComp} excels`,
    `${lowerComp} offers more`,
    `${lowerComp} has an advantage`,
    `${lowerComp} stands out`,
    `prefer ${lowerComp}`,
    `recommend ${lowerComp}`,
    `${lowerComp} is stronger`,
    `${lowerComp} outperforms`,
    `${lowerComp} is more established`,
    `${lowerComp} has more`,
  ]

  let brandScore = 0
  let compScore = 0

  for (const phrase of brandStrongerPhrases) {
    if (lowerText.includes(phrase)) brandScore++
  }

  for (const phrase of compStrongerPhrases) {
    if (lowerText.includes(phrase)) compScore++
  }

  if (brandScore > compScore) return 'stronger'
  if (compScore > brandScore) return 'weaker'
  return 'equal'
}

function parseBatchCompetitorResponse(
  responseText: string,
  competitors: string[],
  brandName?: string
): BatchComparisonResult[] {
  const results: BatchComparisonResult[] = []

  for (const competitor of competitors) {
    // Extract the section discussing this competitor
    const section = extractCompetitorSection(responseText, competitor, competitors)

    // Analyze positioning from the extracted section
    const positioning = brandName
      ? analyzePositioningFromText(section, brandName, competitor)
      : 'equal'

    results.push({
      competitor,
      positioning,
      // Store the full section about this competitor
      summary: section,
    })
  }

  return results
}

/**
 * Run brand awareness queries for a SINGLE platform
 * Used by Inngest to split work into parallel steps with independent retries
 *
 * @param queries - Brand awareness queries to run
 * @param platform - Single platform to query
 * @param runId - Scan run ID for logging
 * @returns Array of results for this platform only
 */
export async function runBrandAwarenessQueriesForPlatform(
  queries: BrandAwarenessQuery[],
  platform: Platform,
  runId: string
): Promise<BrandAwarenessResult[]> {
  log.platform(runId, platform, `Starting ${queries.length} brand awareness queries`)

  const results = await Promise.all(
    queries.map(async (query) => {
      const result = await runQueryOnPlatform(query, platform, runId)

      // For batch competitor queries, expand the single result into multiple per-competitor results
      if (query.isBatchQuery && query.competitors && query.competitors.length > 0) {
        const responseLength = result.responseText?.length || 0

        // If we got an error or very short response, still create results for each competitor
        if (responseLength < 50 || result.confidenceScore === 0) {
          return query.competitors.map(comp => ({
            ...result,
            comparedTo: comp,
            positioning: 'not_compared' as const,
          }))
        }

        const batchResults = parseBatchCompetitorResponse(
          result.responseText,
          query.competitors,
          query.testedEntity
        )

        if (batchResults.length > 0) {
          return batchResults.map(br => ({
            ...result,
            comparedTo: br.competitor,
            positioning: br.positioning,
            responseText: br.summary || result.responseText,
          }))
        }

        // Fallback if parsing failed
        return query.competitors.map(comp => ({
          ...result,
          comparedTo: comp,
          positioning: 'equal' as const,
        }))
      }

      return [result]
    })
  )

  const flatResults = results.flat()
  log.done(runId, `Brand ${platform}`, `${flatResults.length} results`)

  return flatResults
}

/**
 * Run all brand awareness queries across all platforms
 * Now fully parallelized - all queries run simultaneously grouped by platform
 *
 * For batch competitor queries, the single response is expanded into
 * multiple individual results (one per competitor) for consistent storage.
 */
export async function runBrandAwarenessQueries(
  queries: BrandAwarenessQuery[],
  runId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<BrandAwarenessResult[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini', 'perplexity']
  const total = queries.length * platforms.length
  let completed = 0

  // Log all questions at the start
  log.questions(runId, 'Brand Awareness Queries', queries.map(q => q.prompt))

  // Build all tasks upfront
  interface BrandTask {
    query: BrandAwarenessQuery
    queryIndex: number
    platform: Platform
  }

  const allTasks: BrandTask[] = []
  for (let i = 0; i < queries.length; i++) {
    for (const platform of platforms) {
      allTasks.push({ query: queries[i], queryIndex: i, platform })
    }
  }

  // Group tasks by platform for parallel execution
  const platformTasks = new Map<Platform, BrandTask[]>()
  for (const task of allTasks) {
    const existing = platformTasks.get(task.platform) || []
    existing.push(task)
    platformTasks.set(task.platform, existing)
  }

  // Execute all platforms in parallel, each platform runs its queries in parallel too
  const platformPromises = Array.from(platformTasks.entries()).map(async ([_platform, tasks]) => {
    const platformResults = await Promise.all(
      tasks.map(async (task) => {
        const result = await runQueryOnPlatform(task.query, task.platform, runId)
        completed++
        onProgress?.(completed, total)

        // For batch competitor queries, expand the single result into multiple per-competitor results
        if (task.query.isBatchQuery && task.query.competitors && task.query.competitors.length > 0) {
          const responseLength = result.responseText?.length || 0
          console.log(`[${task.platform}] Batch response length: ${responseLength} chars`)
          console.log(`[${task.platform}] Response preview: ${result.responseText?.slice(0, 200)}...`)
          console.log(`[${task.platform}] Recognized: ${result.recognized}, Confidence: ${result.confidenceScore}`)

          // If we got an error or very short response, still create results for each competitor
          // but with the error/empty state preserved
          if (responseLength < 50 || result.confidenceScore === 0) {
            console.log(`[${task.platform}] Low quality response, creating fallback results for each competitor`)
            return task.query.competitors.map(comp => ({
              queryIndex: task.queryIndex,
              result: {
                ...result,
                comparedTo: comp,
                positioning: 'not_compared' as const,
              },
            }))
          }

          const batchResults = parseBatchCompetitorResponse(
            result.responseText,
            task.query.competitors,
            task.query.testedEntity // Pass brand name for positioning analysis
          )

          console.log(`[${task.platform}] Parsed ${batchResults.length} competitor results`)

          // Create individual results for each competitor
          const expandedResults: { queryIndex: number; result: BrandAwarenessResult }[] = batchResults.map(br => ({
            queryIndex: task.queryIndex,
            result: {
              ...result,
              comparedTo: br.competitor,
              positioning: br.positioning,
              // Use extracted section for this competitor (or full response as fallback)
              responseText: br.summary || result.responseText,
            },
          }))

          // If no results were parsed, create fallback results for each competitor
          if (expandedResults.length === 0) {
            return task.query.competitors.map(comp => ({
              queryIndex: task.queryIndex,
              result: {
                ...result,
                comparedTo: comp,
                positioning: 'equal' as const,
              },
            }))
          }

          return expandedResults
        }

        return [{ queryIndex: task.queryIndex, result }]
      })
    )
    // Flatten nested arrays from batch expansion
    return platformResults.flat()
  })

  const allPlatformResults = await Promise.all(platformPromises)

  // Flatten and sort results by query index to maintain order
  const flatResults = allPlatformResults.flat()
  flatResults.sort((a, b) => a.queryIndex - b.queryIndex)

  // Log completion for each query (grouped logging)
  for (let i = 0; i < queries.length; i++) {
    const queryResults = flatResults.filter(r => r.queryIndex === i).map(r => r.result)
    // Deduplicate by platform for logging (batch queries create multiple per platform)
    const uniquePlatforms = new Map<Platform, BrandAwarenessResult>()
    for (const r of queryResults) {
      if (!uniquePlatforms.has(r.platform)) {
        uniquePlatforms.set(r.platform, r)
      }
    }
    log.questionDone(runId, i, queries.length, Array.from(uniquePlatforms.values()).map(r => ({
      name: r.platform,
      mentioned: r.recognized,
    })))
  }

  return flatResults.map(r => r.result)
}

/**
 * Analyze brand awareness results to extract insights
 */
export function analyzeBrandAwareness(
  results: BrandAwarenessResult[],
  analysis: BusinessAnalysis
): BrandAwarenessAnalysis {
  // Calculate overall recognition
  const brandRecallResults = results.filter(r => r.queryType === 'brand_recall')
  const recognizedCount = brandRecallResults.filter(r => r.recognized).length
  const overallRecognition = Math.round((recognizedCount / brandRecallResults.length) * 100)

  // Analyze service knowledge
  const serviceCheckResults = results.filter(r => r.queryType === 'service_check')
  const serviceKnowledge: BrandAwarenessAnalysis['serviceKnowledge'] = []

  // Group by service
  const serviceMap = new Map<string, BrandAwarenessResult[]>()
  for (const result of serviceCheckResults) {
    if (result.testedAttribute) {
      const existing = serviceMap.get(result.testedAttribute) || []
      existing.push(result)
      serviceMap.set(result.testedAttribute, existing)
    }
  }

  const knowledgeGaps: string[] = []

  for (const [service, serviceResults] of serviceMap) {
    const knownBy = serviceResults.filter(r => r.attributeMentioned).map(r => r.platform)
    const unknownBy = serviceResults.filter(r => !r.attributeMentioned).map(r => r.platform)

    serviceKnowledge.push({ service, knownBy, unknownBy })

    // If no platform knows about this service, it's a knowledge gap
    if (knownBy.length === 0) {
      knowledgeGaps.push(service)
    }
  }

  // Analyze competitor positioning
  const competitorResults = results.filter(r => r.queryType === 'competitor_compare')
  let competitorPositioning: BrandAwarenessAnalysis['competitorPositioning']

  if (competitorResults.length > 0 && competitorResults[0].comparedTo) {
    const positioning: Record<Platform, string> = {} as Record<Platform, string>
    for (const result of competitorResults) {
      positioning[result.platform] = result.positioning || 'not_compared'
    }
    competitorPositioning = {
      competitor: competitorResults[0].comparedTo,
      positioning,
    }
  }

  return {
    overallRecognition,
    serviceKnowledge,
    knowledgeGaps,
    competitorPositioning,
  }
}

/**
 * Competitive Intelligence Summary
 * Generated by Claude synthesizing all competitor comparison responses
 */
export interface CompetitiveSummary {
  strengths: string[]      // What the brand is perceived as strong at
  weaknesses: string[]     // Areas where competitors have an advantage
  opportunities: string[]  // Key opportunities to improve positioning
  overallPosition: string  // Brief overall assessment
}

/**
 * Generate a competitive intelligence summary using Claude
 * Takes all competitor comparison responses and synthesizes them into actionable insights
 */
export async function generateCompetitiveSummary(
  results: BrandAwarenessResult[],
  brandName: string,
  runId: string
): Promise<CompetitiveSummary | null> {
  const competitorResults = results.filter(r => r.queryType === 'competitor_compare')

  if (competitorResults.length === 0) {
    return null
  }

  // Group results by competitor
  const byCompetitor = new Map<string, BrandAwarenessResult[]>()
  for (const result of competitorResults) {
    const name = result.comparedTo || 'Unknown'
    const existing = byCompetitor.get(name) || []
    existing.push(result)
    byCompetitor.set(name, existing)
  }

  // Build context for Claude
  const competitorSections: string[] = []
  for (const [competitor, responses] of byCompetitor) {
    const platformResponses = responses
      .map(r => `### ${r.platform.toUpperCase()}\n${r.responseText}`)
      .join('\n\n')
    competitorSections.push(`## vs. ${competitor}\n${platformResponses}`)
  }

  const prompt = `You are analyzing competitive intelligence for "${brandName}".

Below are AI assistant responses comparing ${brandName} to various competitors. Your task is to synthesize these into a clear competitive summary.

${competitorSections.join('\n\n---\n\n')}

---

Based on ALL the above comparisons across ALL platforms, provide a competitive intelligence summary in the following JSON format:

{
  "strengths": [
    "Strength 1: Brief description of what ${brandName} does well",
    "Strength 2: Another perceived advantage",
    "Strength 3: Third strength if applicable"
  ],
  "weaknesses": [
    "Weakness 1: Area where competitors have an advantage",
    "Weakness 2: Another gap or weakness"
  ],
  "opportunities": [
    "Opportunity 1: Actionable way to improve positioning",
    "Opportunity 2: Another opportunity"
  ],
  "overallPosition": "A 1-2 sentence summary of ${brandName}'s overall competitive position in the AI landscape"
}

Important:
- Base your analysis ONLY on what the AI responses actually say
- Be specific and actionable
- Include 2-4 items per category
- Focus on perception, not reality (what AI thinks, not what's true)
- Respond ONLY with the JSON, no additional text`

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      maxOutputTokens: 1000,
    })

    if (result.usage) {
      await trackCost({
        runId,
        step: 'competitive_summary',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse the JSON response
    let jsonStr = result.text
    const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      jsonStr = objectMatch[0]
    }

    const parsed = JSON.parse(jsonStr) as CompetitiveSummary
    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      opportunities: parsed.opportunities || [],
      overallPosition: parsed.overallPosition || '',
    }
  } catch (error) {
    console.error('Failed to generate competitive summary:', error)
    return null
  }
}
