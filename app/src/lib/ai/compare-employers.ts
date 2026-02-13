/**
 * Employer Comparison Module (HiringBrand)
 * Generates apples-to-apples comparison of employers on key dimensions
 * Uses Claude to rate all employers on the same criteria for fair comparison
 */

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { trackCost } from './costs'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Employer branding dimensions for comparison
export const EMPLOYER_DIMENSIONS = [
  'compensation', // Pay, bonuses, equity
  'culture', // Work environment, values, team dynamics
  'growth', // Career progression, learning, promotions
  'balance', // Work-life balance, flexibility, hours
  'leadership', // Management quality, vision, transparency
  'tech', // Technology stack, innovation, engineering culture
  'mission', // Purpose, impact, company mission
] as const

export type EmployerDimension = (typeof EMPLOYER_DIMENSIONS)[number]

/**
 * Calculate differentiation score for each employer
 * Measures how unique their profile is compared to others
 *
 * Scoring components:
 * - Profile Distance (40%): How different from the group average
 * - Strength Count (30%): How many dimensions above average
 * - Score Variance (30%): How much their scores vary (specialists vs generalists)
 */
function calculateEmployerDifferentiation(
  employers: Array<{ name: string; scores: Record<EmployerDimension, number> }>
): Map<string, { differentiationScore: number; strengthCount: number; weaknessCount: number }> {
  const results = new Map<string, { differentiationScore: number; strengthCount: number; weaknessCount: number }>()

  if (employers.length <= 1) {
    // Single employer = baseline differentiation
    for (const emp of employers) {
      results.set(emp.name, { differentiationScore: 50, strengthCount: 0, weaknessCount: 0 })
    }
    return results
  }

  // Calculate group averages per dimension
  const dimensionAverages: Record<string, number> = {}
  for (const dim of EMPLOYER_DIMENSIONS) {
    const sum = employers.reduce((acc, emp) => acc + (emp.scores[dim] || 5), 0)
    dimensionAverages[dim] = sum / employers.length
  }

  // Calculate for each employer
  for (const emp of employers) {
    let distanceSum = 0
    let varianceSum = 0
    let strengthCount = 0
    let weaknessCount = 0
    const scores = Object.values(emp.scores)
    const empMean = scores.reduce((a, b) => a + b, 0) / scores.length

    for (const dim of EMPLOYER_DIMENSIONS) {
      const score = emp.scores[dim] || 5
      const avg = dimensionAverages[dim]

      // Profile distance from group average
      distanceSum += Math.pow(score - avg, 2)

      // Score variance (internal profile shape)
      varianceSum += Math.pow(score - empMean, 2)

      // Count strengths/weaknesses
      if (score > avg + 0.5) strengthCount++
      if (score < avg - 0.5) weaknessCount++
    }

    // Normalize components to 0-100 scale
    // Profile distance: sqrt of sum of squared differences, max ~9 per dimension
    const maxDistance = Math.sqrt(EMPLOYER_DIMENSIONS.length * 81) // 9^2 = 81
    const profileDistanceNorm = (Math.sqrt(distanceSum) / maxDistance) * 100

    // Score variance: how much they specialize (vs flat profile)
    const maxVariance = Math.sqrt(EMPLOYER_DIMENSIONS.length * 20.25) // ~4.5^2 from mean
    const varianceNorm = (Math.sqrt(varianceSum) / maxVariance) * 100

    // Strength count bonus (more distinct strengths = more differentiated)
    const strengthNorm = (strengthCount / EMPLOYER_DIMENSIONS.length) * 100

    // Weighted combination
    const differentiationScore = Math.round(
      profileDistanceNorm * 0.4 + varianceNorm * 0.3 + strengthNorm * 0.3
    )

    results.set(emp.name, {
      differentiationScore: Math.min(100, Math.max(0, differentiationScore)),
      strengthCount,
      weaknessCount,
    })
  }

  return results
}

// Schema for each employer's scores and highlights
const employerScoreSchema = z.object({
  name: z.string(),
  isTarget: z.boolean(),
  scores: z.record(z.string(), z.number().min(1).max(10)),
  highlights: z.array(z.string()).describe('2-4 key differentiators or notable aspects'),
})

