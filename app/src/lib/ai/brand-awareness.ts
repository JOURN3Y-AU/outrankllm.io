/**
 * Brand Awareness Module
 * Tests what AI assistants actually know about a business
 * compared to what the website claims
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createPerplexity } from '@ai-sdk/perplexity'
import { trackCost } from './costs'
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
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})

const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
})

export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export interface BrandAwarenessQuery {
  type: 'brand_recall' | 'service_check' | 'competitor_compare'
  prompt: string
  testedEntity: string
  testedDomain?: string  // Domain URL for better recognition
  testedAttribute?: string
  comparedTo?: string
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
 */
export function generateBrandAwarenessQueries(
  analysis: BusinessAnalysis,
  domain: string,
  topCompetitor?: string
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

  // 3. Competitor Comparison Query - How does this business compare?
  if (topCompetitor) {
    queries.push({
      type: 'competitor_compare',
      prompt: `I'm looking for ${analysis.businessType} in ${analysis.location || 'my area'}. How would you compare ${brandIdentifier} to ${topCompetitor}? What are the strengths and weaknesses of each?`,
      testedEntity: businessName,
      testedDomain: domain,
      comparedTo: topCompetitor,
    })
  }

  return queries
}

/**
 * Run a single brand awareness query against a specific platform
 */
async function runQueryOnPlatform(
  query: BrandAwarenessQuery,
  platform: Platform,
  runId: string
): Promise<BrandAwarenessResult> {
  const startTime = Date.now()

  // Model strings for cost tracking
  const modelStringMap: Record<Platform, string> = {
    chatgpt: 'openai/gpt-4o',
    claude: 'anthropic/claude-sonnet-4-20250514',
    gemini: 'google/gemini-2.0-flash',
    perplexity: 'perplexity/sonar-pro',
  }

  const modelString = modelStringMap[platform]

  try {
    // Use direct API clients (bypasses Vercel AI Gateway rate limits)
    const model = (() => {
      switch (platform) {
        case 'chatgpt':
          return openai('gpt-4o')
        case 'claude':
          return anthropic('claude-sonnet-4-20250514')
        case 'gemini':
          return google('gemini-2.0-flash')
        case 'perplexity':
          return perplexity('sonar-pro')
      }
    })()

    const result = await generateText({
      model,
      prompt: query.prompt,
      maxOutputTokens: 800,
    })

    const responseTimeMs = Date.now() - startTime

    // Track cost
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

    const responseText = result.text
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
 * Run all brand awareness queries across all platforms
 * Now fully parallelized - all queries run simultaneously grouped by platform
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
        return { queryIndex: task.queryIndex, result }
      })
    )
    return platformResults
  })

  const allPlatformResults = await Promise.all(platformPromises)

  // Flatten and sort results by query index to maintain order
  const flatResults = allPlatformResults.flat()
  flatResults.sort((a, b) => a.queryIndex - b.queryIndex)

  // Log completion for each query (grouped logging)
  for (let i = 0; i < queries.length; i++) {
    const queryResults = flatResults.filter(r => r.queryIndex === i).map(r => r.result)
    log.questionDone(runId, i, queries.length, queryResults.map(r => ({
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
