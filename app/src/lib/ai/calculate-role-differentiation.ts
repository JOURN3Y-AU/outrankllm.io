/**
 * Calculate role-level differentiation scores using pure mathematics (no API calls)
 *
 * Formula components:
 * 1. Profile Distance (50%): Euclidean distance from competitor average
 * 2. Strength Bonus (30%): Count of dimensions 5+ points above average
 * 3. Variance (20%): Specialization vs flat profile
 */

import type { HBEmployerDimension } from '@/app/hiringbrand/report/components/shared/types'

export interface RoleDifferentiationInput {
  roleFamily: string
  targetDesirability: number // 0-100
  targetAwareness: number // 0-100
  competitorScores: Array<{
    name: string
    desirability: number
    awareness: number
  }>
  // Optional: dimension-level scores for more accurate strength calculation
  targetDimensionScores?: Record<HBEmployerDimension, number>
  competitorDimensionScores?: Record<string, Record<HBEmployerDimension, number>>
}

export interface RoleDifferentiationResult {
  differentiationScore: number // 0-100
  insights: {
    desirabilityGap: number // How far from competitor avg
    awarenessGap: number // How far from competitor avg
    strengthCount: number // How many dimensions above average
    uniquenessIndex: number // Variance-based specialization score
    positioning: 'distinctive' | 'competitive' | 'emerging' // Based on score thresholds
  }
}

/**
 * Calculate mean (average) of an array of numbers
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate variance of dimension scores (measures specialization)
 */
function calculateVariance(dimensionScores: Record<string, number>): number {
  const scores = Object.values(dimensionScores)
  if (scores.length === 0) return 0

  const avg = mean(scores)
  const squaredDiffs = scores.map(score => Math.pow(score - avg, 2))
  return mean(squaredDiffs)
}

/**
 * Calculate role-level differentiation score
 */
export function calculateRoleDifferentiation(
  input: RoleDifferentiationInput
): RoleDifferentiationResult {
  const {
    targetDesirability,
    targetAwareness,
    competitorScores,
    targetDimensionScores,
    competitorDimensionScores,
  } = input

  // Handle edge case: no competitors
  if (competitorScores.length === 0) {
    return {
      differentiationScore: 50, // Neutral score when no comparison available
      insights: {
        desirabilityGap: 0,
        awarenessGap: 0,
        strengthCount: 0,
        uniquenessIndex: 0,
        positioning: 'emerging',
      },
    }
  }

  // Component 1: Profile Distance (50%)
  // Measures Euclidean distance from competitor average in 2D space (desirability, awareness)
  const avgCompetitorDesirability = mean(competitorScores.map(c => c.desirability))
  const avgCompetitorAwareness = mean(competitorScores.map(c => c.awareness))

  const desirabilityGap = targetDesirability - avgCompetitorDesirability
  const awarenessGap = targetAwareness - avgCompetitorAwareness

  const distance = Math.sqrt(
    Math.pow(desirabilityGap, 2) + Math.pow(awarenessGap, 2)
  )

  // Normalize to 0-50 scale (50% of final score)
  // Distance of 50+ points gets max score
  const profileDistanceScore = Math.min(distance, 50)

  // Component 2: Strength Bonus (30%)
  // Count how many dimensions are 5+ points above competitor average
  let strengthCount = 0
  let strengthBonus = 0

  if (targetDimensionScores && competitorDimensionScores) {
    const dimensions = Object.keys(targetDimensionScores) as HBEmployerDimension[]

    // Calculate competitor averages per dimension
    const competitorAvgDimensions: Partial<Record<HBEmployerDimension, number>> = {}
    for (const dimension of dimensions) {
      const competitorDimensionValues = Object.values(competitorDimensionScores)
        .map(scores => scores[dimension])
        .filter(val => val !== undefined)

      if (competitorDimensionValues.length > 0) {
        competitorAvgDimensions[dimension] = mean(competitorDimensionValues)
      }
    }

    // Count strengths (5+ points above average)
    strengthCount = dimensions.filter(dimension => {
      const targetScore = targetDimensionScores[dimension]
      const avgScore = competitorAvgDimensions[dimension]
      return avgScore !== undefined && targetScore >= avgScore + 5
    }).length

    // Calculate bonus (30% max)
    const totalDimensions = dimensions.length
    strengthBonus = totalDimensions > 0 ? (strengthCount / totalDimensions) * 30 : 0
  } else {
    // Fallback: If no dimension scores, estimate from overall gaps
    // Strong positive gaps in both desirability and awareness get partial bonus
    if (desirabilityGap >= 10 && awarenessGap >= 10) {
      strengthBonus = 20 // Strong on both dimensions
    } else if (desirabilityGap >= 10 || awarenessGap >= 10) {
      strengthBonus = 10 // Strong on one dimension
    }
  }

  // Component 3: Variance (20%)
  // Measures specialization (high variance = spiky profile = more unique)
  let varianceScore = 0
  let uniquenessIndex = 0

  if (targetDimensionScores) {
    const variance = calculateVariance(targetDimensionScores)
    uniquenessIndex = variance

    // Normalize to 0-20 scale (20% of final score)
    // Variance of 10+ gets max score
    varianceScore = Math.min((variance / 10) * 20, 20)
  } else {
    // Fallback: If no dimension scores, estimate from gap patterns
    // Large gap in one dimension but not the other = specialized = higher variance
    const gapDifference = Math.abs(Math.abs(desirabilityGap) - Math.abs(awarenessGap))
    varianceScore = Math.min((gapDifference / 20) * 20, 20)
  }

  // Final Score (0-100)
  const differentiationScore = Math.round(
    profileDistanceScore + strengthBonus + varianceScore
  )

  // Determine positioning category
  let positioning: 'distinctive' | 'competitive' | 'emerging'
  if (differentiationScore >= 70) {
    positioning = 'distinctive'
  } else if (differentiationScore >= 50) {
    positioning = 'competitive'
  } else {
    positioning = 'emerging'
  }

  return {
    differentiationScore: Math.min(Math.max(differentiationScore, 0), 100), // Clamp to 0-100
    insights: {
      desirabilityGap: Math.round(desirabilityGap * 10) / 10, // Round to 1 decimal
      awarenessGap: Math.round(awarenessGap * 10) / 10,
      strengthCount,
      uniquenessIndex: Math.round(uniquenessIndex * 10) / 10,
      positioning,
    },
  }
}
