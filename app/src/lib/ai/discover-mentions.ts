/**
 * HiringBrand Web Mention Discovery
 * Searches the web for mentions of an employer using Tavily,
 * classifies each by source type, sentiment, and relevance.
 */

import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createServiceClient } from '@/lib/supabase/server'
import { trackCost, trackTavilyCost } from './costs'
import { z } from 'zod'
import crypto from 'crypto'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// --- Types ---

export interface RawWebMention {
  url: string
  title: string | null
  snippet: string | null
  publishedDate: string | null
  searchQuery: string
  domainName: string | null
  urlHash: string
}

export type MentionSourceType =
  | 'press'
  | 'review_site'
  | 'blog'
  | 'news'
  | 'social'
  | 'jobs_board'
  | 'careers_page'
  | 'other'

export type MentionSentiment = 'positive' | 'negative' | 'neutral' | 'mixed'

export interface ClassifiedMention extends RawWebMention {
  sourceType: MentionSourceType
  sentiment: MentionSentiment
  sentimentScore: number | null
  relevanceScore: number | null
}

export interface MentionInsight {
  type: 'positive' | 'negative' | 'opportunity'
  text: string
}

export interface MentionStats {
  total: number
  bySentiment: Record<MentionSentiment, number>
  bySourceType: Record<MentionSourceType, number>
  topDomains: Array<{ domain: string; count: number; avgSentiment: number }>
  avgSentimentScore: number
  avgRelevanceScore: number
  insights?: MentionInsight[]
}

// --- URL Normalization & Hashing ---

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Strip protocol
    let normalized = parsed.hostname + parsed.pathname
    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '')
    // Remove common tracking params
    // (UTM params, fbclid, gclid, etc. are already stripped by removing search params)
    return normalized.toLowerCase()
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  }
}

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex')
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// --- Source Type Classification (rule-based) ---

const REVIEW_SITE_DOMAINS = [
  'glassdoor.com', 'glassdoor.com.au', 'glassdoor.co.uk',
  'indeed.com', 'indeed.com.au', 'indeed.co.uk',
  'comparably.com',
  'teamblind.com', 'blind.com',
  'kununu.com',
  'fairygodboss.com',
  'inhersight.com',
  'levels.fyi',
]

const SOCIAL_DOMAINS = [
  'linkedin.com',
  'reddit.com',
  'twitter.com', 'x.com',
  'facebook.com',
  'quora.com',
  'threads.net',
]

const PRESS_DOMAINS = [
  'reuters.com', 'bloomberg.com', 'techcrunch.com', 'forbes.com',
  'wsj.com', 'nytimes.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk',
  'cnbc.com', 'businessinsider.com', 'insider.com', 'fortune.com',
  'wired.com', 'theverge.com', 'arstechnica.com', 'venturebeat.com',
  'afr.com', 'smh.com.au', 'theaustralian.com.au',
]

const JOBS_BOARD_DOMAINS = [
  'seek.com.au', 'seek.com',
  'monster.com',
  'ziprecruiter.com',
  'dice.com',
  'angel.co', 'wellfound.com',
  'hired.com',
  'simplyhired.com',
  'careerbuilder.com',
  'jora.com',
]

const BLOG_DOMAINS = [
  'medium.com',
  'substack.com',
  'dev.to',
  'hashnode.dev',
  'wordpress.com',
  'blogger.com',
  'hubspot.com',
]

