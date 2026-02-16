/**
 * Job Family Classification for HiringBrand
 *
 * Classifies commonRoles into 5 standard job families using LLM:
 * - Engineering & Tech
 * - Sales & Business
 * - Operations & Supply Chain
 * - Creative & Design
 * - Corporate Functions
 *
 * Returns top N most relevant families based on role analysis.
 */

import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { trackCost } from './costs'
import type { HBJobFamily } from '@/app/hiringbrand/report/components/shared/types'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Job family definitions
export const JOB_FAMILY_DEFINITIONS = {
  engineering: {
    label: 'Engineering & Tech',
    description: 'Software engineers, data scientists, DevOps, IT, technical roles',
    keywords: ['engineer', 'developer', 'data scientist', 'devops', 'sre', 'architect', 'programmer', 'software', 'tech'],
  },
  business: {
    label: 'Sales & Business',
    description: 'Sales, marketing, product management, customer success, business development',
    keywords: ['sales', 'marketing', 'product', 'account', 'customer success', 'business development', 'growth'],
  },
  operations: {
    label: 'Operations & Supply Chain',
    description: 'Operations, logistics, supply chain, procurement, warehouse',
    keywords: ['operations', 'logistics', 'supply', 'procurement', 'warehouse', 'fulfillment', 'inventory'],
  },
  creative: {
    label: 'Creative & Design',
    description: 'Designers, content creators, UX/UI, brand, visual/graphic',
    keywords: ['design', 'creative', 'ux', 'ui', 'content', 'brand', 'graphic', 'visual', 'writer'],
  },
  corporate: {
    label: 'Corporate Functions',
    description: 'Finance, HR, legal, administration, compliance',
    keywords: ['finance', 'hr', 'legal', 'admin', 'accounting', 'compliance', 'people', 'talent'],
  },
} as const

// Detected job family with relevance scoring
export interface DetectedJobFamily {
  family: HBJobFamily
  label: string
  roles: string[] // Which roles from commonRoles belong to this family
  relevance: number // 0-1 score indicating how important this family is for this employer
}

// Zod schema for structured output
const detectedFamilySchema = z.object({
  family: z.enum(['engineering', 'business', 'operations', 'creative', 'corporate']).describe('Standard family code'),
  roles: z.array(z.string()).describe('Job roles from the input that belong to this family'),
  relevance: z.number().min(0).max(1).describe('0-1 score: how critical is this family for this employer?'),
  reasoning: z.string().optional().describe('Brief explanation of why this family is relevant'),
})

const classificationResultSchema = z.object({
  families: z.array(detectedFamilySchema).describe('Detected job families sorted by relevance (highest first)'),
  industryContext: z.string().describe('Brief context about how these families reflect the industry (1 sentence)'),
})

/**
 * Classifies commonRoles into standard job families using Claude
 *
 * @param commonRoles - Array of job titles extracted from employer site
 * @param industry - Industry context (optional, helps with classification)
 * @param maxFamilies - Maximum number of families to return
 * @returns Array of detected job families sorted by relevance
 */
