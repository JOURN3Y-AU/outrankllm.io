/**
 * LLM Query Engine
 * Queries multiple AI platforms via Vercel AI Gateway
 */

import { generateText, createGateway } from 'ai'
import { trackCost } from './costs'

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

export type Platform = 'chatgpt' | 'claude' | 'gemini'

export interface QueryResult {
  platform: Platform
  promptText: string
  response: string
  domainMentioned: boolean
  mentionPosition: number | null // 1, 2, or 3 (thirds of response)
  competitorsMentioned: { name: string; context: string }[]
  responseTimeMs: number
  error: string | null
}

const SYSTEM_PROMPT = `You are a helpful assistant providing information about businesses and services. When users ask for recommendations, be specific and mention actual company names when relevant. Provide balanced, informative responses.`

/**
 * Query a single platform
 */
async function queryPlatform(
  platform: Platform,
  prompt: string,
  domain: string,
  runId?: string
): Promise<QueryResult> {
  const startTime = Date.now()

  try {
    let response: string

    // Map platform to Vercel AI Gateway model string
    const modelMap: Record<Platform, string> = {
      chatgpt: 'openai/gpt-4o',
      claude: 'anthropic/claude-sonnet-4-20250514',
      gemini: 'google/gemini-2.0-flash',
    }

    const modelString = modelMap[platform]
    if (!modelString) {
      throw new Error(`Unknown platform: ${platform}`)
    }

    const result = await generateText({
      model: gateway(modelString),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 1000,
    })
    response = result.text

    const responseTimeMs = Date.now() - startTime

    // Track cost if runId is provided
    if (runId && result.usage) {
      await trackCost({
        runId,
        step: `query_${platform}`,
        model: modelString,
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Check if domain is mentioned
    const { mentioned, position } = checkDomainMention(response, domain)

    // Extract competitors using AI
    const competitors = await extractCompetitors(response, domain, runId)

    return {
      platform,
      promptText: prompt,
      response,
      domainMentioned: mentioned,
      mentionPosition: position,
      competitorsMentioned: competitors,
      responseTimeMs,
      error: null,
    }
  } catch (error) {
    return {
      platform,
      promptText: prompt,
      response: '',
      domainMentioned: false,
      mentionPosition: null,
      competitorsMentioned: [],
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if domain is mentioned in response
 */
function checkDomainMention(
  response: string,
  domain: string
): { mentioned: boolean; position: number | null } {
  const lowerResponse = response.toLowerCase()
  const domainVariations = [
    domain.toLowerCase(),
    domain.toLowerCase().replace(/\.(com|io|co|net|org|au).*$/, ''),
    domain.toLowerCase().replace(/^www\./, ''),
  ]

  for (const variation of domainVariations) {
    const index = lowerResponse.indexOf(variation)
    if (index !== -1) {
      // Calculate position (1st, 2nd, or 3rd third)
      const position = Math.ceil(((index + 1) / response.length) * 3)
      return { mentioned: true, position: Math.min(position, 3) }
    }
  }

  return { mentioned: false, position: null }
}

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
async function extractCompetitors(
  response: string,
  domain: string,
  runId?: string
): Promise<{ name: string; context: string }[]> {
  // Skip extraction if response is too short or empty
  if (!response || response.length < 50) {
    return []
  }

  try {
    const prompt = COMPETITOR_EXTRACTION_PROMPT
      .replace('{domain}', domain)
      .replace('{response}', response.slice(0, 2000)) // Limit response length

    const modelString = 'openai/gpt-4o-mini'
    const result = await generateText({
      model: gateway(modelString), // Use cheaper model for extraction
      prompt,
      maxOutputTokens: 200,
    })

    // Track cost if runId is provided
    if (runId && result.usage) {
      await trackCost({
        runId,
        step: 'competitors',
        model: modelString,
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
      .slice(0, 5) // Limit to 5 per response
      .map(name => {
        // Extract context around the mention
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
 * Query all platforms with a single prompt
 */
export async function queryAllPlatforms(
  prompt: string,
  domain: string,
  runId?: string
): Promise<QueryResult[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini']

  // Query all platforms in parallel
  const results = await Promise.all(
    platforms.map((platform) => queryPlatform(platform, prompt, domain, runId))
  )

  return results
}

/**
 * Query all platforms with multiple prompts
 */
export async function queryAllPlatformsWithPrompts(
  prompts: { id: string; text: string }[],
  domain: string,
  onProgress?: (completed: number, total: number) => void,
  runId?: string
): Promise<{ promptId: string; results: QueryResult[] }[]> {
  const allResults: { promptId: string; results: QueryResult[] }[] = []
  const total = prompts.length

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]
    const results = await queryAllPlatforms(prompt.text, domain, runId)
    allResults.push({ promptId: prompt.id, results })

    onProgress?.(i + 1, total)

    // Small delay between prompts to avoid rate limits
    if (i < prompts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return allResults
}

/**
 * Calculate visibility score from query results
 */
export function calculateVisibilityScore(
  results: { promptId: string; results: QueryResult[] }[]
): {
  overallScore: number
  platformScores: Record<Platform, number>
  totalQueries: number
  totalMentions: number
} {
  const platformMentions: Record<Platform, { mentioned: number; total: number }> = {
    chatgpt: { mentioned: 0, total: 0 },
    claude: { mentioned: 0, total: 0 },
    gemini: { mentioned: 0, total: 0 },
  }

  for (const { results: queryResults } of results) {
    for (const result of queryResults) {
      platformMentions[result.platform].total++
      if (result.domainMentioned) {
        platformMentions[result.platform].mentioned++
      }
    }
  }

  // Calculate per-platform scores
  const platformScores: Record<Platform, number> = {
    chatgpt: Math.round(
      (platformMentions.chatgpt.mentioned / Math.max(platformMentions.chatgpt.total, 1)) * 100
    ),
    claude: Math.round(
      (platformMentions.claude.mentioned / Math.max(platformMentions.claude.total, 1)) * 100
    ),
    gemini: Math.round(
      (platformMentions.gemini.mentioned / Math.max(platformMentions.gemini.total, 1)) * 100
    ),
  }

  // Calculate overall score (weighted average)
  const totalMentions = Object.values(platformMentions).reduce((sum, p) => sum + p.mentioned, 0)
  const totalQueries = Object.values(platformMentions).reduce((sum, p) => sum + p.total, 0)
  const overallScore = Math.round((totalMentions / Math.max(totalQueries, 1)) * 100)

  return {
    overallScore,
    platformScores,
    totalQueries,
    totalMentions,
  }
}

/**
 * Extract top competitors from all results
 */
export function extractTopCompetitors(
  results: { promptId: string; results: QueryResult[] }[]
): { name: string; count: number }[] {
  const competitorCounts: Record<string, number> = {}

  for (const { results: queryResults } of results) {
    for (const result of queryResults) {
      for (const competitor of result.competitorsMentioned) {
        const name = competitor.name
        competitorCounts[name] = (competitorCounts[name] || 0) + 1
      }
    }
  }

  return Object.entries(competitorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}
