/**
 * HiringBrand.io Scan Processor
 * Employer reputation scanning - "What's it like to work at [Company]?"
 *
 * Key differences from outrankllm process-scan:
 * - Uses employer-research.ts instead of query-research.ts
 * - Extracts employer analysis (culture, roles, benefits) not business analysis
 * - Questions are job-seeker focused ("What's it like to work at...")
 * - Scoring reflects employer reputation, not business visibility
 */

import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite, combineCrawledContent } from '@/lib/ai/crawl'
import {
  researchEmployer,
  researchEmployerWithRoles,
  generateFallbackEmployerQuestions,
  type EmployerAnalysis,
  type CompetitorEmployer,
  type JobFamily,
} from '@/lib/ai/employer-research'
import { classifyJobFamilies, type DetectedJobFamily } from '@/lib/ai/classify-job-families'
import { generateRoleActionPlan, type RoleActionPlan } from '@/lib/ai/generate-role-action-plan'
import {
  queryPlatformWithSearch,
  type LocationContext,
  type PlatformResult,
} from '@/lib/ai/search-providers'
import { detectGeography, countryToIsoCode } from '@/lib/geo/detect'
import { log } from '@/lib/logger'
import { trackCost } from '@/lib/ai/costs'
import { compareEmployers } from '@/lib/ai/compare-employers'
import { generateStrategicSummary } from '@/lib/ai/generate-strategic-summary'
import {
  discoverWebMentions,
  classifyMentions,
  computeMentionStats,
  persistMentions,
  generateCoverageBriefing,
} from '@/lib/ai/discover-mentions'
import { generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import crypto from 'crypto'

// OpenAI client for researchability and enhanced analysis
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Anthropic client for batch sentiment analysis (more accurate, consistent scoring)
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Employer brand topics to track for researchability
const EMPLOYER_TOPICS = [
  'compensation', // salary, pay, bonuses
  'benefits', // health insurance, retirement, perks
  'work_life_balance', // hours, flexibility, PTO
  'remote_policy', // remote, hybrid, office requirements
  'growth', // career development, promotions, learning
  'culture', // values, environment, team dynamics
  'leadership', // management style, executives
  'diversity', // DEI, inclusion, belonging
  'perks', // meals, wellness, equipment, stipends
  'interview_process', // hiring, interviews, application
] as const

type EmployerTopic = (typeof EMPLOYER_TOPICS)[number]

interface ResearchabilityAnalysis {
  specificityScore: number
  confidenceScore: number
  topicsCovered: EmployerTopic[]
}

/**
 * Analyze researchability of an AI response about an employer
 * Measures: specificity (how detailed), confidence (how certain), and topic coverage
 */
async function analyzeResearchability(
  response: string,
  companyName: string,
  runId: string
): Promise<ResearchabilityAnalysis> {
  // Skip if response is empty or too short
  if (!response || response.length < 50) {
    return { specificityScore: 3, confidenceScore: 3, topicsCovered: [] }
  }

  const prompt = `Analyze this AI response about "${companyName}" as an employer.

Response:
"""
${response.slice(0, 2000)}
"""

Rate on a scale of 1-10:
1. SPECIFICITY: How detailed and specific is the information? (1=vague generics, 10=concrete details like "$150k salary, 4 weeks PTO")
2. CONFIDENCE: How certain does the AI sound? (1=many hedges/uncertainty, 10=authoritative with sources)

Also identify which employer topics are covered:
${EMPLOYER_TOPICS.map((t) => `- ${t}`).join('\n')}

Respond in this EXACT format (one line per item):
SPECIFICITY: [1-10]
CONFIDENCE: [1-10]
TOPICS: [comma-separated list from above, or "none"]`

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxOutputTokens: 100,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'researchability_analysis',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse response
    const lines = result.text.split('\n')
    let specificityScore = 5
    let confidenceScore = 5
    let topicsCovered: EmployerTopic[] = []

    for (const line of lines) {
      const specificityMatch = line.match(/SPECIFICITY:\s*(\d+)/i)
      if (specificityMatch) {
        specificityScore = Math.min(10, Math.max(1, parseInt(specificityMatch[1], 10)))
      }

      const confidenceMatch = line.match(/CONFIDENCE:\s*(\d+)/i)
      if (confidenceMatch) {
        confidenceScore = Math.min(10, Math.max(1, parseInt(confidenceMatch[1], 10)))
      }

      const topicsMatch = line.match(/TOPICS:\s*(.+)/i)
      if (topicsMatch && topicsMatch[1].toLowerCase() !== 'none') {
        const topics = topicsMatch[1].split(',').map((t) => t.trim().toLowerCase())
        topicsCovered = topics.filter((t) => EMPLOYER_TOPICS.includes(t as EmployerTopic)) as EmployerTopic[]
      }
    }

    return { specificityScore, confidenceScore, topicsCovered }
  } catch (error) {
    console.error('Researchability analysis failed:', error)
    return { specificityScore: 5, confidenceScore: 5, topicsCovered: [] }
  }
}

/**
 * Batch analyze sentiment of all AI responses about an employer using Claude
 * Analyzes all responses together for consistent, comparative scoring
 */
// 4-tier sentiment categories
type SentimentCategory = 'strong' | 'positive' | 'mixed' | 'negative'

// Sentiment result with driving phrases
interface SentimentResult {
  score: number
  category: SentimentCategory
  positivePhrases: string[] // Exact phrases that drove score up
  negativePhrases: string[] // Exact phrases that drove score down
}

// Schema for batch sentiment response with phrase extraction
const batchSentimentSchema = z.object({
  scores: z.array(z.object({
    id: z.string(),
    score: z.number().min(1).max(10),
    positivePhrases: z.array(z.string()).describe('2-4 exact quotes from the response that are positive about the employer'),
    negativePhrases: z.array(z.string()).describe('2-4 exact quotes from the response that are negative or concerning'),
  })),
})

interface ResponseForSentiment {
  id: string
  platform: string
  question: string
  response: string
}

async function batchAnalyzeSentiment(
  responses: ResponseForSentiment[],
  companyName: string,
  runId: string
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>()

  // Filter out empty responses
  const validResponses = responses.filter(r => r.response && r.response.length >= 50)

  if (validResponses.length === 0) {
    return results
  }

  // Format responses for analysis (truncate each to manage context)
  const formattedResponses = validResponses.map((r, idx) =>
    `[${r.id}] Platform: ${r.platform.toUpperCase()}
Question: "${r.question}"
Response (truncated): "${r.response.slice(0, 800)}${r.response.length > 800 ? '...' : ''}"`
  ).join('\n\n---\n\n')

  const systemPrompt = `You are an expert at evaluating employer reputation content. You will analyze multiple AI responses about "${companyName}" as an employer and score each one on how positively it portrays the company to job seekers.

SCORING GUIDE (1-10):
- 9-10 STRONG: Enthusiastic, unqualified recommendation. Language like "excellent", "highly recommend", "great place to work", "top employer". Multiple strengths highlighted with strong conviction, no significant caveats.
- 6-8 POSITIVE: Clearly favorable overall. Recommends the company, mentions good culture/benefits/growth. May have minor caveats but overall impression is positive. Score 8 for strong positives with small caveats, 6-7 for good but more hedged.
- 4-5 MIXED: Balanced or unclear. Equal positives and negatives, or generic information without clear recommendation. May mention both good and bad aspects. Score 5 for true neutral, 4 for leaning slightly negative.
- 1-3 NEGATIVE: Warns about issues, mentions problems like turnover, burnout, poor management, or actively discourages. Score 3 for notable concerns, 2 for significant problems, 1 for strongly negative.

IMPORTANT SCORING PRINCIPLES:
1. Compare responses RELATIVE to each other - if one is clearly more positive than another, the scores should reflect that
2. Look at TONE and LANGUAGE, not just facts. Enthusiastic language = higher score
3. Do NOT default to 5. True neutrality is rare - most responses lean positive or negative
4. Consider the OVERALL impression a job seeker would get
5. Hedging and caveats lower the score even if facts are positive

PHRASE EXTRACTION:
For each response, extract 2-4 EXACT QUOTES (word-for-word from the text) that drove your score:
- positivePhrases: Quotes that improve the score (praise, benefits, recommendations)
- negativePhrases: Quotes that lower the score (concerns, warnings, negatives)
Keep quotes SHORT (5-15 words each) and EXACT from the response text.`

  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: batchSentimentSchema,
      system: systemPrompt,
      prompt: `Analyze these ${validResponses.length} AI responses about ${companyName} and score each one from 1-10.

For each response, extract the EXACT phrases (word-for-word quotes) that drove your score decision.

${formattedResponses}

Return a score and driving phrases for each response ID. Be sure to differentiate between responses.`,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'batch_sentiment_analysis',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Process results
    // Categories: Strong (9-10), Positive (6-8), Mixed (4-5), Negative (1-3)
    for (const item of result.object.scores) {
      const score = Math.min(10, Math.max(1, Math.round(item.score)))
      const category: SentimentCategory =
        score >= 9 ? 'strong' : score >= 6 ? 'positive' : score >= 4 ? 'mixed' : 'negative'
      results.set(item.id, {
        score,
        category,
        positivePhrases: item.positivePhrases || [],
        negativePhrases: item.negativePhrases || [],
      })
    }

    // Set default for any responses that weren't scored
    for (const r of validResponses) {
      if (!results.has(r.id)) {
        results.set(r.id, { score: 5, category: 'mixed', positivePhrases: [], negativePhrases: [] })
      }
    }

    console.log(`Batch sentiment analysis complete: ${results.size} responses scored`)
    return results
  } catch (error) {
    console.error('Batch sentiment analysis failed:', error)
    // Return defaults for all responses on failure
    for (const r of validResponses) {
      results.set(r.id, { score: 5, category: 'mixed', positivePhrases: [], negativePhrases: [] })
    }
    return results
  }
}

/**
 * Batch analyze differentiation of employer brand using Claude
 * Looks at competitor confusion, unique positioning, and generic language
 */
interface DifferentiationAnalysis {
  competitorConfusionScore: number // 1-10, higher = more confusion (bad)
  uniquePositioningScore: number // 1-10, higher = more unique (good)
  genericLanguageScore: number // 1-10, higher = more generic (bad)
  uniqueAttributes: string[] // Specific things mentioned only about this company
  genericPhrases: string[] // Cookie-cutter phrases detected
}

const batchDifferentiationSchema = z.object({
  competitorConfusion: z.number().min(1).max(10),
  uniquePositioning: z.number().min(1).max(10),
  genericLanguage: z.number().min(1).max(10),
  uniqueAttributes: z.array(z.string()),
  genericPhrases: z.array(z.string()),
})

