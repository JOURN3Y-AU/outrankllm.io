/**
 * Query Research Module
 * Asks LLMs what search queries people actually use when looking for businesses like this
 * This creates more realistic visibility testing that reflects actual user behavior
 */

import { generateText, createGateway } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { trackCost } from './costs'

// Initialize Google with explicit API key (supports multiple env var names)
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})
import type { BusinessAnalysis } from './analyze'

// Check if gateway API key is available
const hasGatewayKey = !!(process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY)

// Initialize Vercel AI Gateway (only used if key is present)
const gateway = hasGatewayKey
  ? createGateway({
      apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
    })
  : null

export type Platform = 'chatgpt' | 'claude' | 'gemini'

export type QueryCategory =
  | 'finding_provider'
  | 'product_specific'
  | 'service'
  | 'comparison'
  | 'review'
  | 'how_to'
  | 'other'
  // Legacy categories (for backward compatibility with existing data)
  | 'general'
  | 'custom'

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

// Prompt for SERVICE businesses (plumbers, dentists, consultants, etc.)
const SERVICE_RESEARCH_PROMPT = `You're a customer who needs to HIRE from: {businessType}

Location: {location}
They offer these services: {services}
Key terms: {keyPhrases}

Generate 10 search queries that would lead to THIS SPECIFIC TYPE OF BUSINESS being RECOMMENDED.
CRITICAL: Every query MUST be relevant to "{businessType}" - do not generate queries for unrelated businesses.

IMPORTANT: Focus on queries where an AI would name specific companies/providers:
✅ "who can help me with X" → AI names providers
✅ "best X near me" → AI recommends businesses
✅ "X company reviews" → AI discusses specific businesses
✅ "hire X in [location]" → AI suggests local providers

AVOID queries that just get generic advice:
❌ "how to do X myself" → AI gives DIY instructions, no businesses
❌ "what is X" → AI explains concept, no recommendations

Think like a real person ready to spend money:
- Casual language ("need a plumber asap" not "plumbing services required")
- Include location when relevant for {location}
- Use the services and key terms provided above

Examples of GOOD queries for service businesses:
- "plumber near me"
- "best dentist sydney"
- "who installs solar panels"
- "accountant for small business melbourne"
- "seo consultant australia"

Categories:
- finding_provider: Looking for a business/provider
- service: Need a specific service done
- comparison: Comparing providers (with intent to hire)
- review: Reviews of businesses/providers

Return ONLY a JSON array:
[{"query": "example query", "category": "finding_provider"}, ...]`

// Prompt for RETAIL/E-COMMERCE businesses (stores, shops, online retailers)
const RETAIL_RESEARCH_PROMPT = `You're a customer who wants to BUY from: {businessType}

Location: {location}
They sell: {products}
Product categories: {keyPhrases}

Generate 10 search queries that would lead to THIS SPECIFIC TYPE OF STORE being RECOMMENDED.
CRITICAL: Every query MUST be about buying products this store sells. Use the product categories above.
DO NOT generate queries about services, tradespeople, or unrelated products.

IMPORTANT: Focus on queries where an AI would name specific stores/retailers:
✅ "where to buy X" → AI names retailers
✅ "best X store online" → AI recommends shops
✅ "X store reviews australia" → AI discusses specific retailers
✅ "buy X online australia" → AI suggests online stores
✅ "X vs Y store comparison" → AI compares retailers

AVOID queries that just get product advice:
❌ "how to choose X" → AI gives buying tips, no store names
❌ "what is the best X" → AI recommends products, not stores
❌ "X buying guide" → AI gives advice, doesn't name retailers

Think like a real person ready to buy:
- Focus on WHERE to buy, not WHAT to buy
- Include location when relevant for {location}
- Use the specific product categories provided above

Examples of GOOD queries for retail/e-commerce:
- "where to buy outdoor furniture australia"
- "best online furniture store sydney"
- "buy sofa online australia free delivery"
- "homewares store reviews australia"
- "temple and webster vs ikea"
- "online bedding store australia"

Categories:
- finding_provider: Looking for a store/retailer
- product_specific: Where to buy a specific product category
- comparison: Comparing stores/retailers
- review: Reviews of stores/retailers

Return ONLY a JSON array:
[{"query": "example query", "category": "finding_provider"}, ...]`

/**
 * Detect if business is a retailer/e-commerce vs service provider
 * SaaS and software businesses are treated as service providers, not retailers
 */
