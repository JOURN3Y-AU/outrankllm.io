/**
 * Employer Research Module (HiringBrand)
 * Extracts competitor employers and generates job seeker questions
 * Similar to query-research.ts but focused on employer reputation
 */

import { generateText, createGateway } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { trackCost } from './costs'

// Initialize Google with explicit API key
const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    '',
})

// Check if gateway API key is available
const hasGatewayKey = !!(process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY)

// Initialize Vercel AI Gateway (only used if key is present)
const gateway = hasGatewayKey
  ? createGateway({
      apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
    })
  : null

export type Platform = 'chatgpt' | 'claude' | 'gemini'

export type EmployerQuestionCategory =
  | 'reputation' // General "what's it like to work at"
  | 'culture' // Culture, values, environment
  | 'compensation' // Pay, benefits
  | 'growth' // Career progression, learning
  | 'comparison' // vs competitor employers
  | 'industry' // Best employers in industry
  | 'balance' // Work-life balance, flexibility
  | 'leadership' // Management quality
  | 'role_insights' // Role-specific questions about job families

export type JobFamily = 'engineering' | 'business' | 'operations' | 'creative' | 'corporate' | 'general'

export interface CompetitorEmployer {
  name: string
  domain?: string
  reason: string // Why they compete for talent
}

export interface EmployerQuestion {
  question: string
  category: EmployerQuestionCategory
  suggestedBy: Platform[]
  relevanceScore: number
  jobFamily?: JobFamily // Role family this question is about (null for general questions)
}

export interface EmployerAnalysis {
  companyName: string
  industry: string
  location: string
  companySize?: string
  commonRoles?: string[]
  cultureKeywords?: string[]
  benefits?: string[]
}

export interface EmployerResearchResult {
  competitors: CompetitorEmployer[]
  questions: EmployerQuestion[]
}

// Combined prompt that extracts competitors AND generates questions
const EMPLOYER_RESEARCH_PROMPT = `You're helping job seekers research an employer.

## Company Details
- Name: {companyName}
- Industry: {industry}
- Location: {location}
- Size: {companySize}
- Common roles hired: {commonRoles}
- Culture keywords: {cultureKeywords}

## Task 1: Identify Competitor Employers (for talent)

List 3-5 companies that compete for the SAME TALENT as {companyName}:
- Similar industry or adjacent industries
- Similar location/market
- Hire similar roles
- Comparable size or prestige level

These are TALENT competitors (compete for employees), not necessarily business competitors.

CRITICAL: DO NOT include:
- {companyName}'s own products, brands, or subsidiaries (e.g., if analyzing Atlassian, do NOT list Jira, Confluence, Trello, Bitbucket - these are Atlassian products)
- Internal tools or services owned by {companyName}
- Companies that have been acquired by {companyName}
Only list SEPARATE, INDEPENDENT companies that compete for talent.

## Task 2: Generate Job Seeker Questions

Generate 10 questions a job seeker would ask an AI assistant when researching {companyName}.

Distribution:
- 3x Reputation: "What's it like to work at {companyName}?" style questions
- 2x Culture: About culture, values, work environment
- 1x Compensation: About pay, benefits, perks
- 1x Growth: Career progression, learning opportunities
- 2x Comparison: Compare {companyName} to a competitor (use names from Task 1!)
- 1x Industry: "Best [industry] companies to work for in [location]"

CRITICAL RULES:
1. Questions must lead to the AI NAMING specific employers, not giving generic advice
2. Use actual competitor names in comparison questions
3. Include location "{location}" in industry questions
4. Questions should sound natural, like a real person asking

✅ GOOD: "What's it like to work at {companyName}?"
✅ GOOD: "Is {companyName} or [Competitor] better for engineers?"
✅ GOOD: "Best tech companies to work for in Sydney"
❌ BAD: "How do I negotiate salary?" (generic advice)
❌ BAD: "What should I look for in an employer?" (no company names)

## Response Format

Return ONLY valid JSON:
{{
  "competitors": [
    {{"name": "Company Name", "domain": "company.com", "reason": "competes for [role] talent in [location]"}}
  ],
  "questions": [
    {{"question": "What's it like to work at {companyName}?", "category": "reputation"}}
  ]
}}`