function classifySourceType(url: string, companyDomain: string): MentionSourceType {
  const domain = extractDomain(url)
  if (!domain) return 'other'

  const domainLower = domain.toLowerCase()
  const companyDomainLower = companyDomain.toLowerCase().replace(/^www\./, '')

  // Company's own site
  if (domainLower === companyDomainLower || domainLower.endsWith('.' + companyDomainLower)) {
    return 'careers_page'
  }

  // Review sites
  if (REVIEW_SITE_DOMAINS.some(d => domainLower === d || domainLower.endsWith('.' + d))) {
    return 'review_site'
  }

  // Social platforms
  if (SOCIAL_DOMAINS.some(d => domainLower === d || domainLower.endsWith('.' + d))) {
    return 'social'
  }

  // Press / major publications
  if (PRESS_DOMAINS.some(d => domainLower === d || domainLower.endsWith('.' + d))) {
    return 'press'
  }

  // Jobs boards
  if (JOBS_BOARD_DOMAINS.some(d => domainLower === d || domainLower.endsWith('.' + d))) {
    return 'jobs_board'
  }

  // Blog platforms or paths with /blog/
  if (BLOG_DOMAINS.some(d => domainLower === d || domainLower.endsWith('.' + d))) {
    return 'blog'
  }
  try {
    const parsed = new URL(url)
    if (parsed.pathname.includes('/blog/') || parsed.pathname.includes('/blog')) {
      return 'blog'
    }
  } catch {
    // ignore
  }

  // News heuristic (domain contains "news" or path contains "/news/")
  if (domainLower.includes('news')) {
    return 'news'
  }
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/news/') || parsed.pathname.startsWith('/news')) {
      return 'news'
    }
  } catch {
    // ignore
  }

  return 'other'
}

// --- Country Code Extraction ---

/**
 * Extract ISO 2-letter country code from a freeform location string.
 * Used to pass Tavily's `country` param for geographic boosting.
 */
function extractCountryCode(location: string | null): string | undefined {
  if (!location) return undefined
  const loc = location.toLowerCase()
  const countryMap: Record<string, string> = {
    'australia': 'au',
    'united states': 'us', 'usa': 'us', 'u.s.': 'us',
    'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb', 'scotland': 'gb', 'wales': 'gb',
    'canada': 'ca',
    'new zealand': 'nz',
    'ireland': 'ie',
    'germany': 'de',
    'france': 'fr',
    'singapore': 'sg',
    'india': 'in',
    'japan': 'jp',
    'netherlands': 'nl', 'holland': 'nl',
    'spain': 'es',
    'italy': 'it',
    'brazil': 'br',
    'mexico': 'mx',
    'south korea': 'kr', 'korea': 'kr',
    'sweden': 'se',
    'norway': 'no',
    'denmark': 'dk',
    'finland': 'fi',
    'switzerland': 'ch',
    'austria': 'at',
    'belgium': 'be',
    'portugal': 'pt',
    'poland': 'pl',
    'israel': 'il',
    'south africa': 'za',
    'philippines': 'ph',
    'indonesia': 'id',
    'malaysia': 'my',
    'thailand': 'th',
    'vietnam': 'vn',
    'hong kong': 'hk',
    'taiwan': 'tw',
    'china': 'cn',
    'uae': 'ae', 'united arab emirates': 'ae', 'dubai': 'ae',
    'saudi arabia': 'sa',
    'argentina': 'ar',
    'chile': 'cl',
    'colombia': 'co',
    'czech republic': 'cz', 'czechia': 'cz',
    'romania': 'ro',
    'hungary': 'hu',
    'ukraine': 'ua',
    'nigeria': 'ng',
    'kenya': 'ke',
    'egypt': 'eg',
    'pakistan': 'pk',
    'bangladesh': 'bd',
  }
  for (const [name, code] of Object.entries(countryMap)) {
    if (loc.includes(name)) return code
  }
  return undefined
}

// --- Tavily Search ---

async function searchTavily(
  query: string,
  maxResults: number = 8,
  country?: string
): Promise<Array<{ url: string; title: string; content: string; published_date?: string }>> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.error('TAVILY_API_KEY not configured')
    return []
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: maxResults,
        ...(country ? { country } : {}),
      }),
    })

    if (!response.ok) {
      console.error(`Tavily API error: ${response.status}`)
      return []
    }

    const data = await response.json() as {
      results?: Array<{
        url?: string
        title?: string
        content?: string
        published_date?: string
      }>
    }

    return (data.results || [])
      .filter(r => r.url)
      .map(r => ({
        url: r.url!,
        title: r.title || '',
        content: r.content || '',
        published_date: r.published_date,
      }))
  } catch (error) {
    console.error('Tavily search error:', error)
    return []
  }
}

