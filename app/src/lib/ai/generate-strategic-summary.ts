/**
 * Strategic Summary Generator for HiringBrand
 *
 * Generates an executive-level strategic summary for employer branding,
 * designed for recruitment agents presenting to clients.
 *
 * Uses all available analysis data to create:
 * - Executive summary
 * - Competitive positioning
 * - Strength/gap analysis
 * - Prioritized recommendations
 */

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { trackCost } from './costs'
import type { CompetitorAnalysis, EmployerDimension } from './compare-employers'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Input data for strategic summary generation
export interface StrategicSummaryInput {
  // Company info
  companyName: string
  industry: string | null
  location: string | null

  // Scores
  desirabilityScore: number
  awarenessScore: number
  differentiationScore: number

  // Competitor analysis
  competitorAnalysis: CompetitorAnalysis

  // Topic coverage
  topicsCovered: string[]
  topicsMissing: string[]

  // Sentiment data
  sentimentCounts: {
    strong: number
    positive: number
    mixed: number
    negative: number
  }

  // Top competitors mentioned
  topCompetitors: Array<{ name: string; count: number }>

  runId: string
}

// Zod schemas for structured output
const effortLevelSchema = z.enum(['quick_win', 'moderate', 'significant'])
const impactLevelSchema = z.enum(['high', 'medium', 'low'])
const prioritySchema = z.enum(['immediate', 'short_term', 'long_term'])
const dimensionSchema = z.enum(['compensation', 'culture', 'growth', 'balance', 'leadership', 'tech', 'mission'])
const healthSchema = z.enum(['strong', 'moderate', 'needs_attention', 'critical'])

const recommendationSchema = z.object({
  title: z.string().describe('Short action title (5-10 words)'),
  description: z.string().describe('Specific, actionable description (1-2 sentences)'),
  effort: effortLevelSchema.describe('Implementation effort required'),
  impact: impactLevelSchema.describe('Expected impact on employer brand'),
  priority: prioritySchema.describe('When to tackle this'),
  relatedDimension: dimensionSchema.optional().describe('Which dimension this addresses'),
})

const strengthInsightSchema = z.object({
  dimension: dimensionSchema,
  headline: z.string().describe('Punchy headline (e.g., "Industry-leading work-life balance")'),
  leverageStrategy: z.string().describe('How to amplify this in employer branding (1-2 sentences)'),
})

const gapInsightSchema = z.object({
  dimension: dimensionSchema,
  headline: z.string().describe('Clear headline (e.g., "Compensation lags market")'),
  businessImpact: z.string().describe('Why this matters for talent attraction (1 sentence)'),
  topCompetitor: z.string().describe('Name of competitor to learn from'),
})

const strategicSummarySchema = z.object({
  executiveSummary: z.string().describe('2-3 sentence executive overview for stakeholders'),
  competitivePositioning: z.string().describe('One-liner positioning statement'),
  scoreInterpretation: z.object({
    desirability: z.string().describe('What the desirability score means (1 sentence)'),
    awareness: z.string().describe('What the AI awareness score means (1 sentence)'),
    differentiation: z.string().describe('What the differentiation score means (1 sentence)'),
    overallHealth: healthSchema.describe('Overall employer brand health assessment'),
  }),
  strengths: z.array(strengthInsightSchema).describe('2-3 key strengths with leverage strategies'),
  gaps: z.array(gapInsightSchema).describe('2-3 key gaps with business impact'),
  recommendations: z.array(recommendationSchema).describe('5-7 prioritized actions'),
  industryContext: z.string().describe('How this compares to industry norms (1-2 sentences)'),
  topTalentCompetitor: z.string().describe('Primary competitor for talent'),
})

export type StrategicSummary = z.infer<typeof strategicSummarySchema> & {
  generatedAt: string
  strengths: Array<z.infer<typeof strengthInsightSchema> & { score: number; competitorAvg: number }>
  gaps: Array<z.infer<typeof gapInsightSchema> & { score: number; competitorAvg: number }>
}

/**
 * Generate strategic summary from all analysis data
 */
