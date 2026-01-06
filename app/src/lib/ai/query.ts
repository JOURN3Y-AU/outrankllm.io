/**
 * LLM Query Engine
 * Queries multiple AI platforms and analyzes responses
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Initialize providers
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || '',
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
  domain: string
): Promise<QueryResult> {
  const startTime = Date.now()

  try {
    let response: string

    switch (platform) {
      case 'chatgpt':
        const openaiResult = await generateText({
          model: openai('gpt-4o'),
          system: SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: 1000,
        })
        response = openaiResult.text
        break

      case 'claude':
        const claudeResult = await generateText({
          model: anthropic('claude-sonnet-4-20250514'),
          system: SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: 1000,
        })
        response = claudeResult.text
        break

      case 'gemini':
        const geminiResult = await generateText({
          model: google('gemini-2.0-flash-exp'),
          system: SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: 1000,
        })
        response = geminiResult.text
        break

      default:
        throw new Error(`Unknown platform: ${platform}`)
    }

    const responseTimeMs = Date.now() - startTime

    // Check if domain is mentioned
    const { mentioned, position } = checkDomainMention(response, domain)

    // Extract competitors
    const competitors = extractCompetitors(response, domain)

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

/**
 * Extract competitor mentions from response
 */
function extractCompetitors(
  response: string,
  domain: string
): { name: string; context: string }[] {
  const competitors: { name: string; context: string }[] = []

  // Look for patterns that indicate company recommendations
  // This is a simplified extraction - in production you might use NER
  const patterns = [
    /(?:recommend|suggest|consider|try|check out|look at)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/g,
    /([A-Z][a-zA-Z0-9]+(?:\.[a-z]{2,4})?)\s+(?:is|are|offers|provides)/g,
    /companies?\s+(?:like|such as)\s+([A-Z][a-zA-Z0-9]+(?:,\s*[A-Z][a-zA-Z0-9]+)*)/g,
  ]

  for (const pattern of patterns) {
    const matches = response.matchAll(pattern)
    for (const match of matches) {
      const name = match[1].trim()

      // Skip if it's the target domain
      if (name.toLowerCase().includes(domain.toLowerCase().split('.')[0])) {
        continue
      }

      // Skip common words that might match
      if (['The', 'This', 'That', 'Some', 'Many', 'Here', 'These'].includes(name)) {
        continue
      }

      // Extract context around the mention
      const index = response.indexOf(name)
      const start = Math.max(0, index - 30)
      const end = Math.min(response.length, index + name.length + 30)
      const context = response.substring(start, end).trim()

      // Check if already added
      if (!competitors.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
        competitors.push({ name, context: `...${context}...` })
      }
    }
  }

  return competitors.slice(0, 10) // Limit to 10 competitors
}

/**
 * Query all platforms with a single prompt
 */
export async function queryAllPlatforms(
  prompt: string,
  domain: string
): Promise<QueryResult[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini']

  // Query all platforms in parallel
  const results = await Promise.all(
    platforms.map((platform) => queryPlatform(platform, prompt, domain))
  )

  return results
}

/**
 * Query all platforms with multiple prompts
 */
export async function queryAllPlatformsWithPrompts(
  prompts: { id: string; text: string }[],
  domain: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ promptId: string; results: QueryResult[] }[]> {
  const allResults: { promptId: string; results: QueryResult[] }[] = []
  const total = prompts.length

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]
    const results = await queryAllPlatforms(prompt.text, domain)
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