// --- Main Discovery Function ---

function buildSearchQueries(
  companyName: string,
  domain: string,
  industry: string | null
): string[] {
  // NOTE: Location is NOT appended to queries — it makes results too narrow for
  // smaller brands. Instead we use Tavily's `country` param for geographic boosting
  // and AI classification to score wrong-location mentions lower.
  return [
    `"${companyName}" employer reviews`,
    `"working at ${companyName}" experience`,
    `"${companyName}" company culture employees`,
    `"${companyName}" glassdoor indeed reviews`,
    `"${companyName}" employer hiring news 2025 2026`,
    `"${companyName}" layoffs OR restructuring OR workplace`,
    `"${companyName}" best employer award OR workplace recognition`,
    `"${companyName}" careers jobs salary benefits`,
    `site:${domain} careers OR "join us" OR "we're hiring"`,
    `"${companyName}" employer reddit OR linkedin`,
  ]
}

export async function discoverWebMentions(params: {
  companyName: string
  domain: string
  industry: string | null
  location: string | null
  runId: string
}): Promise<{ mentions: RawWebMention[]; searchCount: number }> {
  const { companyName, domain, runId } = params
  const queries = buildSearchQueries(companyName, domain, params.industry)

  // NOTE: We deliberately do NOT pass country to Tavily. Tavily's country param
  // acts as a hard filter (not a boost) and drops all non-country results, which
  // kills results for smaller brands. Geographic filtering is handled entirely by
  // AI classification (scores wrong-location mentions lower) + relevance threshold.

  const seenHashes = new Set<string>()
  const mentions: RawWebMention[] = []
  let searchCount = 0

  // Run searches in batches of 3 to avoid overwhelming Tavily
  const BATCH_SIZE = 3
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(query => searchTavily(query))
    )
    searchCount += batch.length

    for (let j = 0; j < batchResults.length; j++) {
      const results = batchResults[j]
      const query = batch[j]

      for (const result of results) {
        const urlHash = hashUrl(result.url)
        if (seenHashes.has(urlHash)) continue
        seenHashes.add(urlHash)

        mentions.push({
          url: result.url,
          title: result.title || null,
          snippet: result.content?.slice(0, 500) || null,
          publishedDate: result.published_date || null,
          searchQuery: query,
          domainName: extractDomain(result.url),
          urlHash,
        })
      }
    }
  }

  // Track Tavily costs
  await trackTavilyCost(runId, 'discover_web_mentions', searchCount)

  return { mentions, searchCount }
}

// --- Sentiment & Relevance Classification ---

const mentionClassificationSchema = z.object({
  classifications: z.array(z.object({
    index: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    sentimentScore: z.number().min(1).max(10),
    relevanceScore: z.number().min(1).max(10).describe('How relevant to employer brand (vs product mentions, unrelated content)'),
    keyQuote: z.string().describe('Extract 1-2 complete sentences (15-30 words) from the snippet that best justify the sentiment score. Pull verbatim from the source — do not paraphrase or truncate mid-sentence. If the snippet is mostly boilerplate/navigation, write a brief factual summary instead (e.g. "Job listing for Senior Engineer role" or "Glassdoor review rating 3.5/5").'),
  })),
})