async function batchAnalyzeDifferentiation(
  responses: Array<{ id: string; platform: string; question: string; response: string }>,
  companyName: string,
  competitorNames: string[],
  runId: string
): Promise<DifferentiationAnalysis> {
  const defaultResult: DifferentiationAnalysis = {
    competitorConfusionScore: 5,
    uniquePositioningScore: 5,
    genericLanguageScore: 5,
    uniqueAttributes: [],
    genericPhrases: [],
  }

  if (responses.length === 0) return defaultResult

  // Format responses for analysis
  const formattedResponses = responses
    .slice(0, 20) // Limit to 20 responses to manage token usage
    .map((r) =>
      `[${r.platform.toUpperCase()}] Q: "${r.question}"
A: "${r.response.slice(0, 600)}${r.response.length > 600 ? '...' : ''}"`
    )
    .join('\n\n---\n\n')

  const competitorList = competitorNames.length > 0
    ? competitorNames.slice(0, 10).join(', ')
    : 'unknown competitors'

  const systemPrompt = `You are an expert at analyzing employer brand differentiation. You will evaluate how well AI assistants distinguish "${companyName}" from other employers.

KNOWN COMPETITORS: ${competitorList}

SCORING CRITERIA:

1. COMPETITOR_CONFUSION (1-10):
   - 1-3: AI clearly distinguishes ${companyName}, rarely mentions competitors unless specifically comparing
   - 4-6: AI sometimes conflates or brings up competitors when not asked
   - 7-10: AI frequently confuses ${companyName} with competitors or can't distinguish them

2. UNIQUE_POSITIONING (1-10):
   - 1-3: Generic descriptions that could apply to any company in the industry
   - 4-6: Some unique elements but mixed with generic content
   - 7-10: Clear, specific positioning with unique employer value proposition elements

3. GENERIC_LANGUAGE (1-10):
   - 1-3: Specific, distinctive descriptions with concrete details
   - 4-6: Mix of specific and generic language
   - 7-10: Heavy use of cookie-cutter phrases like "great culture", "competitive salary", "work-life balance" without specifics

Also identify:
- UNIQUE_ATTRIBUTES: Specific things AI knows about ${companyName} that wouldn't apply to competitors
- GENERIC_PHRASES: Cookie-cutter employer descriptions detected in responses`

  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: batchDifferentiationSchema,
      system: systemPrompt,
      prompt: `Analyze these ${responses.length} AI responses about ${companyName} as an employer:

${formattedResponses}

Evaluate the overall differentiation across all responses. How well does AI distinguish ${companyName} from competitors?`,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'batch_differentiation_analysis',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    return {
      competitorConfusionScore: result.object.competitorConfusion,
      uniquePositioningScore: result.object.uniquePositioning,
      genericLanguageScore: result.object.genericLanguage,
      uniqueAttributes: result.object.uniqueAttributes,
      genericPhrases: result.object.genericPhrases,
    }
  } catch (error) {
    console.error('Batch differentiation analysis failed:', error)
    return defaultResult
  }
}

/**
 * Enhanced response analysis for HiringBrand
 * Extracts key phrases, flags, recommendation score, and confidence indicators
 */
interface EnhancedAnalysis {
  // Key phrases
  positiveHighlights: string[]
  negativeHighlights: string[]
  redFlags: string[]
  greenFlags: string[]
  // Recommendation
  recommendationScore: number
  recommendationSummary: string
  // Confidence
  hedgingLevel: 'low' | 'medium' | 'high'
  sourceQuality: 'none' | 'weak' | 'moderate' | 'strong'
  responseRecency: 'current' | 'recent' | 'dated' | 'unknown'
}

async function analyzeResponseEnhanced(
  response: string,
  companyName: string,
  runId: string
): Promise<EnhancedAnalysis> {
  const defaultResult: EnhancedAnalysis = {
    positiveHighlights: [],
    negativeHighlights: [],
    redFlags: [],
    greenFlags: [],
    recommendationScore: 5,
    recommendationSummary: '',
    hedgingLevel: 'medium',
    sourceQuality: 'none',
    responseRecency: 'unknown',
  }

  // Skip if response is empty or too short
  if (!response || response.length < 100) {
    return defaultResult
  }

  const prompt = `Analyze this AI response about "${companyName}" as an employer. Extract insights in the exact format below.

RESPONSE:
"""
${response.slice(0, 2500)}
"""

Analyze and respond with EXACTLY this format (one item per line):

POSITIVE_HIGHLIGHTS: [list 2-4 specific positive facts/phrases, comma-separated, or "none"]
NEGATIVE_HIGHLIGHTS: [list 2-4 specific concerns/issues mentioned, comma-separated, or "none"]
RED_FLAGS: [serious warnings like layoffs, toxic culture, discrimination - comma-separated, or "none"]
GREEN_FLAGS: [strong positives like rapid growth, innovation, great benefits - comma-separated, or "none"]
RECOMMENDATION_SCORE: [1-10, would AI recommend this employer to job seekers?]
RECOMMENDATION_SUMMARY: [one sentence: who is this employer good/bad for?]
HEDGING_LEVEL: [low/medium/high - how much uncertain language like "might", "possibly", "some say"?]
SOURCE_QUALITY: [none/weak/moderate/strong - does it cite specific sources, reviews, or data?]
RESPONSE_RECENCY: [current/recent/dated/unknown - does info seem current or outdated?]`

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxOutputTokens: 500,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'enhanced_analysis',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse response
    const lines = result.text.split('\n')
    const analysis = { ...defaultResult }

    for (const line of lines) {
      const parseList = (value: string): string[] => {
        if (!value || value.toLowerCase() === 'none') return []
        return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      }

      if (line.startsWith('POSITIVE_HIGHLIGHTS:')) {
        analysis.positiveHighlights = parseList(line.replace('POSITIVE_HIGHLIGHTS:', '').trim())
      } else if (line.startsWith('NEGATIVE_HIGHLIGHTS:')) {
        analysis.negativeHighlights = parseList(line.replace('NEGATIVE_HIGHLIGHTS:', '').trim())
      } else if (line.startsWith('RED_FLAGS:')) {
        analysis.redFlags = parseList(line.replace('RED_FLAGS:', '').trim())
      } else if (line.startsWith('GREEN_FLAGS:')) {
        analysis.greenFlags = parseList(line.replace('GREEN_FLAGS:', '').trim())
      } else if (line.startsWith('RECOMMENDATION_SCORE:')) {
        const scoreMatch = line.match(/(\d+)/)
        if (scoreMatch) {
          analysis.recommendationScore = Math.min(10, Math.max(1, parseInt(scoreMatch[1], 10)))
        }
      } else if (line.startsWith('RECOMMENDATION_SUMMARY:')) {
        analysis.recommendationSummary = line.replace('RECOMMENDATION_SUMMARY:', '').trim()
      } else if (line.startsWith('HEDGING_LEVEL:')) {
        const level = line.replace('HEDGING_LEVEL:', '').trim().toLowerCase()
        if (['low', 'medium', 'high'].includes(level)) {
          analysis.hedgingLevel = level as 'low' | 'medium' | 'high'
        }
      } else if (line.startsWith('SOURCE_QUALITY:')) {
        const quality = line.replace('SOURCE_QUALITY:', '').trim().toLowerCase()
        if (['none', 'weak', 'moderate', 'strong'].includes(quality)) {
          analysis.sourceQuality = quality as 'none' | 'weak' | 'moderate' | 'strong'
        }
      } else if (line.startsWith('RESPONSE_RECENCY:')) {
        const recency = line.replace('RESPONSE_RECENCY:', '').trim().toLowerCase()
        if (['current', 'recent', 'dated', 'unknown'].includes(recency)) {
          analysis.responseRecency = recency as 'current' | 'recent' | 'dated' | 'unknown'
        }
      }
    }

    return analysis
  } catch (error) {
    console.error('Enhanced analysis failed:', error)
    return defaultResult
  }
}

// Platform weights (same as outrankllm for now)
const PLATFORMS = ['chatgpt', 'claude', 'gemini', 'perplexity'] as const

// HiringBrand report expiry (days)
const HB_REPORT_EXPIRY_DAYS = 30

/**
 * Calculate role family scores from tagged responses
 * Returns desirability and awareness scores per family
 */
function calculateRoleFamilyScores(
  responses: Array<{ job_family: string | null; sentiment_score: number | null; specificity_score: number | null; confidence_score: number | null }>,
  activeFamilies: JobFamily[]
): Record<string, { desirability: number; awareness: number }> {
  const scores: Record<string, { desirability: number; awareness: number }> = {}

  for (const family of activeFamilies) {
    // Filter responses for this family
    const familyResponses = responses.filter(r => r.job_family === family)

    if (familyResponses.length === 0) {
      scores[family] = { desirability: 0, awareness: 0 }
      continue
    }

    // Calculate desirability (avg sentiment score, scaled 0-100)
    const sentimentScores = familyResponses
      .map(r => r.sentiment_score)
      .filter((s): s is number => s !== null)

    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, s) => sum + s, 0) / sentimentScores.length
      : 5

    const desirability = Math.round(((avgSentiment - 1) / 9) * 100) // Scale 1-10 to 0-100

    // Calculate awareness (avg of specificity + confidence, scaled 0-100)
    const specificityScores = familyResponses
      .map(r => r.specificity_score)
      .filter((s): s is number => s !== null)

    const confidenceScores = familyResponses
      .map(r => r.confidence_score)
      .filter((s): s is number => s !== null)

    const avgSpecificity = specificityScores.length > 0
      ? specificityScores.reduce((sum, s) => sum + s, 0) / specificityScores.length
      : 5

    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, s) => sum + s, 0) / confidenceScores.length
      : 5

    const awareness = Math.round((((avgSpecificity + avgConfidence) / 2) - 1) / 9 * 100) // Scale to 0-100

    scores[family] = {
      desirability: Math.max(0, Math.min(100, desirability)),
      awareness: Math.max(0, Math.min(100, awareness)),
    }
  }

  return scores
}

