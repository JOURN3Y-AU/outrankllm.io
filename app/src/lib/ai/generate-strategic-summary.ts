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
  headline: z.string().describe('Positive headline (e.g., "Industry-leading work-life balance")'),
  leverageStrategy: z.string().describe('How to amplify this in employer branding (1-2 sentences)'),
})

const gapInsightSchema = z.object({
  dimension: dimensionSchema,
  headline: z.string().describe('Opportunity-framed headline (e.g., "Room to strengthen compensation story")'),
  businessImpact: z.string().describe('The talent attraction opportunity this represents (1 sentence)'),
  topCompetitor: z.string().describe('Name of competitor doing this well to learn from'),
})

const strategicSummarySchema = z.object({
  executiveSummary: z.string().describe('3 sentences: 1) lead with a genuine strength, 2) note an area to watch, 3) highlight the biggest opportunity. Balanced and constructive.'),
  competitivePositioning: z.string().describe('One-liner positioning statement — constructive, not defensive'),
  scoreInterpretation: z.object({
    desirability: z.string().describe('What the desirability score means (1 sentence, constructive)'),
    awareness: z.string().describe('What the AI awareness score means (1 sentence, constructive)'),
    differentiation: z.string().describe('What the differentiation score means (1 sentence, constructive)'),
    overallHealth: healthSchema.describe('Overall employer brand health — use moderate or strong unless truly dire'),
  }),
  strengths: z.array(strengthInsightSchema).describe('2-3 key strengths with leverage strategies'),
  gaps: z.array(gapInsightSchema).describe('2-3 key opportunities for improvement'),
  recommendations: z.array(recommendationSchema).describe('5-7 prioritized actions'),
  industryContext: z.string().describe('How this compares to industry norms (1-2 sentences, constructive)'),
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

  // Filter out the company being analyzed — it can appear in topCompetitors because AI
  // responses frequently mention the employer by name when describing them.
  const filteredTopCompetitors = topCompetitors.filter(
    (c) => c.name.toLowerCase() !== companyName.toLowerCase()
  )

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

  const systemPrompt = `You are a senior employer branding consultant creating a strategic summary for a recruitment agency to present to their hiring client.

Your goal is to help the client understand their AI employer reputation and the opportunities available to strengthen it. This is a CONSULTATIVE conversation, not an audit.

TONE & LANGUAGE:
1. ALWAYS lead with strengths — every company has genuine positives. Find them.
2. Frame gaps as OPPORTUNITIES, never as failures. Say "room to strengthen" not "weak". Say "opportunity to differentiate" not "falling behind". Say "emerging presence" not "invisible".
3. Be SPECIFIC and ACTIONABLE — reference actual scores, competitors, and dimensions.
4. NEVER use alarmist language: avoid "crisis", "critical", "invisible", "failing", "weak", "poor", "alarming", "concerning". Instead use "developing", "emerging", "room to grow", "opportunity", "building".
5. The executive summary MUST follow this arc: (1) Lead with a genuine strength, (2) Note something to watch or build on, (3) Highlight the biggest opportunity for improvement.
6. Consider the INDUSTRY context — what matters for ${industry || 'this sector'}.
7. Even low scores represent opportunity, not failure. Most companies are early in their AI employer brand journey.

SCORING INTERPRETATION (use these to inform overallHealth):
- 70-100: Strong — well positioned, actively attracting talent via AI
- 50-69: Moderate — solid foundation with clear opportunities to strengthen
- 30-49: Moderate or needs_attention — developing presence, significant room to grow (use "moderate" for scores above 40, "needs_attention" only below 40)
- 0-29: needs_attention or critical — early stage, but this represents the biggest opportunity for differentiation (only use "critical" for scores below 15)

IMPORTANT: Most companies score 30-60. This is NORMAL for AI employer branding — it is a new field. Do not treat mid-range scores as a problem. Frame them as a strong foundation to build on.

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

COMPETITORS (use these names for topCompetitor — NEVER use ${companyName} itself): ${filteredTopCompetitors.slice(0, 5).map(c => c.name).join(', ')}

COMPETITOR HIGHLIGHTS:
${competitorHighlights}

Create a strategic summary that a recruitment agent could confidently present to this client. Remember: lead with strengths, frame gaps as opportunities, and keep the tone constructive throughout. The executive summary must follow the strength → watch → opportunity arc.`

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

    // Fallback competitor name if the AI picked the company itself
    const fallbackCompetitor = filteredTopCompetitors[0]?.name ?? competitors[0]?.name ?? 'a competitor'

    const enrichedGaps = result.object.gaps.slice(0, 3).map((g) => ({
      ...g,
      score: target.scores[g.dimension as EmployerDimension] || 5,
      competitorAvg: competitorAvg[g.dimension] || 5,
      topCompetitor:
        g.topCompetitor.toLowerCase() === companyName.toLowerCase()
          ? fallbackCompetitor
          : g.topCompetitor,
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

  // Determine health — use softer thresholds
  const avgScore = (desirabilityScore + awarenessScore + differentiationScore) / 3
  const health = avgScore >= 70 ? 'strong' : avgScore >= 40 ? 'moderate' : avgScore >= 15 ? 'needs_attention' : 'critical'

  // Map strengths and gaps
  const strengths = competitorAnalysis.insights.strengths.slice(0, 2).map((dim) => ({
    dimension: dim,
    score: target.scores[dim] || 5,
    competitorAvg: competitorAvg[dim] || 5,
    headline: `Strong ${dim} positioning`,
    leverageStrategy: `Amplify ${dim} across careers content and candidate touchpoints to reinforce this advantage.`,
  }))

  const gaps = competitorAnalysis.insights.weaknesses.slice(0, 2).map((dim) => ({
    dimension: dim,
    score: target.scores[dim] || 5,
    competitorAvg: competitorAvg[dim] || 5,
    headline: `Room to strengthen ${dim} story`,
    businessImpact: `Strengthening the ${dim} narrative could attract candidates who prioritise this area.`,
    topCompetitor: input.topCompetitors[0]?.name || 'Competitors',
  }))

  return {
    executiveSummary: `${companyName} has genuine strengths in how AI platforms describe the company, with a desirability score of ${desirabilityScore}/100. ${awarenessScore >= 50 ? 'AI assistants are well-informed about the company, providing a solid foundation to build on.' : 'There is a significant opportunity to shape how AI platforms talk about the company to candidates.'} ${differentiationScore >= 50 ? 'The brand stands out from competitors.' : 'With targeted effort, there is room to create a more distinctive employer brand narrative.'}`,
    competitivePositioning: `${companyName} has a ${differentiationScore >= 50 ? 'distinctive' : 'developing'} position in the ${input.industry || 'talent'} market with clear opportunities to strengthen competitive differentiation.`,
    scoreInterpretation: {
      desirability: `At ${desirabilityScore}/100, AI describes ${companyName} ${desirabilityScore >= 60 ? 'positively' : 'with a mix of perspectives'} — ${desirabilityScore >= 60 ? 'a strong foundation' : 'an opportunity to shape the narrative'}.`,
      awareness: `AI awareness at ${awarenessScore}/100 means ${awarenessScore >= 60 ? 'platforms have good knowledge to draw from' : awarenessScore >= 40 ? 'there is a solid base with room to grow' : 'there is significant opportunity to increase visibility'}.`,
      differentiation: `Brand differentiation at ${differentiationScore}/100 ${differentiationScore >= 60 ? 'shows the company stands out well' : differentiationScore >= 40 ? 'shows a solid base to build distinctive positioning' : 'presents the biggest opportunity — targeted effort here can create real competitive advantage'}.`,
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
    industryContext: `Performance is ${avgScore >= 50 ? 'competitive' : 'developing'} for the ${input.industry || 'tech'} sector, with clear pathways to strengthen positioning.`,
    topTalentCompetitor: input.topCompetitors[0]?.name || 'Industry peers',
    generatedAt: new Date().toISOString(),
  }
}