export async function classifyMentions(
  mentions: RawWebMention[],
  companyName: string,
  companyDomain: string,
  runId: string,
  location: string | null = null
): Promise<ClassifiedMention[]> {
  if (mentions.length === 0) return []

  // First, classify source types (rule-based, free)
  const withSourceTypes = mentions.map(m => ({
    ...m,
    sourceType: classifySourceType(m.url, companyDomain),
  }))

  // Batch classify sentiment + relevance with GPT-4o-mini
  const mentionSummaries = withSourceTypes
    .map((m, i) => `[${i}] Title: "${m.title || 'N/A'}" | Source: ${m.domainName || 'unknown'} | Snippet: "${(m.snippet || '').slice(0, 600)}"`)
    .join('\n')

  const locationContext = location
    ? `\nIMPORTANT: ${companyName} is based in ${location}. Only score mentions as relevant if they are about ${companyName} in or near ${location}. If a mention is clearly about a different "${companyName}" in a different country or region, give it a LOW relevance score (1-3).`
    : ''

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: mentionClassificationSchema,
      system: `You are classifying web mentions of "${companyName}" as an employer.${locationContext} For each mention:
- sentiment: Is this positive, negative, neutral, or mixed about ${companyName} as an employer?
- sentimentScore: 1-10 (1=very negative about employer, 10=very positive about employer)
- relevanceScore: 1-10 (1=not about employer brand at all OR about a different company/location with the same name, 10=directly about working at ${companyName}${location ? ` in ${location}` : ''})
- keyQuote: Extract the single most important sentence or phrase from the snippet that shows WHY this mention got this sentiment score. Pull the exact words from the source — do not invent or paraphrase. Skip navigation text, page chrome, and metadata. If the snippet is mostly navigation/boilerplate, write a brief factual summary instead (e.g. "Job listing for Senior Engineer role" or "Glassdoor review rating 3.5/5").

Be accurate. Job listings are neutral (5-6 sentiment). Reviews can be positive or negative. News about layoffs is negative. Awards are positive.`,
      prompt: `Classify these ${withSourceTypes.length} web mentions of ${companyName}:\n\n${mentionSummaries}`,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'mention_classification',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Merge classifications with mentions
    const classificationMap = new Map<number, {
      sentiment: MentionSentiment
      sentimentScore: number
      relevanceScore: number
      keyQuote: string
    }>()
    for (const c of result.object.classifications) {
      classificationMap.set(c.index, {
        sentiment: c.sentiment,
        sentimentScore: c.sentimentScore,
        relevanceScore: c.relevanceScore,
        keyQuote: c.keyQuote,
      })
    }

    return withSourceTypes.map((m, i) => {
      const classification = classificationMap.get(i)
      return {
        ...m,
        // Replace raw Tavily snippet with AI-extracted key quote
        snippet: classification?.keyQuote || m.snippet,
        sentiment: classification?.sentiment || 'neutral',
        sentimentScore: classification?.sentimentScore || null,
        relevanceScore: classification?.relevanceScore || null,
      }
    })
  } catch (error) {
    console.error('Mention classification failed:', error)
    // Return with defaults
    return withSourceTypes.map(m => ({
      ...m,
      sentiment: 'neutral' as MentionSentiment,
      sentimentScore: null,
      relevanceScore: null,
    }))
  }
}

// --- Aggregate Stats ---