// Schema for competitive insights
const insightsSchema = z.object({
  strengths: z.array(z.string()).describe('Dimensions where target employer excels vs competitors'),
  weaknesses: z.array(z.string()).describe('Dimensions where target employer lags competitors'),
  recommendations: z.array(z.string()).describe('2-3 actionable recommendations based on gaps'),
})

// Full comparison result schema
const comparisonResultSchema = z.object({
  dimensions: z.array(z.string()),
  employers: z.array(employerScoreSchema),
  insights: insightsSchema,
})

export interface CompetitorAnalysis {
  dimensions: EmployerDimension[]
  employers: Array<{
    name: string
    isTarget: boolean
    scores: Record<EmployerDimension, number>
    highlights: string[]
    differentiationScore: number // 0-100: how unique this employer's profile is
    strengthCount: number // How many dimensions are above average
    weaknessCount: number // How many dimensions are below average
  }>
  insights: {
    strengths: EmployerDimension[]
    weaknesses: EmployerDimension[]
    recommendations: string[]
  }
  generatedAt: string
}

interface CompareEmployersInput {
  targetEmployer: string
  targetIndustry?: string
  targetLocation?: string
  competitors: string[]
  runId: string
}

/**
 * Compare employers on key branding dimensions
 * Uses Claude to rate all employers fairly on the same criteria
 */