// Simpler prompt for just question generation (when competitors already known)
const QUESTION_GENERATION_PROMPT = `You're a job seeker researching: {companyName}

Industry: {industry}
Location: {location}
Competitor employers: {competitors}

Generate 10 questions you'd ask an AI assistant about working at {companyName}.

Mix these categories:
- reputation (3): "What's it like to work at..."
- culture (2): Culture, values, environment
- compensation (1): Pay, benefits
- growth (1): Career progression
- comparison (2): "{companyName} vs {competitor}?" - USE THE COMPETITOR NAMES PROVIDED
- industry (1): "Best {industry} employers in {location}"

CRITICAL: Questions must lead to AI naming specific companies.
✅ "What's it like to work at {companyName}?"
✅ "Is {companyName} or {competitor} better for engineers?"
❌ "How do I prepare for interviews?" (generic)

Return ONLY a JSON array:
[{{"question": "...", "category": "reputation|culture|compensation|growth|comparison|industry"}}]`

/**
 * Research employer on a single platform
 * Returns competitors and questions
 */
export async function researchEmployerOnPlatform(
  analysis: EmployerAnalysis,
  platform: Platform,
  runId: string,
  existingCompetitors?: CompetitorEmployer[]
): Promise<{ competitors: CompetitorEmployer[]; questions: Array<{ question: string; category: string }> }> {
  // If we already have competitors, just generate questions
  const useFullPrompt = !existingCompetitors || existingCompetitors.length === 0

  const prompt = useFullPrompt
    ? EMPLOYER_RESEARCH_PROMPT.replace(/{companyName}/g, analysis.companyName)
        .replace(/{industry}/g, analysis.industry || 'Technology')
        .replace(/{location}/g, analysis.location || 'Not specified')
        .replace(/{companySize}/g, analysis.companySize || 'Not specified')
        .replace(/{commonRoles}/g, analysis.commonRoles?.join(', ') || 'Various')
        .replace(/{cultureKeywords}/g, analysis.cultureKeywords?.join(', ') || 'Not specified')
    : QUESTION_GENERATION_PROMPT.replace(/{companyName}/g, analysis.companyName)
        .replace(/{industry}/g, analysis.industry || 'Technology')
        .replace(/{location}/g, analysis.location || 'Not specified')
        .replace(/{competitors}/g, existingCompetitors.map((c) => c.name).join(', '))
        .replace(/{competitor}/g, existingCompetitors[0]?.name || 'competitors')

  try {
    const modelMap: Record<Platform, string> = {
      chatgpt: 'openai/gpt-4o',
      claude: 'anthropic/claude-sonnet-4-20250514',
      gemini: 'google/gemini-2.0-flash',
    }

    const model = gateway
      ? gateway(modelMap[platform])
      : platform === 'chatgpt'
        ? openai('gpt-4o')
        : platform === 'claude'
          ? anthropic('claude-sonnet-4-20250514')
          : google('gemini-2.0-flash')

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 1200,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `employer_research_${platform}`,
        model: modelMap[platform],
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse JSON response
    const text = result.text.trim()

    if (useFullPrompt) {
      // Full research prompt returns object with competitors and questions
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(`No JSON object found in ${platform} employer research response`)
        return { competitors: [], questions: [] }
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        competitors?: CompetitorEmployer[]
        questions?: Array<{ question: string; category: string }>
      }

      return {
        competitors: parsed.competitors || [],
        questions: parsed.questions || [],
      }
    } else {
      // Question-only prompt returns array
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.error(`No JSON array found in ${platform} question response`)
        return { competitors: existingCompetitors || [], questions: [] }
      }

      const questions = JSON.parse(jsonMatch[0]) as Array<{ question: string; category: string }>
      return {
        competitors: existingCompetitors || [],
        questions,
      }
    }
  } catch (error) {
    console.error(`Employer research failed for ${platform}:`, error)
    return { competitors: [], questions: [] }
  }
}

/**
 * Validate and normalize question category
 */
function validateCategory(category: string): EmployerQuestionCategory {
  const validCategories: EmployerQuestionCategory[] = [
    'reputation',
    'culture',
    'compensation',
    'growth',
    'comparison',
    'industry',
    'balance',
    'leadership',
    'role_insights',
  ]

  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '') // Allow underscores for role_insights
  return validCategories.includes(normalized as EmployerQuestionCategory)
    ? (normalized as EmployerQuestionCategory)
    : 'reputation'
}

/**
 * Calculate similarity between two questions
 */
function questionSimilarity(q1: string, q2: string): number {
  const words1 = new Set(
    q1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )
  const words2 = new Set(
    q2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )

  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = [...words1].filter((w) => words2.has(w)).length
  const union = new Set([...words1, ...words2]).size

  return intersection / union
}

/**
 * Dedupe competitors from multiple platforms
 */
function dedupeCompetitors(allCompetitors: CompetitorEmployer[]): CompetitorEmployer[] {
  const seen = new Map<string, CompetitorEmployer>()

  for (const comp of allCompetitors) {
    const key = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!seen.has(key)) {
      seen.set(key, comp)
    }
  }

  return [...seen.values()].slice(0, 5) // Max 5 competitors
}

