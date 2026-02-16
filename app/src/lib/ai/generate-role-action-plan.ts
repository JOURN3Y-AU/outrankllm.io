/**
 * Role-Specific Action Plan Generator for HiringBrand
 *
 * Generates targeted strategic summaries for specific job families
 * (Engineering, Business, Operations, Creative, Corporate)
 *
 * Similar to generate-strategic-summary.ts but focused on a single role family
 */

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { trackCost } from './costs'
import type { HBJobFamily, HBResponse } from '@/app/hiringbrand/report/components/shared/types'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Input data for role-specific action plan
export interface RoleActionPlanInput {
  // Company info
  companyName: string
  industry: string | null
  location: string | null

  // Role family
  roleFamily: HBJobFamily
  roleFamilyDisplayName: string

  // Role-specific scores (calculated from filtered responses)
  desirabilityScore: number
  awarenessScore: number

  // Filtered responses for this role family
  responses: HBResponse[]

  // Optional: Competitor dimension scores for this family
  competitorDimensionScores?: {
    [competitorName: string]: { [dimension: string]: number }
  }

  runId: string
}

// Zod schemas
const effortLevelSchema = z.enum(['quick_win', 'moderate', 'significant'])
const impactLevelSchema = z.enum(['high', 'medium', 'low'])
const prioritySchema = z.enum(['immediate', 'short_term', 'long_term'])
const dimensionSchema = z.enum(['compensation', 'culture', 'growth', 'balance', 'leadership', 'tech', 'mission'])

const roleRecommendationSchema = z.object({
  title: z.string().describe('Short action title (5-10 words)'),
  description: z.string().describe('Specific, actionable description for this role family (1-2 sentences)'),
  effort: effortLevelSchema,
  impact: impactLevelSchema,
  priority: prioritySchema,
  relatedDimension: dimensionSchema.optional(),
})

const roleStrengthSchema = z.object({
  dimension: dimensionSchema,
  headline: z.string().describe('Positive headline about this role family (e.g., "Engineering comp is competitive")'),
  leverageStrategy: z.string().describe('How to amplify this strength for recruiting this role family (1-2 sentences)'),
})

const roleGapSchema = z.object({
  dimension: dimensionSchema,
  headline: z.string().describe('Opportunity-framed headline (e.g., "Career paths for engineers unclear")'),
  businessImpact: z.string().describe('Talent attraction impact for this role family (1 sentence)'),
  topCompetitor: z.string().describe('Competitor doing this well for this role family'),
})

const roleActionPlanSchema = z.object({
  executiveSummary: z.string().describe('3 sentences about this role family\'s brand health: 1) lead with strength, 2) note watch area, 3) highlight opportunity'),
  strengths: z.array(roleStrengthSchema).describe('2-3 key strengths for this role family with leverage strategies'),
  gaps: z.array(roleGapSchema).describe('2-3 opportunities for improvement for this role family'),
  recommendations: z.array(roleRecommendationSchema).describe('3-5 prioritized actions specific to this role family'),
  roleSpecificContext: z.string().describe('1-2 sentences about how this role family perceives the employer relative to industry (specific context)'),
})

export type RoleActionPlan = z.infer<typeof roleActionPlanSchema>

/**
 * Generate role-specific action plan from filtered response data
 */
