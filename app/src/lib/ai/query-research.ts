/**
 * Query Research Module
 * Asks LLMs what search queries people actually use when looking for businesses like this
 * This creates more realistic visibility testing that reflects actual user behavior
 */

import { generateText, createGateway } from 'ai'
import { trackCost } from './costs'
import type { BusinessAnalysis } from './analyze'

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

export type Platform = 'chatgpt' | 'claude' | 'gemini'

export type QueryCategory =
  | 'finding_provider'
  | 'product_specific'
  | 'service'
  | 'comparison'
  | 'review'
  // Legacy categories (for backward compatibility with existing data)
  | 'how_to'
  | 'general'

export interface ResearchedQuery {
  query: string
  category: QueryCategory
  suggestedBy: Platform[]
  relevanceScore: number // Higher = suggested by more platforms
}

export interface RawQuerySuggestion {
  query: string
  category: QueryCategory
  platform: Platform
}

const RESEARCH_PROMPT = `You're a customer who needs to HIRE or BUY from: {businessType}

Location: {location}
They offer: {services}
They sell: {products}

Generate 10 search queries that would lead to a business being RECOMMENDED or MENTIONED in the response.

IMPORTANT: Focus on queries where an AI would name specific companies/providers:
✅ "who can help me with X" → AI names providers
✅ "best X near me" → AI recommends businesses
✅ "X company reviews" → AI discusses specific businesses
✅ "hire X in [location]" → AI suggests local providers
✅ "where to buy X" → AI names retailers/sellers

AVOID queries that just get generic advice:
❌ "how to do X myself" → AI gives DIY instructions, no businesses
❌ "what is X" → AI explains concept, no recommendations
❌ "X tips" → AI gives advice, doesn't name providers

Think like a real person ready to spend money:
- Casual language ("need a plumber asap" not "plumbing services required")
- Include location when relevant for {location}
- Include specific product/brand names they sell

Examples of GOOD queries (would get business recommendations):
- "plumber near me"
- "best dentist sydney"
- "who installs solar panels"
- "pool shop that sells dolphin robots"
- "accountant for small business melbourne"

Examples of BAD queries (would just get advice, not recommendations):
- "how to fix a leaky tap"
- "what does an accountant do"
- "solar panel benefits"

Categories:
- finding_provider: Looking for a business/provider
- product_specific: Where to buy a specific product
- service: Need a specific service done
- comparison: Comparing providers/products (with intent to buy)
- review: Reviews of businesses/providers

Return ONLY a JSON array:
[{"query": "example query", "category": "finding_provider"}, ...]`

/**
 * Ask a single LLM for search query suggestions
 * All platforms use gateway for standard generation
 */
async function researchQueriesOnPlatform(
  analysis: BusinessAnalysis,
  platform: Platform,
  runId: string
): Promise<RawQuerySuggestion[]> {
  const prompt = RESEARCH_PROMPT
    .replace(/{businessType}/g, analysis.businessType)
    .replace(/{industry}/g, analysis.industry)
    .replace(/{services}/g, analysis.services.slice(0, 5).join(', ') || 'Not specified')
    .replace(/{products}/g, analysis.products.slice(0, 5).join(', ') || 'Not specified')
    .replace(/{location}/g, analysis.location || 'Not specified')

  try {
    // All platforms use gateway for query research
    const modelMap: Record<Platform, string> = {
      chatgpt: 'openai/gpt-4o',
      claude: 'anthropic/claude-sonnet-4-20250514',
      gemini: 'google/gemini-2.0-flash',
    }
    const result = await generateText({
      model: gateway(modelMap[platform]),
      prompt,
      maxOutputTokens: 800,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: `research_${platform}`,
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
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error(`No JSON array found in ${platform} research response`)
      return []
    }

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{ query: string; category: string }>

    return suggestions.map(s => ({
      query: s.query.toLowerCase().trim(),
      category: validateCategory(s.category),
      platform,
    }))
  } catch (error) {
    console.error(`Query research failed for ${platform}:`, error)
    return []
  }
}

/**
 * Validate and normalize category
 */
function validateCategory(category: string): QueryCategory {
  const validCategories: QueryCategory[] = [
    'finding_provider',
    'product_specific',
    'service',
    'comparison',
    'review',
    'how_to',
    'general',
  ]

  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '')
  return validCategories.includes(normalized as QueryCategory)
    ? (normalized as QueryCategory)
    : 'general'
}

/**
 * Calculate similarity between two queries using simple word overlap
 * Returns a score between 0 and 1
 */