function isRetailerBusiness(businessType: string, _products: string[], keyPhrases: string[]): boolean {
  const businessTypeLower = businessType.toLowerCase()

  // SaaS/software businesses are NOT retailers - they use service-style queries
  const saasKeywords = [
    'saas', 'software', 'platform', 'app', 'tool', 'solution', 'crm', 'erp',
    'cloud', 'subscription', 'b2b', 'enterprise', 'startup', 'tech'
  ]
  if (saasKeywords.some(kw => businessTypeLower.includes(kw))) {
    return false
  }

  // Keywords that indicate physical goods retail
  const retailerKeywords = [
    'store', 'shop', 'retailer', 'e-commerce', 'ecommerce', 'online store',
    'marketplace', 'seller', 'merchant', 'outlet', 'warehouse', 'furniture',
    'homewares', 'clothing', 'apparel', 'electronics', 'goods', 'retail'
  ]

  // Check business type for retail keywords
  if (retailerKeywords.some(kw => businessTypeLower.includes(kw))) {
    return true
  }

  // Check key phrases for physical product terms (not just having products)
  const physicalProductPhrases = keyPhrases.filter(kp => {
    const lower = kp.toLowerCase()
    return retailerKeywords.some(kw => lower.includes(kw)) ||
           lower.includes('furniture') || lower.includes('decor') ||
           lower.includes('outdoor') || lower.includes('bedroom') ||
           lower.includes('living') || lower.includes('kitchen') ||
           lower.includes('clothing') || lower.includes('shoes') ||
           lower.includes('jewelry') || lower.includes('home')
  })

  // Need at least 2 physical product indicators to be classified as retailer
  return physicalProductPhrases.length >= 2
}

/**
 * Use key phrases as fallback when products/services are empty
 */
function enrichWithKeyPhrases(
  services: string[],
  products: string[],
  keyPhrases: string[],
  isRetailer: boolean
): { services: string[]; products: string[] } {
  // If products are empty and we have key phrases, use them as product categories
  if (products.length === 0 && keyPhrases.length > 0 && isRetailer) {
    products = keyPhrases.slice(0, 5)
  }

  // If services are empty and we have key phrases (for service businesses)
  if (services.length === 0 && keyPhrases.length > 0 && !isRetailer) {
    services = keyPhrases.slice(0, 5)
  }

  return { services, products }
}

/**
 * Ask a single LLM for search query suggestions
 * All platforms use gateway for standard generation
 */
async function researchQueriesOnPlatform(
  analysis: BusinessAnalysis,
  platform: Platform,
  runId: string,
  keyPhrases: string[]
): Promise<RawQuerySuggestion[]> {
  // Detect if this is a retailer
  const isRetailer = isRetailerBusiness(analysis.businessType, analysis.products, keyPhrases)

  // Enrich products/services with key phrases if empty
  const enriched = enrichWithKeyPhrases(
    analysis.services,
    analysis.products,
    keyPhrases,
    isRetailer
  )

  // Select appropriate prompt template based on business type
  const promptTemplate = isRetailer ? RETAIL_RESEARCH_PROMPT : SERVICE_RESEARCH_PROMPT

  const prompt = promptTemplate
    .replace(/{businessType}/g, analysis.businessType)
    .replace(/{industry}/g, analysis.industry)
    .replace(/{services}/g, enriched.services.slice(0, 5).join(', ') || 'Not specified')
    .replace(/{products}/g, enriched.products.slice(0, 5).join(', ') || 'Not specified')
    .replace(/{location}/g, analysis.location || 'Not specified')
    .replace(/{keyPhrases}/g, keyPhrases.slice(0, 8).join(', ') || 'Not specified')

  try {
    // Use gateway if available, otherwise use direct SDK
    const modelMap: Record<Platform, string> = {
      chatgpt: 'openai/gpt-4o',
      claude: 'anthropic/claude-sonnet-4-20250514',
      gemini: 'google/gemini-2.0-flash',
    }

    // Get model - use gateway if available, otherwise direct SDK
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
    'other',
    'general',
    'custom',
  ]

  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '')
  return validCategories.includes(normalized as QueryCategory)
    ? (normalized as QueryCategory)
    : 'other'
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
  onProgress?: (platform: Platform) => void,
  keyPhrases: string[] = []
): Promise<RawQuerySuggestion[]> {
  const platforms: Platform[] = ['chatgpt', 'claude', 'gemini']
  const allSuggestions: RawQuerySuggestion[] = []

  // Use keyPhrases from analysis if not provided separately
  const phrases = keyPhrases.length > 0 ? keyPhrases : (analysis.keyPhrases || [])

  // Query each platform sequentially to avoid rate limits
  for (const platform of platforms) {
    onProgress?.(platform)
    const suggestions = await researchQueriesOnPlatform(analysis, platform, runId, phrases)
    allSuggestions.push(...suggestions)

    // Small delay between platforms
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return allSuggestions
}

/**
 * Deduplicate and rank queries
 * Queries suggested by multiple platforms rank higher
 * Queries containing key phrases get bonus points
 */
export function dedupeAndRankQueries(
  suggestions: RawQuerySuggestion[],
  limit: number = 7,
  keyPhrases: string[] = []
): ResearchedQuery[] {
  // Group similar queries
  const groups = groupSimilarQueries(suggestions)

  // Convert groups to ResearchedQuery objects
  const rankedQueries: ResearchedQuery[] = []

  for (const [_representative, group] of groups) {
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

    // Calculate base score from platform count
    let relevanceScore = platforms.length * 10 // 10 points per platform

    // Boost score if query contains key phrases
    const queryLower = bestQuery.query.toLowerCase()
    for (const phrase of keyPhrases) {
      if (queryLower.includes(phrase.toLowerCase())) {
        relevanceScore += 5 // 5 bonus points per key phrase match
      }
    }

    rankedQueries.push({
      query: bestQuery.query,
      category: mostCommonCategory,
      suggestedBy: platforms,
      relevanceScore,
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