export async function generateRoleActionPlan(
  input: RoleActionPlanInput
): Promise<RoleActionPlan> {
  const {
    companyName,
    industry,
    location,
    roleFamily,
    roleFamilyDisplayName,
    desirabilityScore,
    awarenessScore,
    responses,
    runId,
  } = input

  // Calculate sentiment distribution for this role family
  const sentimentCounts = {
    strong: responses.filter((r) => r.sentimentCategory === 'strong').length,
    positive: responses.filter((r) => r.sentimentCategory === 'positive').length,
    mixed: responses.filter((r) => r.sentimentCategory === 'mixed').length,
    negative: responses.filter((r) => r.sentimentCategory === 'negative').length,
  }

  const totalResponses = responses.length

  // Extract key phrases from responses
  const positiveHighlights = responses.flatMap((r) => r.positiveHighlights || []).slice(0, 10)
  const negativeHighlights = responses.flatMap((r) => r.negativeHighlights || []).slice(0, 10)
  const greenFlags = responses.flatMap((r) => r.greenFlags || []).slice(0, 5)
  const redFlags = responses.flatMap((r) => r.redFlags || []).slice(0, 5)

  // Get competitors mentioned in role-specific responses
  const competitorMentions = responses.flatMap((r) => r.competitorsMentioned || [])
  const competitorCounts = new Map<string, number>()
  for (const mention of competitorMentions) {
    competitorCounts.set(mention.name, (competitorCounts.get(mention.name) || 0) + 1)
  }
  const topCompetitors = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  const systemPrompt = `You are a senior employer branding consultant creating a role-specific strategic summary for ${roleFamilyDisplayName} roles.

This is part of a larger employer branding analysis, but THIS SUMMARY focuses ONLY on how ${companyName} is perceived for ${roleFamilyDisplayName}.

TONE & LANGUAGE:
1. ALWAYS lead with strengths specific to this role family
2. Frame gaps as OPPORTUNITIES for improving talent attraction in this role family
3. Be SPECIFIC to ${roleFamilyDisplayName} — not generic employer advice
4. NEVER use alarmist language: use "developing", "emerging", "room to grow", "opportunity"
5. Consider what matters specifically to ${roleFamilyDisplayName} professionals
6. The executive summary MUST: (1) Lead with strength for this role, (2) Note watch area, (3) Highlight opportunity

SCORING INTERPRETATION (for this role family):
- 70-100: Strong positioning for ${roleFamilyDisplayName} talent
- 50-69: Solid foundation with clear opportunities
- 30-49: Developing presence, significant opportunity to differentiate
- 0-29: Early stage, major opportunity to build distinct reputation

Remember: Mid-range scores (30-60) are NORMAL and represent opportunity, not failure.`

  const userPrompt = `Create a role-specific strategic summary for ${companyName}'s employer brand for ${roleFamilyDisplayName}.

COMPANY CONTEXT:
- Industry: ${industry || 'Not specified'}
- Location: ${location || 'Not specified'}

ROLE FAMILY SCORES (for ${roleFamilyDisplayName} only):
- Desirability: ${desirabilityScore}/100 (how positively AI describes ${companyName} for ${roleFamilyDisplayName})
- AI Awareness: ${awarenessScore}/100 (how much AI knows about ${companyName} for ${roleFamilyDisplayName})

SENTIMENT DISTRIBUTION (${totalResponses} ${roleFamilyDisplayName}-specific responses):
- Strong (9-10): ${sentimentCounts.strong} (${totalResponses > 0 ? Math.round((sentimentCounts.strong / totalResponses) * 100) : 0}%)
- Positive (6-8): ${sentimentCounts.positive} (${totalResponses > 0 ? Math.round((sentimentCounts.positive / totalResponses) * 100) : 0}%)
- Mixed (4-5): ${sentimentCounts.mixed} (${totalResponses > 0 ? Math.round((sentimentCounts.mixed / totalResponses) * 100) : 0}%)
- Negative (1-3): ${sentimentCounts.negative} (${totalResponses > 0 ? Math.round((sentimentCounts.negative / totalResponses) * 100) : 0}%)

${positiveHighlights.length > 0 ? `POSITIVE HIGHLIGHTS (from AI responses about ${roleFamilyDisplayName}):\n${positiveHighlights.slice(0, 5).map((h) => `- "${h}"`).join('\n')}` : ''}

${negativeHighlights.length > 0 ? `AREAS TO ADDRESS (from AI responses about ${roleFamilyDisplayName}):\n${negativeHighlights.slice(0, 5).map((h) => `- "${h}"`).join('\n')}` : ''}

${greenFlags.length > 0 ? `GREEN FLAGS for ${roleFamilyDisplayName}: ${greenFlags.join(', ')}` : ''}

${redFlags.length > 0 ? `RED FLAGS for ${roleFamilyDisplayName}: ${redFlags.join(', ')}` : ''}

${topCompetitors.length > 0 ? `TOP COMPETITORS FOR ${roleFamilyDisplayName.toUpperCase()} TALENT: ${topCompetitors.join(', ')}` : ''}

Create a strategic summary that helps ${companyName} strengthen their employer brand specifically for ${roleFamilyDisplayName} talent. Focus on what matters to ${roleFamilyDisplayName} professionals (e.g., compensation, growth paths, tech stack for engineering; deal flow and quota attainment for sales; etc.).

Keep recommendations SPECIFIC to ${roleFamilyDisplayName} — not generic employer branding advice.`

  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: roleActionPlanSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3, // Lower temperature for consistent strategic advice
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `role_action_plan_${roleFamily}`,
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    console.log(`[generateRoleActionPlan] Generated action plan for ${roleFamily}:`, {
      desirability: desirabilityScore,
      awareness: awarenessScore,
      responseCount: totalResponses,
      recommendations: result.object.recommendations.length,
    })

    return result.object
  } catch (error) {
    console.error(`[generateRoleActionPlan] Error generating plan for ${roleFamily}:`, error)

    // Fallback: Return minimal action plan
    return {
      executiveSummary: `${companyName} is building its employer brand for ${roleFamilyDisplayName} roles. With a desirability score of ${desirabilityScore}/100, there is significant opportunity to strengthen how AI platforms describe the company to ${roleFamilyDisplayName} talent. Focus on increasing visibility and highlighting key differentiators that matter to ${roleFamilyDisplayName} professionals.`,
      strengths: [],
      gaps: [],
      recommendations: [
        {
          title: `Build ${roleFamilyDisplayName} content strategy`,
          description: `Create and publish content that showcases ${companyName}'s strengths for ${roleFamilyDisplayName} professionals.`,
          effort: 'moderate',
          impact: 'high',
          priority: 'immediate',
        },
      ],
      roleSpecificContext: `Based on ${totalResponses} AI responses about ${roleFamilyDisplayName} roles, ${companyName} has an opportunity to strengthen its positioning for this talent pool.`,
    }
  }
}