function querySimilarity(query1: string, query2: string): number {
  const words1 = new Set(query1.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  const words2 = new Set(query2.toLowerCase().split(/\s+/).filter(w => w.length > 2))

  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = [...words1].filter(w => words2.has(w)).length
  const union = new Set([...words1, ...words2]).size

  return intersection / union
}

/**
 * Group similar queries together
 */
function groupSimilarQueries(suggestions: RawQuerySuggestion[]): Map<string, RawQuerySuggestion[]> {
  const groups = new Map<string, RawQuerySuggestion[]>()
  const SIMILARITY_THRESHOLD = 0.5

  for (const suggestion of suggestions) {
    let foundGroup = false

    // Check if this query is similar to any existing group
    for (const [representative, group] of groups) {
      if (querySimilarity(suggestion.query, representative) >= SIMILARITY_THRESHOLD) {
        group.push(suggestion)
        foundGroup = true
        break
      }
    }

    // If no similar group found, create a new one
    if (!foundGroup) {
      groups.set(suggestion.query, [suggestion])
    }
  }

  return groups
}

/**
 * Research queries across all platforms and deduplicate
 */
export async function researchQueries(
  analysis: BusinessAnalysis,
  runId: string,
  onProgress?: (platform: Platform) => void
): Promise<RawQuerySuggestion[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini']
  const allSuggestions: RawQuerySuggestion[] = []

  // Query each platform sequentially to avoid rate limits
  for (const platform of platforms) {
    onProgress?.(platform)
    const suggestions = await researchQueriesOnPlatform(analysis, platform, runId)
    allSuggestions.push(...suggestions)

    // Small delay between platforms
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return allSuggestions
}

/**
 * Deduplicate and rank queries
 * Queries suggested by multiple platforms rank higher
 */
export function dedupeAndRankQueries(
  suggestions: RawQuerySuggestion[],
  limit: number = 7
): ResearchedQuery[] {
  // Group similar queries
  const groups = groupSimilarQueries(suggestions)

  // Convert groups to ResearchedQuery objects
  const rankedQueries: ResearchedQuery[] = []

  for (const [representative, group] of groups) {
    // Find the best query in the group (shortest that's still descriptive)
    const bestQuery = group.reduce((best, current) => {
      // Prefer queries between 20-60 chars
      const bestLen = best.query.length
      const currentLen = current.query.length
      const bestScore = bestLen >= 20 && bestLen <= 60 ? 1 : 0
      const currentScore = currentLen >= 20 && currentLen <= 60 ? 1 : 0
      return currentScore > bestScore ? current : best
    })

    // Get unique platforms that suggested similar queries
    const platforms = [...new Set(group.map(s => s.platform))]

    // Determine most common category in the group
    const categoryCount = new Map<QueryCategory, number>()
    for (const s of group) {
      categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1)
    }
    const mostCommonCategory = [...categoryCount.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]

    rankedQueries.push({
      query: bestQuery.query,
      category: mostCommonCategory,
      suggestedBy: platforms,
      relevanceScore: platforms.length * 10, // 10 points per platform
    })
  }

  // Sort by relevance score (higher = more platforms suggested it)
  rankedQueries.sort((a, b) => b.relevanceScore - a.relevanceScore)

  // Take top N, ensuring diversity in categories
  const selected: ResearchedQuery[] = []
  const categoryCounts = new Map<QueryCategory, number>()
  const maxPerCategory = Math.ceil(limit / 3) // No more than ~33% from one category

  for (const query of rankedQueries) {
    if (selected.length >= limit) break

    const categoryCount = categoryCounts.get(query.category) || 0
    if (categoryCount < maxPerCategory) {
      selected.push(query)
      categoryCounts.set(query.category, categoryCount + 1)
    }
  }

  // If we still need more queries, add remaining regardless of category
  if (selected.length < limit) {
    for (const query of rankedQueries) {
      if (selected.length >= limit) break
      if (!selected.includes(query)) {
        selected.push(query)
      }
    }
  }

  return selected
}

/**
 * Generate fallback queries if research fails
 */
export function generateFallbackQueries(
  analysis: BusinessAnalysis
): ResearchedQuery[] {
  const queries: ResearchedQuery[] = []
  const location = analysis.location || 'my area'

  // Finding provider queries
  queries.push({
    query: `best ${analysis.businessType} near me`,
    category: 'finding_provider',
    suggestedBy: [],
    relevanceScore: 5,
  })

  queries.push({
    query: `${analysis.businessType} in ${location}`,
    category: 'finding_provider',
    suggestedBy: [],
    relevanceScore: 5,
  })

  // Service queries
  for (const service of analysis.services.slice(0, 2)) {
    queries.push({
      query: `who offers ${service} in ${location}`,
      category: 'service',
      suggestedBy: [],
      relevanceScore: 3,
    })
  }

  // Product queries
  for (const product of analysis.products.slice(0, 2)) {
    queries.push({
      query: `where to buy ${product}`,
      category: 'product_specific',
      suggestedBy: [],
      relevanceScore: 3,
    })
  }

  // Review query
  queries.push({
    query: `best rated ${analysis.businessType} ${location}`,
    category: 'review',
    suggestedBy: [],
    relevanceScore: 4,
  })

  return queries.slice(0, 7)
}