export async function generateStrategicSummary(
  input: StrategicSummaryInput
): Promise<StrategicSummary> {
  const {
    companyName,
    industry,
    location,
    desirabilityScore,
    awarenessScore,
    differentiationScore,
    competitorAnalysis,
    topicsCovered,
    topicsMissing,
    sentimentCounts,
    topCompetitors,
    runId,
  } = input

  // Get target employer data
  const target = competitorAnalysis.employers.find((e) => e.isTarget)
  const competitors = competitorAnalysis.employers.filter((e) => !e.isTarget)

  if (!target) {
    throw new Error('Target employer not found in competitor analysis')
  }

  // Calculate competitor averages for each dimension
  const competitorAvg: Record<string, number> = {}
  for (const dim of competitorAnalysis.dimensions) {
    const scores = competitors.map((c) => c.scores[dim as EmployerDimension] || 5)
    competitorAvg[dim] = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 5
  }

  // Format dimension scores for the prompt
  const dimensionComparison = competitorAnalysis.dimensions
    .map((dim) => {
      const targetScore = target.scores[dim as EmployerDimension] || 5
      const avg = competitorAvg[dim]
      const diff = targetScore - avg
      const status = diff >= 1.5 ? 'STRENGTH' : diff <= -1.5 ? 'GAP' : 'NEUTRAL'
      return `- ${dim}: ${targetScore}/10 (avg: ${avg}) [${status}]`
    })
    .join('\n')

  // Format competitor highlights
  const competitorHighlights = competitors
    .slice(0, 5)
    .map((c) => `- ${c.name}: ${c.highlights.slice(0, 2).join('; ')}`)
    .join('\n')

  // Calculate total responses
  const totalResponses = sentimentCounts.strong + sentimentCounts.positive +
    sentimentCounts.mixed + sentimentCounts.negative

  const systemPrompt = `You are a senior employer branding strategist creating an executive summary for a recruitment agency to present to their client.

Your goal is to provide actionable, strategic insights that help the client understand their AI employer reputation and what to do about it.

CRITICAL GUIDELINES:
1. Be SPECIFIC and ACTIONABLE - avoid generic advice like "improve your careers page"
2. Use the ACTUAL DATA provided - reference specific scores and competitors
3. PRIORITIZE ruthlessly - not everything needs fixing, focus on high-impact items
4. Be HONEST about weaknesses - clients need to hear the truth
5. Consider the INDUSTRY context - what matters for ${industry || 'this sector'}

SCORING INTERPRETATION:
- 70-100: Strong - actively attracting talent
- 50-69: Moderate - competitive but room to improve
- 30-49: Needs Attention - falling behind competitors
- 0-29: Critical - significant brand perception issues

EFFORT LEVELS:
- quick_win: Can be done in 1-2 weeks with minimal resources
- moderate: 1-2 months, requires some coordination
- significant: 3+ months, major initiative required`

  const userPrompt = `Generate a strategic employer brand summary for ${companyName}.

COMPANY CONTEXT:
- Industry: ${industry || 'Not specified'}
- Location: ${location || 'Not specified'}

SCORES:
- Desirability: ${desirabilityScore}/100 (how positively AI describes them)
- AI Awareness: ${awarenessScore}/100 (how much AI knows about them)
- Differentiation: ${differentiationScore}/100 (how unique their brand is)

DIMENSION BREAKDOWN (vs competitor average):
${dimensionComparison}

IDENTIFIED STRENGTHS: ${competitorAnalysis.insights.strengths.join(', ') || 'None identified'}
IDENTIFIED GAPS: ${competitorAnalysis.insights.weaknesses.join(', ') || 'None identified'}

TOPIC COVERAGE:
- Covered: ${topicsCovered.join(', ') || 'None'}
- Missing: ${topicsMissing.join(', ') || 'None'}

SENTIMENT DISTRIBUTION (${totalResponses} responses):
- Strong (9-10): ${sentimentCounts.strong} (${Math.round(sentimentCounts.strong / totalResponses * 100)}%)
- Positive (6-8): ${sentimentCounts.positive} (${Math.round(sentimentCounts.positive / totalResponses * 100)}%)
- Mixed (4-5): ${sentimentCounts.mixed} (${Math.round(sentimentCounts.mixed / totalResponses * 100)}%)
- Negative (1-3): ${sentimentCounts.negative} (${Math.round(sentimentCounts.negative / totalResponses * 100)}%)

TOP COMPETITOR MENTIONS: ${topCompetitors.slice(0, 5).map(c => c.name).join(', ')}

COMPETITOR HIGHLIGHTS:
${competitorHighlights}

Create a strategic summary that a recruitment agent could present to this client.`

  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: strategicSummarySchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'strategic_summary',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Enrich strengths and gaps with actual scores
    const enrichedStrengths = result.object.strengths.slice(0, 3).map((s) => ({
      ...s,
      score: target.scores[s.dimension as EmployerDimension] || 5,
      competitorAvg: competitorAvg[s.dimension] || 5,
    }))

    const enrichedGaps = result.object.gaps.slice(0, 3).map((g) => ({
      ...g,
      score: target.scores[g.dimension as EmployerDimension] || 5,
      competitorAvg: competitorAvg[g.dimension] || 5,
    }))

    return {
      ...result.object,
      strengths: enrichedStrengths,
      gaps: enrichedGaps,
      recommendations: result.object.recommendations.slice(0, 7),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Strategic summary generation failed:', error)

    // Return a default summary on error
    return generateFallbackSummary(input, target, competitorAvg)
  }
}

