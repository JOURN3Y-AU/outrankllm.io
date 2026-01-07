/**
 * Brand Awareness Module
 * Tests what AI assistants actually know about a business
 * compared to what the website claims
 */

import { generateText, createGateway } from 'ai'
import { createPerplexity } from '@ai-sdk/perplexity'
import { trackCost } from './costs'
import { log } from '@/lib/logger'
import type { BusinessAnalysis } from './analyze'

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

// Initialize Perplexity directly (not through gateway)
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

  // Map platform to Vercel AI Gateway model string (except Perplexity which uses direct SDK)
  const modelMap: Record<Platform, string> = {
    chatgpt: 'openai/gpt-4o',
    claude: 'anthropic/claude-sonnet-4-20250514',
    gemini: 'google/gemini-2.0-flash',
    perplexity: 'perplexity/sonar-pro',
  }

  const modelString = modelMap[platform]

  try {
    // Use direct Perplexity SDK, gateway for others
    const model = platform === 'perplexity'
      ? perplexity('sonar-pro')
      : gateway(modelString)

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
 */
export async function runBrandAwarenessQueries(
  queries: BrandAwarenessQuery[],
  runId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<BrandAwarenessResult[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini', 'perplexity']
  const results: BrandAwarenessResult[] = []
  const total = queries.length * platforms.length
  let completed = 0

  // Log all questions at the start
  log.questions(runId, 'Brand Awareness Queries', queries.map(q => q.prompt))

  // Run queries sequentially to avoid rate limits
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]

    // Log which question we're starting
    log.questionStart(runId, i, queries.length, query.prompt)

    // Run each query on all platforms in parallel
    const platformResults = await Promise.all(
      platforms.map(platform => runQueryOnPlatform(query, platform, runId))
    )
    results.push(...platformResults)

    // Log question completion with platform results
    log.questionDone(runId, i, queries.length, platformResults.map(r => ({
      name: r.platform,
      mentioned: r.recognized,
    })))

    completed += platforms.length
    onProgress?.(completed, total)

    // Small delay between query types to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return results
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