export function computeMentionStats(mentions: ClassifiedMention[]): MentionStats {
  const bySentiment: Record<MentionSentiment, number> = {
    positive: 0, negative: 0, neutral: 0, mixed: 0,
  }
  const bySourceType: Record<MentionSourceType, number> = {
    press: 0, review_site: 0, blog: 0, news: 0,
    social: 0, jobs_board: 0, careers_page: 0, other: 0,
  }

  const domainCounts = new Map<string, { count: number; sentimentSum: number }>()
  let sentimentScoreSum = 0
  let sentimentScoreCount = 0
  let relevanceScoreSum = 0
  let relevanceScoreCount = 0

  for (const m of mentions) {
    bySentiment[m.sentiment]++
    bySourceType[m.sourceType]++

    if (m.domainName) {
      const existing = domainCounts.get(m.domainName) || { count: 0, sentimentSum: 0 }
      existing.count++
      if (m.sentimentScore) existing.sentimentSum += m.sentimentScore
      domainCounts.set(m.domainName, existing)
    }

    if (m.sentimentScore) {
      sentimentScoreSum += m.sentimentScore
      sentimentScoreCount++
    }
    if (m.relevanceScore) {
      relevanceScoreSum += m.relevanceScore
      relevanceScoreCount++
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, data]) => ({
      domain,
      count: data.count,
      avgSentiment: data.count > 0 ? Math.round((data.sentimentSum / data.count) * 10) / 10 : 5,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total: mentions.length,
    bySentiment,
    bySourceType,
    topDomains,
    avgSentimentScore: sentimentScoreCount > 0
      ? Math.round((sentimentScoreSum / sentimentScoreCount) * 10) / 10
      : 5,
    avgRelevanceScore: relevanceScoreCount > 0
      ? Math.round((relevanceScoreSum / relevanceScoreCount) * 10) / 10
      : 5,
  }
}

// --- Coverage Briefing (AI-generated insights) ---

const coverageBriefingSchema = z.object({
  insights: z.array(z.object({
    type: z.enum(['positive', 'negative', 'opportunity']),
    text: z.string().describe('One sentence insight about employer brand coverage. Write for a VP of People. Be specific — name sources and topics.'),
  })).length(3),
})

export async function generateCoverageBriefing(
  mentions: ClassifiedMention[],
  companyName: string,
  runId: string
): Promise<MentionInsight[]> {
  if (mentions.length === 0) return []

  // Build a concise summary of the mentions for the LLM
  const positiveMentions = mentions.filter(m => m.sentiment === 'positive')
  const negativeMentions = mentions.filter(m => m.sentiment === 'negative' || m.sentiment === 'mixed')
  const uniqueDomains = new Set(mentions.map(m => m.domainName).filter(Boolean))

  const mentionSummary = `
Company: ${companyName}
Total mentions found: ${mentions.length} across ${uniqueDomains.size} unique sources

Positive mentions (${positiveMentions.length}):
${positiveMentions.slice(0, 15).map(m => `- "${m.title}" (${m.domainName}, ${m.sourceType}, sentiment: ${m.sentimentScore}/10)`).join('\n')}

Negative/Mixed mentions (${negativeMentions.length}):
${negativeMentions.slice(0, 15).map(m => `- "${m.title}" (${m.domainName}, ${m.sourceType}, sentiment: ${m.sentimentScore}/10)`).join('\n')}

Source breakdown: ${Array.from(new Set(mentions.map(m => m.sourceType))).map(t => `${t}: ${mentions.filter(m => m.sourceType === t).length}`).join(', ')}
`.trim()

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: coverageBriefingSchema,
      system: `You generate a 3-point "coverage briefing" for employer brand reports. Each insight should be:
1. One type=positive insight about the strongest positive signal (name specific sources)
2. One type=negative insight about the main concern or negative signal (name specific sources)
3. One type=opportunity insight about a gap or opportunity (be actionable)

Write for a VP of People or Head of Talent Acquisition. Be specific and concise — one sentence each. Don't be generic.`,
      prompt: `Generate 3 coverage briefing insights for ${companyName}:\n\n${mentionSummary}`,
    })

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'coverage_briefing',
        model: 'openai/gpt-4o-mini',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    return result.object.insights
  } catch (error) {
    console.error('Coverage briefing generation failed:', error)
    return []
  }
}

// --- Database Persistence ---

export async function persistMentions(
  mentions: ClassifiedMention[],
  runId: string,
  reportId: string,
  stats: MentionStats
): Promise<void> {
  const supabase = createServiceClient()

  // Insert mentions (upsert to handle URL dedup)
  if (mentions.length > 0) {
    const rows = mentions.map(m => ({
      run_id: runId,
      report_id: reportId,
      url: m.url,
      title: m.title,
      snippet: m.snippet,
      published_date: m.publishedDate,
      source_type: m.sourceType,
      sentiment: m.sentiment,
      sentiment_score: m.sentimentScore,
      relevance_score: m.relevanceScore,
      search_query: m.searchQuery,
      domain_name: m.domainName,
      url_hash: m.urlHash,
    }))

    // Insert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('hb_web_mentions')
        .upsert(batch, { onConflict: 'run_id,url_hash', ignoreDuplicates: true })

      if (error) {
        console.error(`Failed to insert mentions batch ${i}:`, error.message)
      }
    }
  }

  // Update report with aggregate stats
  await supabase
    .from('reports')
    .update({ mention_stats: stats })
    .eq('id', reportId)
}