export const processHiringBrandScan = inngest.createFunction(
  {
    id: 'process-hiringbrand-scan',
    retries: 3,
    timeouts: { finish: '12m' },
    cancelOn: [{ event: 'hiringbrand/scan', match: 'data.monitoredDomainId' }],
  },
  { event: 'hiringbrand/scan' },
  async ({ event, step }) => {
    const { domain, organizationId, monitoredDomainId } = event.data
    const startTime = Date.now()

    // Step 1: Setup - create scan run record
    const { scanId } = await step.run('setup-scan', async () => {
      const supabase = createServiceClient()

      // Create scan run for HiringBrand (linked to organization, not lead)
      const { data, error } = await supabase
        .from('scan_runs')
        .insert({
          organization_id: organizationId,
          monitored_domain_id: monitoredDomainId,
          domain,
          status: 'crawling',
          progress: 5,
          brand: 'hiringbrand',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) throw new Error(`Failed to create scan run: ${error.message}`)
      return { scanId: data.id }
    })

    log.start(scanId, `[HB] ${domain}`)

    // Step 2: Crawl the site (focus on careers pages)
    const crawlResult = await step.run('crawl-site', async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, 'crawling', 10)

      log.step(scanId, 'Crawling', domain)
      // TODO: Consider adding careers-focused crawl mode
      const result = await crawlSite(domain)
      log.done(scanId, 'Crawl', `${result.totalPages} pages`)

      return result
    })

    // Step 3: Extract employer analysis from crawled content
    const employerAnalysis = await step.run('analyze-employer', async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, 'analyzing', 25)

      const combinedContent = combineCrawledContent(crawlResult)

      // Extract employer-specific info
      const analysis = extractEmployerAnalysis(combinedContent, domain, crawlResult)

      // Detect geography
      const geoResult = detectGeography(domain, combinedContent, analysis.location)

      // Classify job families from commonRoles
      log.step(scanId, 'Classifying job families')
      const { data: orgData } = await supabase
        .from('organizations')
        .select('max_role_families')
        .eq('id', organizationId)
        .single()

      const maxFamilies = orgData?.max_role_families || 5
      let detectedFamilies = await classifyJobFamilies(
        analysis.commonRoles || [],
        analysis.industry,
        maxFamilies,
        scanId
      )

      // Apply industry fallback if no families detected (empty commonRoles)
      if (detectedFamilies.length === 0) {
        const industry = analysis.industry?.toLowerCase() || ''
        let fallbackFamilies: JobFamily[] = []

        if (industry.includes('tech') || industry.includes('software')) {
          fallbackFamilies = ['engineering', 'business', 'corporate']
          log.info(scanId, 'No roles detected - using tech industry fallback: engineering, business, corporate')
        } else if (industry.includes('retail') || industry.includes('consumer')) {
          fallbackFamilies = ['operations', 'business', 'corporate']
          log.info(scanId, 'No roles detected - using retail industry fallback: operations, business, corporate')
        } else {
          fallbackFamilies = ['business', 'operations', 'corporate']
          log.info(scanId, 'No roles detected - using general industry fallback: business, operations, corporate')
        }

        // Convert to DetectedJobFamily format
        const { hbRoleFamilyConfig } = await import('@/app/hiringbrand/report/components/shared/constants')
        detectedFamilies = fallbackFamilies.map(family => ({
          family,
          label: hbRoleFamilyConfig[family].label,
          roles: [],
          relevance: 0.7, // Medium relevance for industry defaults
        }))
      }

      log.info(scanId, `Detected ${detectedFamilies.length} job families: ${detectedFamilies.map(f => f.family).join(', ')}`)

      // Save analysis (including detected families)
      await supabase.from('site_analyses').upsert(
        {
          run_id: scanId,
          business_type: analysis.industry || 'Employer',
          business_name: analysis.companyName,
          location: geoResult.location || analysis.location,
          raw_content: combinedContent.slice(0, 50000),
          tld_country: geoResult.tldCountry,
          detected_country: geoResult.country,
          geo_confidence: geoResult.confidence,
          // HiringBrand-specific fields (stored in existing columns)
          services: analysis.commonRoles || [], // Repurpose for roles
          key_phrases: analysis.cultureKeywords || [],
          detected_job_families: detectedFamilies, // NEW: Store detected families
        },
        { onConflict: 'run_id' }
      )

      log.done(scanId, 'Analysis', analysis.companyName)

      return {
        analysis: {
          ...analysis,
          location: geoResult.location || analysis.location,
        },
        geoResult,
        detectedFamilies,
      }
    })

    // Fetch reliable company name from monitored_domains (crawl extraction can be wrong)
    const reliableCompanyName = await step.run('get-company-name', async () => {
      const supabase = createServiceClient()
      const { data: md } = await supabase
        .from('monitored_domains')
        .select('company_name')
        .eq('id', monitoredDomainId)
        .single()
      return md?.company_name || employerAnalysis.analysis.companyName
    })

    // Step 4a: Check for frozen questions, competitors, and role families (for consistent refreshes)
    const frozenResult = await step.run('check-frozen-data', async () => {
      const supabase = createServiceClient()

      // Check for frozen questions (include job_family for legacy compatibility)
      const { data: frozenQuestions } = await supabase
        .from('hb_frozen_questions')
        .select('id, prompt_text, category, job_family')
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order')

      // Check for frozen competitors
      const { data: frozenCompetitors } = await supabase
        .from('hb_frozen_competitors')
        .select('id, name, domain, reason')
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order')

      // Check for frozen role families
      const { data: frozenRoleFamilies } = await supabase
        .from('hb_frozen_role_families')
        .select('id, family, display_name, description, source')
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order')

      const hasFrozenData = (frozenQuestions && frozenQuestions.length > 0) ||
                            (frozenCompetitors && frozenCompetitors.length > 0) ||
                            (frozenRoleFamilies && frozenRoleFamilies.length > 0)

      if (hasFrozenData) {
        log.info(scanId, `Using frozen data: ${frozenQuestions?.length || 0} questions, ${frozenCompetitors?.length || 0} competitors, ${frozenRoleFamilies?.length || 0} role families`)
      }

      return {
        hasFrozenData,
        questions: frozenQuestions || [],
        competitors: (frozenCompetitors || []).map((c: { name: string; domain: string | null; reason: string | null }) => ({
          name: c.name,
          domain: c.domain,
          reason: c.reason || '',
        })),
        roleFamilies: (frozenRoleFamilies || []).map((rf: { family: string }) => rf.family as JobFamily),
      }
    })

    // Step 4b: Research employer OR use frozen data
    const researchResult = await step.run('research-employer', async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, 'researching', 35)

      // If we have frozen data, use it (and supplement with role-specific questions if needed)
      if (frozenResult.hasFrozenData) {
        log.step(scanId, 'Using frozen questions and competitors')

        // Map frozen competitors to CompetitorEmployer format
        const competitors: CompetitorEmployer[] = frozenResult.competitors.map((c: { name: string; domain: string | null; reason: string }) => ({
          name: c.name,
          domain: c.domain,
          reason: c.reason,
        }))

        // Check if frozen questions have NULL job_family (legacy questions from before role family support)
        const hasLegacyQuestions = frozenResult.questions.some((q: any) => q.job_family === null || q.job_family === undefined)

        let allQuestions = [...frozenResult.questions]
        let roleSpecificQuestions: any[] = []

        // If there are no frozen questions OR frozen questions are legacy (no job_family), generate role-specific questions
        if (frozenResult.questions.length === 0 || hasLegacyQuestions) {
          if (frozenResult.questions.length === 0) {
            log.info(scanId, 'No frozen questions found - generating role-specific questions')
          } else {
            log.info(scanId, 'Frozen questions are legacy (no job_family) - generating role-specific questions')
          }

          // Determine active job families
          let activeFamilies: JobFamily[] = frozenResult.roleFamilies && frozenResult.roleFamilies.length > 0
            ? frozenResult.roleFamilies
            : employerAnalysis.detectedFamilies.map(f => f.family)

          // Fallback: If no families detected (empty commonRoles), use industry-based defaults
          if (activeFamilies.length === 0) {
            const industry = employerAnalysis.analysis.industry?.toLowerCase() || ''
            if (industry.includes('tech') || industry.includes('software')) {
              activeFamilies = ['engineering', 'business', 'corporate']
              log.info(scanId, 'No roles detected - using tech industry defaults: engineering, business, corporate')
            } else if (industry.includes('retail') || industry.includes('consumer')) {
              activeFamilies = ['operations', 'business', 'corporate']
              log.info(scanId, 'No roles detected - using retail industry defaults: operations, business, corporate')
            } else {
              activeFamilies = ['business', 'operations', 'corporate']
              log.info(scanId, 'No roles detected - using general defaults: business, operations, corporate')
            }
          }

          // Check if frozen questions already include role-specific questions
          const hasFrozenRoleQuestions = frozenResult.questions.some((q: any) => q.job_family)

          if (activeFamilies.length > 0 && !hasFrozenRoleQuestions) {
            log.info(scanId, `Generating role-specific questions for: ${activeFamilies.join(', ')}`)

            // Generate 1-2 role-specific questions per family
            const { generateRoleFamilyQuestions } = await import('@/lib/ai/employer-research')
            const generatedQuestions = generateRoleFamilyQuestions(
              { ...employerAnalysis.analysis, companyName: reliableCompanyName },
              activeFamilies,
              competitors
            )

            // Convert to frozen question format
            roleSpecificQuestions = generatedQuestions.map((q: any) => ({
              prompt_text: q.question,
              category: q.category,
              job_family: q.jobFamily,
            }))

            allQuestions = [...frozenResult.questions, ...roleSpecificQuestions]
            log.info(scanId, `Added ${roleSpecificQuestions.length} role-specific questions to ${frozenResult.questions.length} frozen questions`)
          } else if (hasFrozenRoleQuestions) {
            // Frozen questions already contain role-specific questions - use them as-is
            allQuestions = frozenResult.questions
            log.info(scanId, `Using ${frozenResult.questions.length} frozen questions (including role-specific questions)`)
          }
        }

        // Save questions to scan_prompts and capture IDs
        // Check if prompts already exist for this run (Inngest step retries can cause duplicates)
        const { data: existingPrompts } = await supabase
          .from('scan_prompts')
          .select('id, prompt_text, category, job_family')
          .eq('run_id', scanId)

        const questionsWithPromptIds: Array<{ question: string; category: string; promptId: string; jobFamily?: string | null }> = []

        if (existingPrompts && existingPrompts.length > 0) {
          // Prompts already exist from a previous attempt — reuse them
          for (const ep of existingPrompts) {
            questionsWithPromptIds.push({
              question: ep.prompt_text,
              category: ep.category,
              promptId: ep.id,
              jobFamily: (ep as any).job_family || null,
            })
          }
        } else {
          for (const q of allQuestions) {
            const { data: insertedPrompt } = await supabase
              .from('scan_prompts')
              .insert({
                run_id: scanId,
                prompt_text: q.prompt_text,
                category: q.category,
                source: 'frozen',
                job_family: (q as any).job_family || null,
              })
              .select('id')
              .single()

            if (insertedPrompt) {
              questionsWithPromptIds.push({
                question: q.prompt_text,
                category: q.category,
                promptId: insertedPrompt.id,
                jobFamily: (q as any).job_family || null,
              })
            }
          }
        }

        // Freeze role families if we have role-specific questions
        const hasRoleQuestions = allQuestions.some((q: any) => q.job_family)
        if (hasRoleQuestions) {
          const { count: existingFrozenRF } = await supabase
            .from('hb_frozen_role_families')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('monitored_domain_id', monitoredDomainId)
            .eq('is_active', true)

          if (!existingFrozenRF || existingFrozenRF === 0) {
            // Extract unique role families from questions
            const uniqueFamilies = Array.from(
              new Set(
                allQuestions
                  .filter((q: any) => q.job_family)
                  .map((q: any) => q.job_family as JobFamily)
              )
            )

            if (uniqueFamilies.length > 0) {
              log.info(scanId, `Freezing ${uniqueFamilies.length} role families for future scans`)

              const familyDisplayNames: Record<JobFamily, { displayName: string; description: string }> = {
                engineering: { displayName: 'Engineering & Tech', description: 'Software engineers, data scientists, DevOps, IT' },
                business: { displayName: 'Sales & Business', description: 'Sales, marketing, product management, customer success' },
                operations: { displayName: 'Operations & Supply Chain', description: 'Operations, logistics, supply chain, procurement' },
                creative: { displayName: 'Creative & Design', description: 'Designers, content creators, UX/UI, brand' },
                corporate: { displayName: 'Corporate Functions', description: 'Finance, HR, legal, administration' },
                general: { displayName: 'General', description: 'General roles across all functions' },
              }

              await supabase.from('hb_frozen_role_families').insert(
                uniqueFamilies.map((family, i) => ({
                  organization_id: organizationId,
                  monitored_domain_id: monitoredDomainId,
                  family,
                  display_name: familyDisplayNames[family].displayName,
                  description: familyDisplayNames[family].description,
                  source: 'employer_research',
                  sort_order: i,
                }))
              )
            }
          }
        }

        log.done(scanId, 'Research (frozen)', `${competitors.length} competitors, ${questionsWithPromptIds.length} questions (${frozenResult.questions.length} frozen + ${roleSpecificQuestions.length} role-specific)`)

        return {
          competitors,
          questions: allQuestions.map((q: { prompt_text: string; category: string; job_family?: string | null }) => ({
            question: q.prompt_text,
            category: q.category,
            suggestedBy: [] as ('chatgpt' | 'claude' | 'gemini')[],
            relevanceScore: 10,
            jobFamily: (q as any).job_family || null,
          })),
          questionsWithPromptIds,
          usedFrozenData: true,
        }
      }

      // No frozen data - do fresh research
      log.step(scanId, 'Researching employer', reliableCompanyName)

      // Determine active job families (frozen or detected)
      const activeFamilies: JobFamily[] = frozenResult.roleFamilies && frozenResult.roleFamilies.length > 0
        ? frozenResult.roleFamilies
        : employerAnalysis.detectedFamilies.map(f => f.family)

      log.info(scanId, `Active job families: ${activeFamilies.join(', ')}`)

      // Research with role-specific questions
      const result = await researchEmployerWithRoles(
        { ...employerAnalysis.analysis, companyName: reliableCompanyName },
        activeFamilies,
        scanId,
        (platform, status) => {
          log.platform(scanId, platform, status)
        }
      )

      // Save competitors to monitored_domains as non-primary (competitors)
      if (result.competitors.length > 0 && organizationId) {
        for (const comp of result.competitors) {
          // Upsert competitor - don't fail if already exists
          await supabase.from('monitored_domains').upsert(
            {
              organization_id: organizationId,
              domain: comp.domain || comp.name.toLowerCase().replace(/\s+/g, '') + '.com',
              company_name: comp.name,
              is_primary: false, // Competitor, doesn't count against limit
            },
            { onConflict: 'organization_id,domain', ignoreDuplicates: true }
          )
        }
      }

      // Save research results and capture prompt IDs
      // Check if prompts already exist for this run (Inngest step retries can cause duplicates)
      const { data: existingResearchPrompts } = await supabase
        .from('scan_prompts')
        .select('id, prompt_text, category, job_family')
        .eq('run_id', scanId)

      const questionsWithPromptIds: Array<{ question: string; category: string; promptId: string; jobFamily?: string | null }> = []

      if (existingResearchPrompts && existingResearchPrompts.length > 0) {
        for (const ep of existingResearchPrompts) {
          questionsWithPromptIds.push({
            question: ep.prompt_text,
            category: ep.category,
            promptId: ep.id,
            jobFamily: (ep as any).job_family || null,
          })
        }
      } else {
        for (const q of result.questions) {
          const { data: insertedPrompt } = await supabase
            .from('scan_prompts')
            .insert({
              run_id: scanId,
              prompt_text: q.question,
              category: q.category,
              source: 'employer_research',
              job_family: (q as any).jobFamily || null,
            })
            .select('id')
            .single()

          if (insertedPrompt) {
            questionsWithPromptIds.push({
              question: q.question,
              category: q.category,
              promptId: insertedPrompt.id,
              jobFamily: (q as any).jobFamily || null,
            })
          }
        }
      }

      // Freeze the research results for future scans
      // Check if frozen data already exists (Inngest retries can re-execute this code)
      const { count: existingFrozenQ } = await supabase
        .from('hb_frozen_questions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)

      if (result.questions.length > 0 && (!existingFrozenQ || existingFrozenQ === 0)) {
        log.info(scanId, 'Freezing questions for future scans')
        await supabase.from('hb_frozen_questions').insert(
          result.questions.map((q, i) => ({
            organization_id: organizationId,
            monitored_domain_id: monitoredDomainId,
            prompt_text: q.question,
            category: q.category,
            job_family: (q as any).jobFamily || null,
            source: 'employer_research',
            sort_order: i,
          }))
        )
      }

      const { count: existingFrozenC } = await supabase
        .from('hb_frozen_competitors')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)

      if (result.competitors.length > 0 && (!existingFrozenC || existingFrozenC === 0)) {
        log.info(scanId, 'Freezing competitors for future scans')
        await supabase.from('hb_frozen_competitors').insert(
          result.competitors.map((c, i) => ({
            organization_id: organizationId,
            monitored_domain_id: monitoredDomainId,
            name: c.name,
            domain: c.domain,
            reason: c.reason,
            sort_order: i,
          }))
        )
      }

      // Freeze role families for future scans
      const { count: existingFrozenRF } = await supabase
        .from('hb_frozen_role_families')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('monitored_domain_id', monitoredDomainId)
        .eq('is_active', true)

      if (activeFamilies.length > 0 && (!existingFrozenRF || existingFrozenRF === 0)) {
        log.info(scanId, 'Freezing role families for future scans')

        const familyDisplayNames: Record<JobFamily, { displayName: string; description: string }> = {
          engineering: { displayName: 'Engineering & Tech', description: 'Software engineers, data scientists, DevOps, IT' },
          business: { displayName: 'Sales & Business', description: 'Sales, marketing, product management, customer success' },
          operations: { displayName: 'Operations & Supply Chain', description: 'Operations, logistics, supply chain, procurement' },
          creative: { displayName: 'Creative & Design', description: 'Designers, content creators, UX/UI, brand' },
          corporate: { displayName: 'Corporate Functions', description: 'Finance, HR, legal, administration' },
          general: { displayName: 'General', description: 'General roles across all functions' },
        }

        await supabase.from('hb_frozen_role_families').insert(
          activeFamilies.map((family, i) => ({
            organization_id: organizationId,
            monitored_domain_id: monitoredDomainId,
            family,
            display_name: familyDisplayNames[family].displayName,
            description: familyDisplayNames[family].description,
            source: 'employer_research',
            sort_order: i,
          }))
        )
      }

      log.done(
        scanId,
        'Research',
        `${result.competitors.length} competitors, ${result.questions.length} questions, ${activeFamilies.length} role families (frozen for future)`
      )

      return { ...result, questionsWithPromptIds, usedFrozenData: false }
    })

    // Use fallback if research failed - create prompts for fallback questions too
    let questions: Array<{ question: string; category: string; promptId: string; jobFamily?: string | null }>
    if (researchResult.questionsWithPromptIds.length > 0) {
      questions = researchResult.questionsWithPromptIds
    } else {
      // Fallback questions - need to save them too
      // Check if prompts already exist (Inngest replays can cause this code to re-execute)
      const supabase = createServiceClient()
      const { data: existingFallbackPrompts } = await supabase
        .from('scan_prompts')
        .select('id, prompt_text, category, job_family')
        .eq('run_id', scanId)

      if (existingFallbackPrompts && existingFallbackPrompts.length > 0) {
        questions = existingFallbackPrompts.map((ep: { id: string; prompt_text: string; category: string; job_family?: string | null }) => ({
          question: ep.prompt_text,
          category: ep.category,
          promptId: ep.id,
          jobFamily: ep.job_family || null,
        }))
      } else {
        // Get job families for fallback questions
        const jobFamilies = employerAnalysis.detectedFamilies?.map(f => f.family) || []

        const fallbackQuestions = generateFallbackEmployerQuestions(
          { ...employerAnalysis.analysis, companyName: reliableCompanyName },
          researchResult.competitors,
          jobFamilies
        )
        questions = []
        for (const q of fallbackQuestions) {
          const { data: insertedPrompt } = await supabase
            .from('scan_prompts')
            .insert({
              run_id: scanId,
              prompt_text: q.question,
              category: q.category,
              source: 'fallback',
              job_family: q.jobFamily || null,
            })
            .select('id')
            .single()

          if (insertedPrompt) {
            questions.push({
              question: q.question,
              category: q.category,
              promptId: insertedPrompt.id,
              jobFamily: q.jobFamily || null,
            })
          }
        }

        // Also freeze fallback questions if this is the first scan
        if (!researchResult.usedFrozenData && questions.length > 0) {
          log.info(scanId, 'Freezing fallback questions for future scans')
          await supabase.from('hb_frozen_questions').insert(
            questions.map((q, i) => ({
              organization_id: organizationId,
              monitored_domain_id: monitoredDomainId,
              prompt_text: q.question,
              category: q.category,
              job_family: q.jobFamily || null,
              source: 'fallback',
              sort_order: i,
            }))
          )
        }
      }
    }

    // Build location context
    const locationContext: LocationContext = {
      location: employerAnalysis.analysis.location || undefined,
      city: employerAnalysis.geoResult.city || undefined,
      country: employerAnalysis.geoResult.country || undefined,
      countryCode: countryToIsoCode(employerAnalysis.geoResult.country) || undefined,
    }

    // Step 5: Query platforms with employer questions
    // Query each platform in parallel, with batched parallelism within each platform
    // Perplexity gets individual steps per query (sonar-pro web search is slow/flaky)
    const BATCH_SIZE = 3 // Process 3 questions at a time per platform to avoid rate limits

    type QuestionResult = {
      question: string
      result: PlatformResult
      responseId?: string
      researchability?: ResearchabilityAnalysis
    }

    // Helper: process a single question for a platform (query + analysis + save)
    const processQuestion = async (
      platform: typeof PLATFORMS[number],
      q: typeof questions[number],
    ): Promise<QuestionResult> => {
      const supabase = createServiceClient()
      try {
        const queryResult = await queryPlatformWithSearch(
          platform,
          q.question,
          domain,
          scanId,
          locationContext
        )

        // Analyze researchability and enhanced insights in parallel
        // (Sentiment will be done in batch after all responses collected)
        const [researchability, enhanced] = await Promise.all([
          analyzeResearchability(queryResult.response, reliableCompanyName, scanId),
          analyzeResponseEnhanced(queryResult.response, reliableCompanyName, scanId),
        ])

        // Save response WITHOUT sentiment (will be updated in batch)
        const { data: inserted } = await supabase.from('llm_responses').insert({
          run_id: scanId,
          platform,
          prompt_id: q.promptId, // Link to the question
          response_text: queryResult.response,
          domain_mentioned: queryResult.domainMentioned,
          mention_position: queryResult.mentionPosition,
          competitors_mentioned: queryResult.competitorsMentioned,
          response_time_ms: queryResult.responseTimeMs,
          error_message: queryResult.error,
          search_enabled: queryResult.searchEnabled,
          sources: queryResult.sources,
          // Sentiment will be updated via batch analysis
          sentiment_score: null,
          sentiment_category: null,
          // Researchability
          specificity_score: researchability.specificityScore,
          confidence_score: researchability.confidenceScore,
          topics_covered: researchability.topicsCovered,
          // Enhanced analysis - key phrases
          positive_highlights: enhanced.positiveHighlights,
          negative_highlights: enhanced.negativeHighlights,
          red_flags: enhanced.redFlags,
          green_flags: enhanced.greenFlags,
          // Enhanced analysis - recommendation
          recommendation_score: enhanced.recommendationScore,
          recommendation_summary: enhanced.recommendationSummary,
          // Enhanced analysis - confidence
          hedging_level: enhanced.hedgingLevel,
          source_quality: enhanced.sourceQuality,
          response_recency: enhanced.responseRecency,
          // Role family (from question)
          job_family: (q as { jobFamily?: JobFamily }).jobFamily || null,
        }).select('id').single()

        return {
          question: q.question,
          result: queryResult,
          responseId: inserted?.id,
          researchability,
        }
      } catch (error) {
        const errorResult: PlatformResult = {
          platform,
          query: q.question,
          response: '',
          domainMentioned: false,
          mentionPosition: null,
          competitorsMentioned: [],
          responseTimeMs: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          searchEnabled: true,
          sources: [],
        }
        return { question: q.question, result: errorResult }
      }
    }

    // All platforms run in parallel via Inngest DAG
    // Perplexity: Individual steps per query (sonar-pro web search can be slow/flaky)
    // Other platforms: Single step per platform (batched parallelism within each step)
    const otherPlatforms = PLATFORMS.filter(p => p !== 'perplexity')

    const [perplexityResults, ...otherPlatformResults] = await Promise.all([
      // Perplexity: individual steps per query
      Promise.all(
        questions.map((q, i) =>
          step.run(`query-perplexity-${i}`, () => processQuestion('perplexity', q))
        )
      ),
      // Other platforms: single step per platform
      ...otherPlatforms.map((platform) =>
        step.run(`query-${platform}`, async () => {
          log.platform(scanId, platform, 'querying')

          const results: QuestionResult[] = []

          // Process questions in parallel batches
          for (let i = 0; i < questions.length; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE)
            const batchResults = await Promise.all(
              batch.map((q) => processQuestion(platform, q))
            )
            results.push(...batchResults)
          }

          log.done(scanId, platform, `${results.length} responses`)
          return results
        })
      ),
    ])

    const platformResults = [perplexityResults, ...otherPlatformResults]

    // Step 5b: Batch sentiment analysis using Claude
    // Collect all responses and analyze them together for consistent scoring
    const sentimentResults = await step.run('batch-sentiment-analysis', async () => {
      const supabase = createServiceClient()
      log.step(scanId, 'Running batch sentiment analysis with Claude')

      // Collect all responses for batch analysis
      const responsesForSentiment: ResponseForSentiment[] = []
      for (const platformResult of platformResults) {
        for (const item of platformResult) {
          const typedItem = item as unknown as {
            question: string
            result: PlatformResult
            responseId?: string
            researchability?: ResearchabilityAnalysis
          }
          if (typedItem.responseId && typedItem.result.response) {
            responsesForSentiment.push({
              id: typedItem.responseId,
              platform: typedItem.result.platform,
              question: typedItem.question,
              response: typedItem.result.response,
            })
          }
        }
      }

      // Run batch sentiment analysis with Claude
      const sentimentMap = await batchAnalyzeSentiment(
        responsesForSentiment,
        reliableCompanyName,
        scanId
      )

      // Update all responses with sentiment scores and driving phrases
      for (const [responseId, sentiment] of sentimentMap) {
        await supabase
          .from('llm_responses')
          .update({
            sentiment_score: sentiment.score,
            sentiment_category: sentiment.category,
            sentiment_positive_phrases: sentiment.positivePhrases,
            sentiment_negative_phrases: sentiment.negativePhrases,
          })
          .eq('id', responseId)
      }

      log.done(scanId, 'sentiment', `${sentimentMap.size} responses analyzed`)

      // Return as serializable object
      return Object.fromEntries(sentimentMap)
    })

    // Combine results for scoring (including sentiment and researchability)
    // Cast needed because Inngest serializes step results (loses type info)
    type SentimentData = { score: number; category: SentimentCategory }
    type ResearchabilityData = {
      specificityScore: number
      confidenceScore: number
      topicsCovered: string[]
    }
    type ResultWithAnalysis = {
      result: PlatformResult
      responseId?: string
      sentiment?: SentimentData
      researchability?: ResearchabilityData
    }
    const allResultsWithAnalysis: Array<{ promptId: string; results: ResultWithAnalysis[] }> = []
    for (let i = 0; i < questions.length; i++) {
      const promptResults: ResultWithAnalysis[] = []
      for (const platformResult of platformResults) {
        if (platformResult[i]) {
          // Cast the serialized result back to proper types
          const item = platformResult[i] as unknown as {
            question: string
            result: PlatformResult
            responseId?: string
            researchability?: ResearchabilityData
          }
          // Get sentiment from batch results
          const sentiment = item.responseId ? sentimentResults[item.responseId] : undefined
          promptResults.push({
            result: item.result,
            responseId: item.responseId,
            sentiment: sentiment as SentimentData | undefined,
            researchability: item.researchability,
          })
        }
      }
      allResultsWithAnalysis.push({ promptId: `q-${i}`, results: promptResults })
    }

    // Also create allResults without analysis for competitor extraction
    const allResults = allResultsWithAnalysis.map(({ promptId, results }) => ({
      promptId,
      results: results.map((r) => r.result),
    }))

    // Step 6: Calculate scores and generate report
    const report = await step.run('finalize-report', async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, 'analyzing', 70)

      log.step(scanId, 'Calculating employer reputation scores (sentiment-based)')

      // Calculate sentiment-based reputation score
      // Collect all sentiments by platform
      const platformSentiments: Record<string, { scores: number[]; categories: string[] }> = {
        chatgpt: { scores: [], categories: [] },
        claude: { scores: [], categories: [] },
        gemini: { scores: [], categories: [] },
        perplexity: { scores: [], categories: [] },
      }

      for (const { results } of allResultsWithAnalysis) {
        for (const { result, sentiment } of results) {
          if (sentiment && platformSentiments[result.platform]) {
            platformSentiments[result.platform].scores.push(sentiment.score)
            platformSentiments[result.platform].categories.push(sentiment.category)
          }
        }
      }

      // Count sentiment categories (4-tier system: Strong 9-10, Positive 6-8, Mixed 4-5, Negative 1-3)
      const countCategories = (categories: string[]) => ({
        strong: categories.filter((c) => c === 'strong').length,
        positive: categories.filter((c) => c === 'positive').length,
        mixed: categories.filter((c) => c === 'mixed').length,
        negative: categories.filter((c) => c === 'negative').length,
      })

      // Calculate sentiment-based scores per platform (0-100 scale) with category weighting
      // Base: normalized average. Then apply bonuses/penalties based on distribution.
      const calculatePlatformSentimentScore = (scores: number[], categories: string[]): number => {
        if (scores.length === 0) return 50 // Default neutral

        // Base score: normalized average (0-100)
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        let baseScore = ((avg - 1) / 9) * 100

        // Category-based adjustments (asymmetric: negatives hurt more than positives help)
        const counts = countCategories(categories)
        const total = categories.length

        // Strong bonus: +5 points per Strong response (as % of total)
        // Strong responses are rare (9-10) and indicate enthusiastic recommendation
        const strongBonus = total > 0 ? (counts.strong / total) * 15 : 0

        // Negative penalty: -8 points per Negative response (as % of total)
        // Negatives hurt more because job seekers weigh bad reviews heavily
        const negativePenalty = total > 0 ? (counts.negative / total) * 25 : 0

        const adjustedScore = baseScore + strongBonus - negativePenalty
        return Math.round(Math.min(100, Math.max(0, adjustedScore)))
      }

      // Platform weights for overall score (based on AI market share)
      const platformWeights: Record<string, number> = {
        chatgpt: 10,  // ~60% market share
        claude: 1,    // ~5% market share
        gemini: 2,    // ~8% market share
        perplexity: 4, // ~15% market share
      }
      const totalWeight = 17

      // Calculate weighted overall score
      let weightedSum = 0
      for (const [platform, weight] of Object.entries(platformWeights)) {
        const platformScore = calculatePlatformSentimentScore(
          platformSentiments[platform].scores,
          platformSentiments[platform].categories
        )
        weightedSum += (platformScore * weight) / 100
      }
      const overallScore = Math.round((weightedSum / totalWeight) * 100)

      // Aggregate sentiment counts
      const allCategories = Object.values(platformSentiments).flatMap((p) => p.categories)
      const sentimentCounts = countCategories(allCategories)

      // Calculate researchability scores
      // Collect researchability data
      const allResearchability: {
        specificityScores: number[]
        confidenceScores: number[]
        topicsCovered: Set<string>
      } = {
        specificityScores: [],
        confidenceScores: [],
        topicsCovered: new Set(),
      }

      for (const { results } of allResultsWithAnalysis) {
        for (const { researchability } of results) {
          if (researchability) {
            allResearchability.specificityScores.push(researchability.specificityScore)
            allResearchability.confidenceScores.push(researchability.confidenceScore)
            researchability.topicsCovered.forEach((t) => allResearchability.topicsCovered.add(t))
          }
        }
      }

      // Topic coverage: which topics AI knows about vs all possible topics
      const topicsCovered = Array.from(allResearchability.topicsCovered)
      const topicsMissing = EMPLOYER_TOPICS.filter((t) => !allResearchability.topicsCovered.has(t))

      // Calculate researchability (AI Awareness) score with weighted factors:
      // - Topic Coverage: 40% (breadth of knowledge)
      // - Specificity: 35% (depth of knowledge)
      // - Confidence: 25% (certainty of AI's statements)
      const calculateResearchabilityScore = (specificity: number[], confidence: number[]): number => {
        if (specificity.length === 0) return 30 // Default low

        // Factor 1: Topic Coverage (40%) - how many employer topics AI knows about
        const topicCoverageFactor = (topicsCovered.length / EMPLOYER_TOPICS.length) * 100

        // Factor 2: Information Specificity (35%) - concrete details vs vague
        const avgSpecificity = specificity.reduce((a, b) => a + b, 0) / specificity.length
        const specificityFactor = ((avgSpecificity - 1) / 9) * 100

        // Factor 3: Confidence Level (25%) - authoritative vs hedging
        const avgConfidence = confidence.reduce((a, b) => a + b, 0) / confidence.length
        const confidenceFactor = ((avgConfidence - 1) / 9) * 100

        // Weighted average
        const score = Math.round(topicCoverageFactor * 0.4 + specificityFactor * 0.35 + confidenceFactor * 0.25)
        return Math.min(100, Math.max(0, score))
      }

      const researchabilityScore = calculateResearchabilityScore(
        allResearchability.specificityScores,
        allResearchability.confidenceScores
      )

      // Calculate topics with confidence levels
      // Count how many times each topic was mentioned and calculate confidence
      const topicMentionCounts = new Map<string, number>()
      for (const { results } of allResultsWithAnalysis) {
        for (const { researchability } of results) {
          if (researchability?.topicsCovered) {
            for (const topic of researchability.topicsCovered) {
              topicMentionCounts.set(topic, (topicMentionCounts.get(topic) || 0) + 1)
            }
          }
        }
      }

      const totalResponseCount = allResultsWithAnalysis.reduce((sum, r) => sum + r.results.length, 0)
      const topicsWithConfidence = EMPLOYER_TOPICS.map((topic) => {
        const mentions = topicMentionCounts.get(topic) || 0
        const mentionRate = totalResponseCount > 0 ? mentions / totalResponseCount : 0
        let confidence: 'high' | 'medium' | 'low' | 'none'
        if (mentionRate >= 0.5) confidence = 'high' // Mentioned in 50%+ of responses
        else if (mentionRate >= 0.25) confidence = 'medium' // Mentioned in 25-50%
        else if (mentions > 0) confidence = 'low' // Mentioned at least once
        else confidence = 'none'
        return { topic, confidence, mentions }
      })

      // Extract competitor mentions for differentiation analysis
      const competitorMentions = new Map<string, number>()
      for (const { results } of allResults) {
        for (const r of results) {
          for (const comp of r.competitorsMentioned) {
            competitorMentions.set(comp.name, (competitorMentions.get(comp.name) || 0) + 1)
          }
        }
      }
      const competitorNames = [...competitorMentions.keys()]

      // Prepare responses for differentiation analysis
      const responsesForDiff: Array<{ id: string; platform: string; question: string; response: string }> = []
      for (const { results } of allResultsWithAnalysis) {
        for (const item of results) {
          if (item.responseId && item.result.response) {
            responsesForDiff.push({
              id: item.responseId,
              platform: item.result.platform,
              question: '', // Question not stored in result, but not critical for diff analysis
              response: item.result.response,
            })
          }
        }
      }

      // Run batch differentiation analysis with Claude
      log.step(scanId, 'Analyzing employer brand differentiation')
      const diffAnalysis = await batchAnalyzeDifferentiation(
        responsesForDiff,
        reliableCompanyName,
        competitorNames,
        scanId
      )

      // Calculate differentiation score using Claude's analysis
      // Factors: competitor confusion (40%), unique positioning (35%), generic language penalty (25%)
      const calculateDifferentiationScore = (): number => {
        // Factor 1: Competitor Confusion (40%) - lower confusion = higher score
        // Score 1-10 where higher = more confusion, so invert it
        const confusionFactor = ((10 - diffAnalysis.competitorConfusionScore) / 9) * 100

        // Factor 2: Unique Positioning (35%) - higher = better
        const positioningFactor = ((diffAnalysis.uniquePositioningScore - 1) / 9) * 100

        // Factor 3: Generic Language Penalty (25%) - higher generic = lower score
        const genericPenalty = ((10 - diffAnalysis.genericLanguageScore) / 9) * 100

        // Weighted average
        const score = Math.round(confusionFactor * 0.4 + positioningFactor * 0.35 + genericPenalty * 0.25)
        return Math.min(100, Math.max(0, score))
      }

      const differentiationScore = calculateDifferentiationScore()
      log.done(scanId, 'differentiation', `score: ${differentiationScore}, unique attrs: ${diffAnalysis.uniqueAttributes.length}`)

      const scores = {
        // Desirability (sentiment-based with category weighting)
        overallScore, // This is now the "desirability" score
        platformScores: {
          chatgpt: calculatePlatformSentimentScore(platformSentiments.chatgpt.scores, platformSentiments.chatgpt.categories),
          claude: calculatePlatformSentimentScore(platformSentiments.claude.scores, platformSentiments.claude.categories),
          gemini: calculatePlatformSentimentScore(platformSentiments.gemini.scores, platformSentiments.gemini.categories),
          perplexity: calculatePlatformSentimentScore(platformSentiments.perplexity.scores, platformSentiments.perplexity.categories),
        },
        platformSentiments: {
          chatgpt: countCategories(platformSentiments.chatgpt.categories),
          claude: countCategories(platformSentiments.claude.categories),
          gemini: countCategories(platformSentiments.gemini.categories),
          perplexity: countCategories(platformSentiments.perplexity.categories),
        },
        sentimentCounts,
        totalResponses: allCategories.length,
        // Researchability (AI Awareness)
        researchabilityScore,
        topicsCovered,
        topicsMissing,
        topicsWithConfidence,
        // Differentiation
        differentiationScore,
      }

      // Extract top competitors from the already-populated competitorMentions map
      const topCompetitors = [...competitorMentions.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))

      // Generate employer-focused summary
      const summary = generateEmployerSummary(
        employerAnalysis.analysis,
        scores,
        topCompetitors,
        researchResult.competitors
      )

      // Set expiry
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + HB_REPORT_EXPIRY_DAYS)

      // Create report with both desirability and researchability scores
      const urlToken = crypto.randomBytes(8).toString('hex')
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          run_id: scanId,
          url_token: urlToken,
          visibility_score: scores.overallScore, // Desirability score
          platform_scores: scores.platformScores,
          top_competitors: topCompetitors,
          summary,
          brand: 'hiringbrand',
          expires_at: expiresAt.toISOString(),
          // AI Awareness (Researchability)
          researchability_score: scores.researchabilityScore,
          topics_covered: scores.topicsCovered,
          topics_missing: scores.topicsMissing,
          topics_with_confidence: scores.topicsWithConfidence,
          // Differentiation
          differentiation_score: scores.differentiationScore,
        })
        .select('id, url_token')
        .single()

      if (reportError) throw new Error(`Failed to create report: ${reportError.message}`)

      // Update scan status
      await supabase
        .from('scan_runs')
        .update({
          status: 'complete',
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', scanId)

      log.done(
        scanId,
        'Report',
        `desirability: ${scores.overallScore}, awareness: ${scores.researchabilityScore}, differentiation: ${scores.differentiationScore}`
      )

      return {
        urlToken: reportData.url_token,
        reportId: reportData.id,
        scores,
        topCompetitors,
        competitors: researchResult.competitors,
      }
    })

    // Step 7: Generate comparative competitor analysis
    // This creates apples-to-apples comparison on key dimensions
    await step.run('compare-employers', async () => {
      const supabase = createServiceClient()

      // Use frozen/researched competitors (from Setup tab), not AI-mentioned competitors
      const competitorNames = (report.competitors as CompetitorEmployer[]).map((c) => c.name)

      if (competitorNames.length === 0) {
        log.info(scanId, 'No competitors to compare, skipping analysis')
        return null
      }

      log.step(scanId, 'Generating competitive employer analysis')

      const analysis = await compareEmployers({
        targetEmployer: reliableCompanyName,
        targetIndustry: employerAnalysis.analysis.industry,
        targetLocation: employerAnalysis.analysis.location,
        competitors: competitorNames,
        runId: scanId,
      })

      // Use the target employer's differentiation score from the competitive analysis
      // (consistent with what's shown on Competitors page, uses 0.5 threshold for strengths)
      const targetEmployer = analysis.employers.find((e) => e.isTarget)
      const differentiationScore = targetEmployer?.differentiationScore ?? 50

      // Update report with competitor analysis and differentiation score
      await supabase
        .from('reports')
        .update({
          competitor_analysis: analysis,
          differentiation_score: differentiationScore,
        })
        .eq('id', report.reportId)

      log.done(
        scanId,
        'Competitor analysis',
        `${analysis.employers.length} employers, ${analysis.insights.strengths.length} strengths, ${analysis.insights.weaknesses.length} weaknesses, differentiation: ${differentiationScore}`
      )

      return { analysis, differentiationScore }
    })

    // Step 7b: Discover web mentions about employer
    await step.run('discover-web-mentions', async () => {
      try {
        log.step(scanId, 'Discovering web mentions')

        const supabase = createServiceClient()

        // 1. Run Tavily searches
        const { mentions: rawMentions, searchCount } = await discoverWebMentions({
          companyName: reliableCompanyName,
          domain,
          industry: employerAnalysis.analysis.industry,
          location: employerAnalysis.analysis.location,
          runId: scanId,
        })

        if (rawMentions.length === 0) {
          log.info(scanId, 'No web mentions found')
          return null
        }

        // 2. Classify sentiment + relevance (batch GPT-4o-mini)
        const classified = await classifyMentions(
          rawMentions,
          reliableCompanyName,
          domain,
          scanId,
          employerAnalysis.analysis.location
        )

        // 3. Compute aggregate stats
        const stats = computeMentionStats(classified)

        // 3b. Generate AI coverage briefing (3 insights)
        const insights = await generateCoverageBriefing(classified, reliableCompanyName, scanId)
        if (insights.length > 0) {
          stats.insights = insights
        }

        // 4. Persist to database
        await persistMentions(classified, scanId, report.reportId, stats)

        log.done(
          scanId,
          'Web mentions',
          `${classified.length} mentions (${searchCount} searches), avg sentiment: ${stats.avgSentimentScore}/10`
        )

        return { mentionCount: classified.length, stats }
      } catch (error) {
        // Non-fatal: log warning but don't fail the scan
        console.error('Web mention discovery failed:', error)
        log.warn(scanId, `Web mention discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return null
      }
    })

    // Steps 8 + 8b: Generate strategic summary and role action plans in parallel
    const [strategicSummaryResult, roleActionPlansResult] = await Promise.all([
      // Step 8: Generate strategic summary for recruitment agents
      step.run('generate-strategic-summary', async () => {
        const supabase = createServiceClient()

        // Use frozen/researched competitors (from Setup tab), not AI-mentioned competitors
        const competitorNames = (report.competitors as CompetitorEmployer[]).map((c) => c.name)

        if (competitorNames.length === 0) {
          log.info(scanId, 'No competitors for strategic summary, skipping')
          return null
        }

        // Fetch the competitor analysis we just created
        const { data: reportData } = await supabase
          .from('reports')
          .select('competitor_analysis, differentiation_score')
          .eq('id', report.reportId)
          .single()

        if (!reportData?.competitor_analysis) {
          log.info(scanId, 'No competitor analysis available, skipping strategic summary')
          return null
        }

        log.step(scanId, 'Generating strategic summary')

        const strategicSummary = await generateStrategicSummary({
          companyName: reliableCompanyName,
          industry: employerAnalysis.analysis.industry,
          location: employerAnalysis.analysis.location,
          desirabilityScore: report.scores.overallScore,
          awarenessScore: report.scores.researchabilityScore,
          differentiationScore: reportData.differentiation_score || report.scores.differentiationScore,
          competitorAnalysis: reportData.competitor_analysis,
          topicsCovered: report.scores.topicsCovered,
          topicsMissing: report.scores.topicsMissing,
          sentimentCounts: report.scores.sentimentCounts,
          topCompetitors: report.topCompetitors,
          runId: scanId,
        })

        // Update report with strategic summary
        await supabase
          .from('reports')
          .update({
            strategic_summary: strategicSummary,
          })
          .eq('id', report.reportId)

        log.done(
          scanId,
          'Strategic summary',
          `${strategicSummary.recommendations.length} recommendations, health: ${strategicSummary.scoreInterpretation.overallHealth}`
        )

        return strategicSummary
      }),

      // Step 8b: Generate role-specific action plans (in parallel)
      step.run('generate-role-action-plans', async () => {
      const supabase = createServiceClient()

      // Determine active families (frozen or detected)
      let activeFamilies: JobFamily[] = frozenResult.roleFamilies && frozenResult.roleFamilies.length > 0
        ? frozenResult.roleFamilies
        : employerAnalysis.detectedFamilies.map(f => f.family)

      // Fallback: If no families detected (empty commonRoles), use industry-based defaults
      if (activeFamilies.length === 0) {
        const industry = employerAnalysis.analysis.industry?.toLowerCase() || ''
        if (industry.includes('tech') || industry.includes('software')) {
          activeFamilies = ['engineering', 'business', 'corporate']
          log.info(scanId, 'No role families detected - using tech industry defaults for action plans: engineering, business, corporate')
        } else if (industry.includes('retail') || industry.includes('consumer')) {
          activeFamilies = ['operations', 'business', 'corporate']
          log.info(scanId, 'No role families detected - using retail industry defaults for action plans: operations, business, corporate')
        } else {
          activeFamilies = ['business', 'operations', 'corporate']
          log.info(scanId, 'No role families detected - using general defaults for action plans: business, operations, corporate')
        }
      }

      if (activeFamilies.length === 0) {
        log.info(scanId, 'No active job families, skipping role action plans')
        return null
      }

      log.step(scanId, `Generating action plans for ${activeFamilies.length} role families`)

      // Fetch all responses with sentiment
      const { data: allResponses } = await supabase
        .from('llm_responses')
        .select('id, job_family, sentiment_score, sentiment_category, specificity_score, confidence_score, positive_highlights, negative_highlights, red_flags, green_flags, competitors_mentioned, response_text')
        .eq('run_id', scanId)
        .not('sentiment_score', 'is', null)

      if (!allResponses || allResponses.length === 0) {
        log.warn(scanId, 'No responses found for role action plans')
        return null
      }

      // Import differentiation calculator and hbRoleFamilyConfig
      const { calculateRoleDifferentiation } = await import('@/lib/ai/calculate-role-differentiation')
      const { hbRoleFamilyConfig } = await import('@/app/hiringbrand/report/components/shared/constants')

      // Fetch competitor analysis for differentiation calculation
      const { data: reportData } = await supabase
        .from('reports')
        .select('competitor_analysis')
        .eq('id', report.reportId)
        .single()

      // Generate action plans for all families in parallel
      const planPromises = activeFamilies.map(async (family) => {
        const familyResponses = allResponses.filter((r: any) => r.job_family === family)

        if (familyResponses.length === 0) {
          log.info(scanId, `No responses for ${family}, skipping action plan`)
          return null
        }

        // Calculate family-specific scores
        const sentimentScores = familyResponses
          .map((r: any) => r.sentiment_score)
          .filter((s: any): s is number => s !== null)

        const avgSentiment = sentimentScores.length > 0
          ? sentimentScores.reduce((sum: number, s: number) => sum + s, 0) / sentimentScores.length
          : 5

        const desirability = Math.round(((avgSentiment - 1) / 9) * 100)

        const specificityScores = familyResponses
          .map((r: any) => r.specificity_score)
          .filter((s: any): s is number => s !== null)

        const confidenceScores = familyResponses
          .map((r: any) => r.confidence_score)
          .filter((s: any): s is number => s !== null)

        const avgSpecificity = specificityScores.length > 0
          ? specificityScores.reduce((sum: number, s: number) => sum + s, 0) / specificityScores.length
          : 5

        const avgConfidence = confidenceScores.length > 0
          ? confidenceScores.reduce((sum: number, s: number) => sum + s, 0) / confidenceScores.length
          : 5

        const awareness = Math.round((((avgSpecificity + avgConfidence) / 2) - 1) / 9 * 100)

        // Calculate role-level differentiation
        // Derive competitor role-level scores from their dimension scores
        const competitorScores = reportData?.competitor_analysis?.employers
          ?.filter((e: any) => !e.isTarget)
          .map((e: any) => {
            // Average competitor dimension scores (0-10 scale) as proxy for desirability/awareness
            // Normalize to 0-100 scale to match target scores
            const dimensionScores = Object.values(e.scores || {}) as number[]
            const avgDimensionScore = dimensionScores.length > 0
              ? dimensionScores.reduce((sum: number, score: number) => sum + score, 0) / dimensionScores.length
              : 5
            const normalizedScore = (avgDimensionScore / 10) * 100

            return {
              name: e.name,
              desirability: normalizedScore,
              awareness: normalizedScore, // Use same proxy for awareness (no separate data available)
            }
          }) || []

        let differentiationScore: number | undefined
        let differentiationInsights: any | undefined

        if (competitorScores.length > 0) {
          const diffResult = calculateRoleDifferentiation({
            roleFamily: family,
            targetDesirability: Math.max(0, Math.min(100, desirability)),
            targetAwareness: Math.max(0, Math.min(100, awareness)),
            competitorScores,
          })
          differentiationScore = diffResult.differentiationScore
          differentiationInsights = diffResult.insights
        }

        // Generate role-specific action plan
        try {
          const actionPlan = await generateRoleActionPlan({
            companyName: reliableCompanyName,
            industry: employerAnalysis.analysis.industry,
            location: employerAnalysis.analysis.location,
            roleFamily: family,
            roleFamilyDisplayName: hbRoleFamilyConfig[family].label,
            desirabilityScore: Math.max(0, Math.min(100, desirability)),
            awarenessScore: Math.max(0, Math.min(100, awareness)),
            differentiationScore, // NEW
            differentiationInsights, // NEW
            responses: familyResponses as any, // Type cast for compatibility
            runId: scanId,
          })

          log.info(scanId, `Generated ${family} action plan: ${actionPlan.recommendations.length} recommendations`)
          return { family, actionPlan }
        } catch (error) {
          log.warn(scanId, `Failed to generate ${family} action plan: ${error instanceof Error ? error.message : 'Unknown error'}`)
          return null
        }
      })

      // Wait for all action plans to complete
      const results = await Promise.all(planPromises)

      // Convert results array to object
      const roleActionPlans: Record<string, RoleActionPlan> = {}
      for (const result of results) {
        if (result && result.actionPlan) {
          roleActionPlans[result.family] = result.actionPlan
        }
      }

      // Update report with role action plans
      if (Object.keys(roleActionPlans).length > 0) {
        await supabase
          .from('reports')
          .update({
            role_action_plans: roleActionPlans,
          })
          .eq('id', report.reportId)

        log.done(scanId, 'Role action plans', `${Object.keys(roleActionPlans).length} families`)
      }

      return roleActionPlans
    }),
  ])

    // Note: strategicSummaryResult and roleActionPlansResult are returned from parallel execution above
    // No need to use them directly since they're already persisted to the database

    // Step 9: Record score history for trends
    await step.run('record-score-history', async () => {
      const supabase = createServiceClient()

      // Get the final report data including competitor analysis
      const { data: reportData } = await supabase
        .from('reports')
        .select('id, competitor_analysis, differentiation_score')
        .eq('id', report.reportId)
        .single()

      if (!reportData) {
        log.info(scanId, 'No report found, skipping score history')
        return null
      }

      const scanDate = new Date().toISOString()

      // Calculate role family scores for trends
      let activeFamilies: JobFamily[] = frozenResult.roleFamilies && frozenResult.roleFamilies.length > 0
        ? frozenResult.roleFamilies
        : employerAnalysis.detectedFamilies.map(f => f.family)

      // Fallback: If no families detected (empty commonRoles), use industry-based defaults
      if (activeFamilies.length === 0) {
        const industry = employerAnalysis.analysis.industry?.toLowerCase() || ''
        if (industry.includes('tech') || industry.includes('software')) {
          activeFamilies = ['engineering', 'business', 'corporate']
          log.info(scanId, 'No role families detected - using tech industry defaults for score history')
        } else if (industry.includes('retail') || industry.includes('consumer')) {
          activeFamilies = ['operations', 'business', 'corporate']
          log.info(scanId, 'No role families detected - using retail industry defaults for score history')
        } else {
          activeFamilies = ['business', 'operations', 'corporate']
          log.info(scanId, 'No role families detected - using general defaults for score history')
        }
      }

      const { data: responsesForScoring } = await supabase
        .from('llm_responses')
        .select('job_family, sentiment_score, specificity_score, confidence_score')
        .eq('run_id', scanId)
        .not('sentiment_score', 'is', null)

      const baseRoleFamilyScores = calculateRoleFamilyScores(responsesForScoring || [], activeFamilies)

      // Calculate role-level differentiation scores and add to roleFamilyScores
      const { calculateRoleDifferentiation } = await import('@/lib/ai/calculate-role-differentiation')

      // Create enhanced scores object with differentiation
      const roleFamilyScores: Record<string, { desirability: number; awareness: number; differentiation?: number }> = { ...baseRoleFamilyScores }

      for (const family of activeFamilies) {
        const familyScores = roleFamilyScores[family]
        if (!familyScores) continue

        // Extract competitor scores for differentiation calculation
        // Derive from dimension scores (same as Step 8b)
        const competitorScores = reportData.competitor_analysis?.employers
          ?.filter((e: any) => !e.isTarget)
          .map((e: any) => {
            const dimensionScores = Object.values(e.scores || {}) as number[]
            const avgDimensionScore = dimensionScores.length > 0
              ? dimensionScores.reduce((sum: number, score: number) => sum + score, 0) / dimensionScores.length
              : 5
            const normalizedScore = (avgDimensionScore / 10) * 100

            return {
              name: e.name,
              desirability: normalizedScore,
              awareness: normalizedScore,
            }
          }) || []

        if (competitorScores.length > 0) {
          const diffResult = calculateRoleDifferentiation({
            roleFamily: family,
            targetDesirability: familyScores.desirability,
            targetAwareness: familyScores.awareness,
            competitorScores,
          })
          roleFamilyScores[family].differentiation = diffResult.differentiationScore
        }
      }

      // Record main score history
      await supabase.from('hb_score_history').insert({
        monitored_domain_id: monitoredDomainId,
        report_id: report.reportId,
        scan_date: scanDate,
        desirability_score: report.scores.overallScore,
        awareness_score: report.scores.researchabilityScore,
        differentiation_score: reportData.differentiation_score || report.scores.differentiationScore,
        platform_scores: report.scores.platformScores,
        role_family_scores: roleFamilyScores,
        // Calculate rank among all employers if competitor analysis exists
        competitor_rank: null, // Will be set if competitor analysis exists
        competitor_count: null,
        dimension_scores: {}, // Will be populated from competitor analysis
      })

      // Record competitor history if we have competitor analysis
      const competitorAnalysis = reportData.competitor_analysis as {
        employers: Array<{
          name: string
          isTarget: boolean
          scores: Record<string, number>
          differentiationScore: number
        }>
      } | null

      if (competitorAnalysis?.employers && competitorAnalysis.employers.length > 0) {
        // Sort employers by composite score for ranking
        const employersWithComposite = competitorAnalysis.employers.map((emp) => {
          const scoreValues = Object.values(emp.scores)
          const composite = scoreValues.length > 0
            ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
            : 5
          return { ...emp, composite }
        })

        // Sort by composite score descending
        employersWithComposite.sort((a, b) => b.composite - a.composite)

        // Assign ranks
        const rankedEmployers = employersWithComposite.map((emp, idx) => ({
          ...emp,
          rankByComposite: idx + 1,
        }))

        // Sort by differentiation score for that ranking
        const byDiff = [...rankedEmployers].sort((a, b) => b.differentiationScore - a.differentiationScore)
        const diffRanks = new Map(byDiff.map((e, i) => [e.name, i + 1]))

        // Find target employer rank
        const targetEmployer = rankedEmployers.find((e) => e.isTarget)

        // Update the score history with rank data and dimension scores
        if (targetEmployer) {
          await supabase
            .from('hb_score_history')
            .update({
              competitor_rank: targetEmployer.rankByComposite,
              competitor_count: rankedEmployers.length,
              dimension_scores: targetEmployer.scores,
            })
            .eq('report_id', report.reportId)
        }

        // Insert competitor history entries
        const competitorHistoryEntries = rankedEmployers.map((emp) => ({
          monitored_domain_id: monitoredDomainId,
          report_id: report.reportId,
          scan_date: scanDate,
          competitor_name: emp.name,
          is_target: emp.isTarget,
          composite_score: emp.composite,
          differentiation_score: emp.differentiationScore,
          dimension_scores: emp.scores,
          rank_by_composite: emp.rankByComposite,
          rank_by_differentiation: diffRanks.get(emp.name) || 0,
        }))

        await supabase.from('hb_competitor_history').insert(competitorHistoryEntries)

        log.done(scanId, 'Score history', `${competitorHistoryEntries.length} employers recorded`)
      } else {
        log.info(scanId, 'No competitor analysis, recorded only main scores')
      }

      return { recorded: true }
    })

    // Step 10: Mark scan as complete
    await step.run('mark-complete', async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, 'complete', 100)
      log.done(scanId, 'Complete', 'Scan finished successfully')
      return { complete: true }
    })

    log.end(scanId, true)

    // Cast competitors back to proper type (Inngest serializes step results)
    const competitorNames = (report.competitors as CompetitorEmployer[]).map((c) => c.name)

    return {
      success: true,
      scanId,
      reportToken: report.urlToken,
      desirabilityScore: report.scores.overallScore,
      awarenessScore: report.scores.researchabilityScore,
      differentiationScore: report.scores.differentiationScore,
      competitors: competitorNames,
      processingTimeMs: Date.now() - startTime,
    }
  }
)

// Helper: Update scan status
async function updateScanStatus(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  status: string,
  progress: number
) {
  await supabase.from('scan_runs').update({ status, progress }).eq('id', scanId)
}

// Helper: Extract employer analysis from crawled content
function extractEmployerAnalysis(
  content: string,
  domain: string,
  crawlResult: Awaited<ReturnType<typeof crawlSite>>
): EmployerAnalysis {
  const contentLower = content.toLowerCase()

  // Extract company name from domain (most reliable source)
  const domainParts = domain.replace(/^www\./, '').split('.')
  let companyName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)

  // Try to find company name in title tags, but validate it looks like a name not a tagline
  for (const page of crawlResult.pages) {
    if (page.title && !page.title.toLowerCase().includes('careers')) {
      const titleParts = page.title.split(/[|\-–]/)
      if (titleParts.length > 1) {
        const candidate = titleParts[titleParts.length - 1].trim()
        // Validate: company names are usually short and don't contain tagline words
        const isTagline = candidate.length > 30 ||
          /\b(grow|your|revenue|best|leading|world|platform|solution|infrastructure|build|create|make|the|for|with|and)\b/i.test(candidate)
        if (!isTagline && candidate.length > 1) {
          companyName = candidate
          break
        }
      }
    }
  }

  // Detect industry from content
  let industry = 'Technology'
  const industryKeywords: Record<string, string[]> = {
    'Technology / Software': ['software', 'saas', 'tech', 'engineering', 'developer'],
    'Financial Services': ['bank', 'finance', 'insurance', 'fintech', 'investment'],
    'Healthcare': ['health', 'medical', 'hospital', 'pharma', 'biotech'],
    'Retail / E-commerce': ['retail', 'ecommerce', 'shop', 'store', 'consumer'],
    'Professional Services': ['consulting', 'legal', 'accounting', 'advisory'],
    'Media / Entertainment': ['media', 'entertainment', 'content', 'streaming'],
    'Manufacturing': ['manufacturing', 'industrial', 'production', 'factory'],
  }

  for (const [ind, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some((kw) => contentLower.includes(kw))) {
      industry = ind
      break
    }
  }

  // Extract common roles from careers content
  const rolePatterns = [
    /software engineer/gi,
    /product manager/gi,
    /designer/gi,
    /data scientist/gi,
    /marketing/gi,
    /sales/gi,
    /customer success/gi,
    /operations/gi,
    /finance/gi,
    /hr|human resources/gi,
  ]

  const commonRoles: string[] = []
  for (const pattern of rolePatterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern)
      if (match) {
        const role = match[0]
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')
        if (!commonRoles.includes(role)) {
          commonRoles.push(role)
        }
      }
    }
  }

  // Extract culture keywords
  const culturePatterns = [
    'innovative',
    'collaborative',
    'flexible',
    'remote',
    'hybrid',
    'inclusive',
    'diverse',
    'fast-paced',
    'mission-driven',
    'customer-focused',
    'growth',
    'learning',
    'impact',
  ]

  const cultureKeywords = culturePatterns.filter((kw) => contentLower.includes(kw))

  // Extract location
  let location = ''
  const locationPatterns = [
    /headquarters?:?\s*([A-Za-z\s,]+)/i,
    /based in\s*([A-Za-z\s,]+)/i,
    /located in\s*([A-Za-z\s,]+)/i,
  ]

  for (const pattern of locationPatterns) {
    const match = content.match(pattern)
    if (match) {
      location = match[1].trim().slice(0, 50)
      break
    }
  }

  return {
    companyName,
    industry,
    location,
    commonRoles: commonRoles.slice(0, 5),
    cultureKeywords: cultureKeywords.slice(0, 5),
  }
}

// Helper: Generate employer-focused summary with sentiment and researchability
function generateEmployerSummary(
  analysis: EmployerAnalysis,
  scores: {
    overallScore: number
    researchabilityScore: number
    sentimentCounts: { strong: number; positive: number; mixed: number; negative: number }
    totalResponses: number
    topicsCovered: string[]
    topicsMissing: string[]
  },
  topCompetitors: { name: string; count: number }[],
  researchedCompetitors: CompetitorEmployer[]
): string {
  const { companyName, industry } = analysis
  const { sentimentCounts, totalResponses, researchabilityScore, topicsMissing } = scores

  // Desirability description
  const desirabilityDesc =
    scores.overallScore >= 70
      ? 'strong'
      : scores.overallScore >= 40
        ? 'moderate'
        : scores.overallScore >= 20
          ? 'emerging'
          : 'limited'

  // Researchability description
  const researchabilityDesc =
    researchabilityScore >= 70
      ? 'well-informed'
      : researchabilityScore >= 40
        ? 'moderately informed'
        : 'limited knowledge'

  // Sentiment breakdown (combine strong + positive as favorable)
  const favorableCount = sentimentCounts.strong + sentimentCounts.positive
  const favorablePercent = totalResponses > 0 ? Math.round((favorableCount / totalResponses) * 100) : 0
  const negativePercent = totalResponses > 0 ? Math.round((sentimentCounts.negative / totalResponses) * 100) : 0
  const strongPercent = totalResponses > 0 ? Math.round((sentimentCounts.strong / totalResponses) * 100) : 0

  let summary = `${companyName} has ${desirabilityDesc} AI employer reputation (${scores.overallScore}% desirability). `
  summary += `AI assistants are ${researchabilityDesc} about ${companyName} (${researchabilityScore}% researchability). `

  // Sentiment description
  if (strongPercent >= 40) {
    summary += `AI strongly recommends ${companyName} (${strongPercent}% highly favorable). `
  } else if (favorablePercent >= 60) {
    summary += `Responses are generally positive (${favorablePercent}% favorable). `
  } else if (negativePercent >= 30) {
    summary += `Some concerns emerged (${negativePercent}% cautionary responses). `
  } else {
    summary += `Responses are mixed (${favorablePercent}% favorable, ${negativePercent}% negative). `
  }

  // Topic gaps
  if (topicsMissing.length > 0 && topicsMissing.length <= 5) {
    const topicsFormatted = topicsMissing.slice(0, 3).map((t) => t.replace(/_/g, ' ')).join(', ')
    summary += `AI lacks information about: ${topicsFormatted}. `
  }

  if (topCompetitors.length > 0) {
    const topThree = topCompetitors.slice(0, 3).map((c) => c.name)
    summary += `Competitor employers mentioned: ${topThree.join(', ')}. `
  }

  if (researchedCompetitors.length > 0) {
    summary += `Talent competitors in ${industry}: ${researchedCompetitors
      .slice(0, 3)
      .map((c) => c.name)
      .join(', ')}. `
  }

  // Actionable insight
  if (scores.overallScore < 50 && researchabilityScore >= 50) {
    summary += `Focus on addressing negative perceptions - AI knows about you but perception needs work.`
  } else if (scores.overallScore >= 50 && researchabilityScore < 50) {
    summary += `Focus on content visibility - AI likes what it knows, but needs more information.`
  } else if (scores.overallScore < 50 && researchabilityScore < 50) {
    summary += `Opportunity to improve both visibility and perception through careers content.`
  }

  return summary
}