/**
 * Generate a fallback summary when AI generation fails
 */
function generateFallbackSummary(
  input: StrategicSummaryInput,
  target: CompetitorAnalysis['employers'][0],
  competitorAvg: Record<string, number>
): StrategicSummary {
  const { companyName, desirabilityScore, awarenessScore, differentiationScore, competitorAnalysis } = input

  // Determine health
  const avgScore = (desirabilityScore + awarenessScore + differentiationScore) / 3
  const health = avgScore >= 70 ? 'strong' : avgScore >= 50 ? 'moderate' : avgScore >= 30 ? 'needs_attention' : 'critical'

  // Map strengths and gaps
  const strengths = competitorAnalysis.insights.strengths.slice(0, 2).map((dim) => ({
    dimension: dim,
    score: target.scores[dim] || 5,
    competitorAvg: competitorAvg[dim] || 5,
    headline: `Strong ${dim} positioning`,
    leverageStrategy: `Highlight ${dim} in careers content and job descriptions.`,
  }))

  const gaps = competitorAnalysis.insights.weaknesses.slice(0, 2).map((dim) => ({
    dimension: dim,
    score: target.scores[dim] || 5,
    competitorAvg: competitorAvg[dim] || 5,
    headline: `${dim.charAt(0).toUpperCase() + dim.slice(1)} needs improvement`,
    businessImpact: `May be losing candidates who prioritize ${dim}.`,
    topCompetitor: input.topCompetitors[0]?.name || 'Competitors',
  }))

  return {
    executiveSummary: `${companyName} has a ${health} AI employer reputation with a desirability score of ${desirabilityScore}/100. ${awarenessScore >= 50 ? 'AI assistants are reasonably informed about the company.' : 'There is opportunity to improve AI awareness of the company.'}`,
    competitivePositioning: `${companyName} is positioned ${differentiationScore >= 50 ? 'distinctively' : 'similarly to competitors'} in the ${input.industry || 'talent'} market.`,
    scoreInterpretation: {
      desirability: `At ${desirabilityScore}/100, AI describes ${companyName} ${desirabilityScore >= 60 ? 'favorably' : 'with mixed sentiment'} to job seekers.`,
      awareness: `AI awareness is ${awarenessScore >= 60 ? 'good' : awarenessScore >= 40 ? 'moderate' : 'limited'} at ${awarenessScore}/100.`,
      differentiation: `Brand differentiation is ${differentiationScore >= 60 ? 'strong' : differentiationScore >= 40 ? 'moderate' : 'weak'} at ${differentiationScore}/100.`,
      overallHealth: health,
    },
    strengths,
    gaps,
    recommendations: [
      {
        title: 'Audit careers page content',
        description: 'Review and update careers page to address topic gaps identified in AI responses.',
        effort: 'moderate' as const,
        impact: 'high' as const,
        priority: 'immediate' as const,
      },
      {
        title: 'Develop employee stories',
        description: 'Create authentic employee testimonials that highlight company strengths.',
        effort: 'moderate' as const,
        impact: 'medium' as const,
        priority: 'short_term' as const,
      },
    ],
    industryContext: `Performance is ${avgScore >= 50 ? 'competitive' : 'below average'} for the ${input.industry || 'tech'} sector.`,
    topTalentCompetitor: input.topCompetitors[0]?.name || 'Industry peers',
    generatedAt: new Date().toISOString(),
  }
}