/**
 * Dedupe and rank questions from multiple platforms
 */
function dedupeAndRankQuestions(
  allQuestions: Array<{ question: string; category: string; platform: Platform }>,
  limit: number = 10
): EmployerQuestion[] {
  const groups = new Map<string, Array<{ question: string; category: string; platform: Platform }>>()
  const SIMILARITY_THRESHOLD = 0.5

  // Group similar questions
  for (const q of allQuestions) {
    let foundGroup = false

    for (const [representative, group] of groups) {
      if (questionSimilarity(q.question, representative) >= SIMILARITY_THRESHOLD) {
        group.push(q)
        foundGroup = true
        break
      }
    }

    if (!foundGroup) {
      groups.set(q.question, [q])
    }
  }

  // Convert groups to ranked questions
  const ranked: EmployerQuestion[] = []

  for (const [, group] of groups) {
    // Find best question in group (prefer medium length)
    const bestQuestion = group.reduce((best, current) => {
      const bestLen = best.question.length
      const currentLen = current.question.length
      const bestScore = bestLen >= 30 && bestLen <= 80 ? 1 : 0
      const currentScore = currentLen >= 30 && currentLen <= 80 ? 1 : 0
      return currentScore > bestScore ? current : best
    })

    // Get unique platforms
    const platforms = [...new Set(group.map((q) => q.platform))]

    // Most common category
    const categoryCount = new Map<string, number>()
    for (const q of group) {
      categoryCount.set(q.category, (categoryCount.get(q.category) || 0) + 1)
    }
    const mostCommonCategory = [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0][0]

    ranked.push({
      question: bestQuestion.question,
      category: validateCategory(mostCommonCategory),
      suggestedBy: platforms,
      relevanceScore: platforms.length * 10, // Higher = more platforms agreed
    })
  }

  // Sort by relevance
  ranked.sort((a, b) => b.relevanceScore - a.relevanceScore)

  // Ensure category diversity
  const selected: EmployerQuestion[] = []
  const categoryCounts = new Map<EmployerQuestionCategory, number>()
  const maxPerCategory = Math.ceil(limit / 3)

  for (const q of ranked) {
    if (selected.length >= limit) break

    const count = categoryCounts.get(q.category) || 0
    if (count < maxPerCategory) {
      selected.push(q)
      categoryCounts.set(q.category, count + 1)
    }
  }

  // Fill remaining slots
  if (selected.length < limit) {
    for (const q of ranked) {
      if (selected.length >= limit) break
      if (!selected.includes(q)) {
        selected.push(q)
      }
    }
  }

  return selected
}

/**
 * Full employer research across all platforms
 * Returns deduplicated competitors and questions
 */
export async function researchEmployer(
  analysis: EmployerAnalysis,
  runId: string,
  onProgress?: (platform: Platform, step: 'researching' | 'complete') => void
): Promise<EmployerResearchResult> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini']
  const allCompetitors: CompetitorEmployer[] = []
  const allQuestions: Array<{ question: string; category: string; platform: Platform }> = []

  // Phase 1: Get competitors from first platform (ChatGPT)
  onProgress?.('chatgpt', 'researching')
  const chatgptResult = await researchEmployerOnPlatform(analysis, 'chatgpt', runId)
  allCompetitors.push(...chatgptResult.competitors)
  allQuestions.push(
    ...chatgptResult.questions.map((q) => ({ ...q, platform: 'chatgpt' as Platform }))
  )
  onProgress?.('chatgpt', 'complete')

  // Dedupe competitors so far
  const competitors = dedupeCompetitors(allCompetitors)

  // Phase 2: Get questions from other platforms (using known competitors)
  for (const platform of platforms.slice(1)) {
    onProgress?.(platform, 'researching')

    await new Promise((resolve) => setTimeout(resolve, 300)) // Rate limit

    const result = await researchEmployerOnPlatform(analysis, platform, runId, competitors)

    // Add any new competitors found
    if (result.competitors.length > 0) {
      allCompetitors.push(...result.competitors)
    }

    allQuestions.push(...result.questions.map((q) => ({ ...q, platform })))
    onProgress?.(platform, 'complete')
  }

  // Final deduplication
  const finalCompetitors = dedupeCompetitors(allCompetitors)
  const finalQuestions = dedupeAndRankQuestions(allQuestions, 10)

  return {
    competitors: finalCompetitors,
    questions: finalQuestions,
  }
}

/**
 * Generate fallback questions if research fails
 */