export async function compareEmployers(
  input: CompareEmployersInput
): Promise<CompetitorAnalysis> {
  const { targetEmployer, targetIndustry, targetLocation, competitors, runId } = input

  // Limit to top 10 competitors for comprehensive comparison
  const topCompetitors = competitors.slice(0, 10)

  if (topCompetitors.length === 0) {
    // Return default analysis if no competitors
    return {
      dimensions: [...EMPLOYER_DIMENSIONS],
      employers: [
        {
          name: targetEmployer,
          isTarget: true,
          scores: Object.fromEntries(EMPLOYER_DIMENSIONS.map((d) => [d, 5])) as Record<
            EmployerDimension,
            number
          >,
          highlights: ['No competitor data available for comparison'],
          differentiationScore: 50, // Baseline when no comparison possible
          strengthCount: 0,
          weaknessCount: 0,
        },
      ],
      insights: {
        strengths: [],
        weaknesses: [],
        recommendations: ['Add more employer brand content to enable competitive analysis'],
      },
      generatedAt: new Date().toISOString(),
    }
  }

  const allEmployers = [targetEmployer, ...topCompetitors]

  const systemPrompt = `You are an expert employer branding analyst with deep knowledge of talent markets.

Your task is to objectively rate and compare employers as workplaces for job seekers.

CRITICAL SCORING RULES:
1. Rate each employer 1-10 on each dimension based on your knowledge and public perception
2. Be HONEST and DIFFERENTIATED - not all companies are 7s. Use the full 1-10 scale.
3. If you have limited knowledge about an employer, score them 5 with medium confidence
4. Score relative to the industry and talent market, not absolute ideals
5. Consider public reviews (Glassdoor, Blind, etc.), news, and general reputation

DIMENSION DEFINITIONS:
- compensation (1-10): Pay levels, bonuses, equity packages relative to market
- culture (1-10): Work environment, team dynamics, collaboration, values alignment
- growth (1-10): Career progression speed, learning opportunities, promotions
- balance (1-10): Work-life balance, flexibility, remote options, reasonable hours
- leadership (1-10): Management quality, executive vision, transparency, trust
- tech (1-10): Technology stack, innovation culture, engineering practices, technical debt
- mission (1-10): Company purpose, social impact, meaningful work, employee pride

HIGHLIGHT GUIDELINES:
- Each employer should have 2-4 distinctive highlights
- Highlights should be specific and differentiating, not generic
- Good: "Known for generous equity packages with 4-year vesting"
- Bad: "Competitive compensation" (too vague)
- Good: "Fast promotion culture - IC to manager in 2 years common"
- Bad: "Good career growth" (too generic)`

  const userPrompt = `Compare these employers as workplaces in the ${targetIndustry || 'technology'} sector${targetLocation ? ` (${targetLocation})` : ''}:

TARGET EMPLOYER (the one being analyzed): ${targetEmployer}
COMPETITORS: ${topCompetitors.join(', ')}

Rate each employer on these dimensions: ${EMPLOYER_DIMENSIONS.join(', ')}

Then provide insights:
1. Which dimensions is ${targetEmployer} STRONGER than competitors? (list dimension names)
2. Which dimensions is ${targetEmployer} WEAKER than competitors? (list dimension names)
3. Give 2-3 specific recommendations for ${targetEmployer} to improve competitive positioning

Be honest and use differentiated scores. Job seekers rely on accurate comparisons.

IMPORTANT: Use the EXACT employer names as listed above. Do not rename, expand, or add parenthetical clarifications.`

  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: comparisonResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'compare_employers',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Process and validate the result
    const { employers, insights } = result.object

    // Normalize AI-returned names back to the exact names we provided
    // (AI may expand "WOW" → "WOW (Woolworths Group)" etc.)
    const normalizeEmployerName = (aiName: string): string => {
      const lower = aiName.toLowerCase()
      // Exact match first
      const exact = allEmployers.find((n) => n.toLowerCase() === lower)
      if (exact) return exact
      // Fuzzy: check if the AI name starts with or contains the input name
      const fuzzy = allEmployers.find((n) => lower.startsWith(n.toLowerCase()) || lower.includes(n.toLowerCase()))
      if (fuzzy) return fuzzy
      return aiName // Fallback to AI name if no match
    }

    // Ensure target employer is marked correctly and add base scores
    const baseEmployers = employers.map((emp) => ({
      name: normalizeEmployerName(emp.name),
      isTarget: normalizeEmployerName(emp.name).toLowerCase() === targetEmployer.toLowerCase(),
      scores: Object.fromEntries(
        EMPLOYER_DIMENSIONS.map((d) => [d, emp.scores[d as string] || 5])
      ) as Record<EmployerDimension, number>,
      highlights: emp.highlights.slice(0, 4),
    }))

    // Calculate differentiation scores for all employers
    const differentiationMap = calculateEmployerDifferentiation(baseEmployers)

    // Add differentiation data to each employer
    const processedEmployers = baseEmployers.map((emp) => {
      const diffData = differentiationMap.get(emp.name) || {
        differentiationScore: 50,
        strengthCount: 0,
        weaknessCount: 0,
      }
      return {
        ...emp,
        differentiationScore: diffData.differentiationScore,
        strengthCount: diffData.strengthCount,
        weaknessCount: diffData.weaknessCount,
      }
    })

    // Validate insights dimensions
    const validStrengths = insights.strengths.filter((s) =>
      EMPLOYER_DIMENSIONS.includes(s as EmployerDimension)
    ) as EmployerDimension[]

    const validWeaknesses = insights.weaknesses.filter((w) =>
      EMPLOYER_DIMENSIONS.includes(w as EmployerDimension)
    ) as EmployerDimension[]

    return {
      dimensions: [...EMPLOYER_DIMENSIONS],
      employers: processedEmployers,
      insights: {
        strengths: validStrengths,
        weaknesses: validWeaknesses,
        recommendations: insights.recommendations.slice(0, 3),
      },
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Employer comparison failed:', error)

    // Return default analysis on error
    return {
      dimensions: [...EMPLOYER_DIMENSIONS],
      employers: allEmployers.map((name, idx) => ({
        name,
        isTarget: idx === 0,
        scores: Object.fromEntries(EMPLOYER_DIMENSIONS.map((d) => [d, 5])) as Record<
          EmployerDimension,
          number
        >,
        highlights: ['Analysis unavailable'],
        differentiationScore: 50, // Baseline when analysis fails
        strengthCount: 0,
        weaknessCount: 0,
      })),
      insights: {
        strengths: [],
        weaknesses: [],
        recommendations: ['Retry analysis for competitive insights'],
      },
      generatedAt: new Date().toISOString(),
    }
  }
}