export async function classifyJobFamilies(
  commonRoles: string[],
  industry: string | null,
  maxFamilies: number = 5
): Promise<DetectedJobFamily[]> {
  // Handle empty or missing roles
  if (!commonRoles || commonRoles.length === 0) {
    console.warn('classifyJobFamilies: No commonRoles provided, returning empty array')
    return []
  }

  const prompt = `You are analyzing job roles for an employer brand study.

EMPLOYER CONTEXT:
${industry ? `Industry: ${industry}` : 'Industry: Unknown'}
Common job roles advertised: ${commonRoles.join(', ')}

TASK:
Classify these roles into our 5 standard job families:

1. **Engineering & Tech** - Software engineers, data scientists, DevOps, IT, technical roles
2. **Sales & Business** - Sales, marketing, product management, customer success, business development
3. **Operations & Supply Chain** - Operations, logistics, supply chain, procurement, warehouse
4. **Creative & Design** - Designers, content creators, UX/UI, brand, visual/graphic
5. **Corporate Functions** - Finance, HR, legal, administration, compliance

GUIDELINES:
- A family is relevant if the employer actively hires for those roles
- Relevance score (0-1):
  - 1.0 = Core strategic hiring (e.g., Engineering for a tech company)
  - 0.8 = Strong demand, multiple senior roles
  - 0.6 = Regular hiring, important but not strategic
  - 0.4 = Occasional hiring, supporting roles
  - 0.2 = Minimal hiring activity
- If a role doesn't clearly fit, use the closest family or omit if truly unclear
- Return ALL relevant families, we'll limit to top ${maxFamilies} later
- Sort by relevance (highest first)

EXAMPLES:
- Tech startup with "Software Engineer, Product Manager, UX Designer" → Engineering (1.0), Business (0.7), Creative (0.6)
- Retail chain with "Store Manager, Buying Manager, Logistics Coordinator" → Operations (1.0), Business (0.5), Corporate (0.3)
- Law firm with "Associate Attorney, Paralegal, Legal Secretary" → Corporate (1.0)

Now classify the roles for this employer.`

  try {
    const startTime = Date.now()

    const { object: result } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: classificationResultSchema,
      prompt,
      temperature: 0.3, // Lower temperature for consistent classifications
    })

    const duration = Date.now() - startTime

    // Track cost
    await trackCost({
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      operation: 'classify_job_families',
      inputTokens: Math.ceil(prompt.length / 4), // Rough estimate
      outputTokens: Math.ceil(JSON.stringify(result).length / 4),
      duration,
      metadata: {
        industry: industry || 'unknown',
        roleCount: commonRoles.length,
        familiesDetected: result.families.length,
      },
    })

    // Map to DetectedJobFamily interface with labels
    const detectedFamilies: DetectedJobFamily[] = result.families.map((f) => ({
      family: f.family,
      label: JOB_FAMILY_DEFINITIONS[f.family].label,
      roles: f.roles,
      relevance: f.relevance,
    }))

    // Sort by relevance and limit to maxFamilies
    const topFamilies = detectedFamilies.sort((a, b) => b.relevance - a.relevance).slice(0, maxFamilies)

    console.log(`[classifyJobFamilies] Detected ${topFamilies.length} families:`, {
      families: topFamilies.map((f) => `${f.family}:${f.relevance.toFixed(2)}`).join(', '),
      industry,
      roleCount: commonRoles.length,
    })

    return topFamilies
  } catch (error) {
    console.error('[classifyJobFamilies] Error classifying job families:', error)

    // Fallback: Use keyword matching if AI fails
    console.warn('[classifyJobFamilies] Using fallback keyword matching')
    return fallbackClassification(commonRoles, maxFamilies)
  }
}

/**
 * Fallback classification using simple keyword matching
 * Used when AI classification fails
 */
function fallbackClassification(commonRoles: string[], maxFamilies: number): DetectedJobFamily[] {
  const familyCounts: Record<HBJobFamily, { roles: string[]; matches: number }> = {
    engineering: { roles: [], matches: 0 },
    business: { roles: [], matches: 0 },
    operations: { roles: [], matches: 0 },
    creative: { roles: [], matches: 0 },
    corporate: { roles: [], matches: 0 },
    general: { roles: [], matches: 0 },
  }

  // Count keyword matches per family
  for (const role of commonRoles) {
    const roleLower = role.toLowerCase()
    let matched = false

    for (const [familyKey, definition] of Object.entries(JOB_FAMILY_DEFINITIONS)) {
      const family = familyKey as HBJobFamily
      const keywordMatches = definition.keywords.some((keyword) => roleLower.includes(keyword))

      if (keywordMatches) {
        familyCounts[family].roles.push(role)
        familyCounts[family].matches++
        matched = true
        break // Each role only counts toward one family
      }
    }

    if (!matched) {
      familyCounts.general.roles.push(role)
      familyCounts.general.matches++
    }
  }

  // Convert to DetectedJobFamily array
  const detected: DetectedJobFamily[] = []

  for (const [familyKey, data] of Object.entries(familyCounts)) {
    const family = familyKey as HBJobFamily
    if (data.matches > 0 && family !== 'general') {
      detected.push({
        family,
        label: JOB_FAMILY_DEFINITIONS[family].label,
        roles: data.roles,
        relevance: Math.min(1, data.matches / commonRoles.length), // Simple relevance: proportion of roles
      })
    }
  }

  // Sort by matches and limit
  return detected.sort((a, b) => b.relevance - a.relevance).slice(0, maxFamilies)
}