export function generateFallbackEmployerQuestions(
  analysis: EmployerAnalysis,
  competitors: CompetitorEmployer[] = [],
  jobFamilies: JobFamily[] = []
): EmployerQuestion[] {
  const questions: EmployerQuestion[] = []
  const { companyName, industry, location } = analysis
  const competitor = competitors[0]?.name || 'competitors'

  // Reputation questions
  questions.push({
    question: `What's it like to work at ${companyName}?`,
    category: 'reputation',
    suggestedBy: [],
    relevanceScore: 5,
  })

  questions.push({
    question: `Is ${companyName} a good place to work?`,
    category: 'reputation',
    suggestedBy: [],
    relevanceScore: 5,
  })

  questions.push({
    question: `${companyName} employee reviews`,
    category: 'reputation',
    suggestedBy: [],
    relevanceScore: 4,
  })

  // Culture
  questions.push({
    question: `What is the culture like at ${companyName}?`,
    category: 'culture',
    suggestedBy: [],
    relevanceScore: 4,
  })

  questions.push({
    question: `How is the work environment at ${companyName}?`,
    category: 'culture',
    suggestedBy: [],
    relevanceScore: 3,
  })

  // Compensation
  questions.push({
    question: `Does ${companyName} pay well?`,
    category: 'compensation',
    suggestedBy: [],
    relevanceScore: 4,
  })

  // Growth
  questions.push({
    question: `Are there good career opportunities at ${companyName}?`,
    category: 'growth',
    suggestedBy: [],
    relevanceScore: 4,
  })

  // Comparison
  questions.push({
    question: `Is ${companyName} or ${competitor} a better place to work?`,
    category: 'comparison',
    suggestedBy: [],
    relevanceScore: 4,
  })

  questions.push({
    question: `Compare working at ${companyName} vs ${competitor}`,
    category: 'comparison',
    suggestedBy: [],
    relevanceScore: 3,
  })

  // Industry
  if (industry && location) {
    questions.push({
      question: `Best ${industry} companies to work for in ${location}`,
      category: 'industry',
      suggestedBy: [],
      relevanceScore: 4,
    })
  }

  // Add role-specific questions if job families are provided
  const generalQuestions = questions.slice(0, 10)
  if (jobFamilies && jobFamilies.length > 0) {
    const roleQuestions = generateRoleFamilyQuestions(analysis, jobFamilies, competitors)
    return [...generalQuestions, ...roleQuestions]
  }

  return generalQuestions
}

/**
 * Generate role-specific questions for each active job family
 * These supplement the general employer questions
 */
export function generateRoleFamilyQuestions(
  analysis: EmployerAnalysis,
  jobFamilies: JobFamily[],
  competitors: CompetitorEmployer[] = []
): EmployerQuestion[] {
  const { companyName } = analysis
  const familyQuestions: EmployerQuestion[] = []

  const familyLabels: Record<JobFamily, string> = {
    engineering: 'engineering roles like software engineers and data scientists',
    business: 'business roles like sales and product management',
    operations: 'operations and supply chain roles',
    creative: 'creative roles like designers and content creators',
    corporate: 'corporate roles like finance and HR',
    general: 'general roles',
  }

  for (const family of jobFamilies) {
    if (family === 'general') continue // Skip general, that's covered by existing questions

    const roleLabel = familyLabels[family]
    const competitor = competitors[0]?.name

    // Core role-specific question (reputation/culture/compensation for this role family)
    familyQuestions.push({
      question: `How is ${companyName} for ${roleLabel}? What's the reputation, culture, and compensation like?`,
      category: 'role_insights', // Role-specific insights category
      suggestedBy: [],
      relevanceScore: 10,
      jobFamily: family,
    })
  }

  return familyQuestions
}

/**
 * Full employer research WITH role-specific questions
 * Returns general questions + role family questions
 */
export async function researchEmployerWithRoles(
  analysis: EmployerAnalysis,
  jobFamilies: JobFamily[],
  runId: string,
  onProgress?: (platform: Platform, step: 'researching' | 'complete') => void
): Promise<EmployerResearchResult> {
  // First, get general questions and competitors
  const baseResult = await researchEmployer(analysis, runId, onProgress)

  // If no job families, return base result
  if (!jobFamilies || jobFamilies.length === 0) {
    return baseResult
  }

  // Generate role-specific questions
  const roleFamilyQuestions = generateRoleFamilyQuestions(analysis, jobFamilies, baseResult.competitors)

  // Combine: 10 general + N family-specific
  return {
    competitors: baseResult.competitors,
    questions: [...baseResult.questions, ...roleFamilyQuestions],
  }
}
