/**
 * AI-Powered Action Plan Generation
 *
 * Generates comprehensive, PRD-ready action plans using Claude with:
 * - High reasoning effort for deep analysis
 * - Web search for current best practices
 * - Full page-level site data for specific recommendations
 *
 * Output: Prioritized actions with implementation steps, page edits, keyword maps
 */

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { trackCost, trackTavilyCost } from './costs'
import { log } from '@/lib/logger'
import {
  CLAUDE_MODEL,
  CLAUDE_GATEWAY_MODEL,
  CLAUDE_DEEP_REASONING_OPTIONS,
  repairMalformedJson,
} from './anthropic-model'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================
// INPUT TYPES - All data available for analysis
// ============================================

export interface CrawledPage {
  path: string
  url: string
  title: string | null
  metaDescription: string | null
  h1: string | null
  headings: string[]
  wordCount: number
  hasMetaDescription: boolean
  schemaTypes: string[]
  schemaData: Array<{
    type: string
    name?: string
    description?: string
    areaServed?: string | string[]
    serviceArea?: string | string[]
  }>
}

export interface LLMResponseData {
  platform: string
  promptText: string
  responseText: string
  domainMentioned: boolean
  competitorsMentioned: string[]
}

export interface BrandAwarenessData {
  platform: string
  queryType: string
  entityRecognized: boolean
  attributeMentioned: boolean
  testedAttribute: string | null
  positioning?: string
  comparedTo?: string
}

export interface CompetitiveSummaryData {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  overallPosition: string
}

export interface PlatformDataInput {
  // CMS / Website Builder detection
  cms: string | null
  cmsConfidence: 'high' | 'medium' | 'low' | null
  framework: string | null
  cssFramework: string | null
  ecommerce: string | null
  hosting: string | null

  // Analytics & Lead Capture
  analytics: string[]
  leadCapture: string[]

  // Content sections detected
  contentSections: {
    hasBlog: boolean
    hasCaseStudies: boolean
    hasResources: boolean
    hasFaq: boolean
    hasAboutPage: boolean
    hasTeamPage: boolean
    hasTestimonials: boolean
  }

  // E-commerce
  isEcommerce: boolean

  // AI Readability issues
  hasAiReadabilityIssues: boolean
  aiReadabilityIssues: string[]
  rendersClientSide: boolean

  // AI-generated content signals
  likelyAiGenerated: boolean
  aiSignals: string[]
}

export interface ActionPlanInput {
  // Core business data
  analysis: {
    businessName: string | null
    businessType: string
    services: string[]
    location: string | null
    locations: string[]
    keyPhrases: string[]
    industry: string
  }

  // Page-level crawl data (enables specific actions)
  crawledPages: CrawledPage[]

  // Technical readiness
  crawlData: {
    hasSitemap: boolean
    hasRobotsTxt: boolean
    schemaTypes: string[]
    hasMetaDescriptions: boolean
    pagesCrawled: number
  }

  // LLM response data
  responses: LLMResponseData[]

  // Brand awareness results (subscriber enrichment)
  brandAwareness: BrandAwarenessData[]

  // Competitive summary (subscriber enrichment)
  competitiveSummary: CompetitiveSummaryData | null

  // Visibility scores
  scores: {
    overall: number
    byPlatform: Record<string, { score: number; mentioned: number; total: number }>
  }

  domain: string

  // Platform/technology detection data
  platformData: PlatformDataInput | null

  // Previously completed action titles (to avoid regenerating)
  completedActionTitles?: string[]

  // Earlier scans of this same domain, oldest first, excluding the current one
  history?: ScanHistoryPoint[]

  // ISO date (YYYY-MM-DD) of the scan being reported on. Without it the model
  // has to guess where "this scan" sits on the timeline, and it guesses wrong.
  currentScanDate?: string
}

/**
 * One earlier scan of the same domain, used to ground the plan in what the
 * customer has already changed and what it did to the score.
 *
 * Without this the plan restarts from zero every week. It re-suggests work
 * that already shipped, and it reads a five-point drop as a regression when
 * five points is roughly one AI answer changing its mind.
 */
export interface ScanHistoryPoint {
  scanDate: string
  visibilityScore: number
  mentionsByPlatform: Record<string, number>
  hasSitemap: boolean
  hasRobotsTxt: boolean
  hasMetaDescriptions: boolean
  schemaTypes: string[]
  pagesCrawled: number
}

// ============================================
// OUTPUT TYPES - Structured action plan
// ============================================

export interface PriorityAction {
  rank: number
  title: string
  description: string
  rationale: string
  sourceInsight: string // e.g. "Based on your AI Responses data..." - links to report tabs
  effort: 'low' | 'medium' | 'high'
  impact: 1 | 2 | 3 // Star rating
  consensus: string[] // Which AI platforms support this
  targetPage: string | null
  category: 'content' | 'technical' | 'schema' | 'citations' | 'local'
  implementationSteps: string[]
  expectedOutcome: string
  targetKeywords: string[]
}

export interface PageEdit {
  page: string
  metaTitle: string | null
  metaDescription: string | null
  h1Change: 'keep' | string
  contentToAdd: string | null
}

export interface ContentPriority {
  title: string
  effort: 'low' | 'medium' | 'high'
  targetQuestion: string
  suggestedUrl: string
  keySections: string[]
}

export interface KeywordEntry {
  keyword: string
  bestPage: string
  whereToAdd: string
  priority: 'high' | 'medium' | 'low'
}

export interface GeneratedActionPlan {
  executiveSummary: string
  priorityActions: PriorityAction[]
  pageEdits: PageEdit[]
  contentPriorities: ContentPriority[]
  keywordMap: KeywordEntry[]
  keyTakeaways: string[]
}

// ============================================
// WEB SEARCH FOR BEST PRACTICES
// ============================================

/**
 * Search for current GEO/SEO best practices using Tavily
 * Claude needs expert-level knowledge to make good recommendations
 */
async function searchBestPractices(
  businessType: string,
  runId: string
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    log.warn(runId, 'TAVILY_API_KEY not configured, skipping best practices search')
    return ''
  }

  const searches = [
    `AI search optimization best practices 2025 GEO`,
    `schema markup ${businessType} SEO best practices`,
    `how to rank in ChatGPT Claude Perplexity AI assistants`,
  ]

  const results: string[] = []

  for (const query of searches) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 3,
        }),
      })

      if (response.ok) {
        const data = await response.json() as {
          answer?: string
          results?: Array<{ title?: string; content?: string }>
        }

        // Track Tavily cost for successful search
        await trackTavilyCost(runId, 'actions_best_practices_tavily')

        if (data.answer) {
          results.push(`### ${query}\n${data.answer}`)
        } else if (data.results && data.results.length > 0) {
          const snippets = data.results
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}...`)
            .join('\n')
          results.push(`### ${query}\n${snippets}`)
        }
      }
    } catch (error) {
      log.warn(runId, `Best practices search failed for: ${query}`)
    }
  }

  return results.length > 0
    ? `## CURRENT BEST PRACTICES (from web search)\n\n${results.join('\n\n')}`
    : ''
}

// ============================================
// PROMPT CONSTRUCTION
// ============================================

function buildPageAnalysis(pages: CrawledPage[]): string {
  if (pages.length === 0) return 'No pages crawled.'

  return pages.map(page => {
    const issues: string[] = []

    // Check for missing elements
    if (!page.title) issues.push('MISSING TITLE')
    if (!page.h1) issues.push('MISSING H1')
    if (!page.hasMetaDescription) issues.push('MISSING META DESCRIPTION')
    if (page.wordCount < 300) issues.push(`THIN CONTENT (${page.wordCount} words)`)
    if (page.schemaTypes.length === 0) issues.push('NO SCHEMA MARKUP')

    const issueStr = issues.length > 0 ? ` [ISSUES: ${issues.join(', ')}]` : ''

    return `
PAGE: ${page.path}${issueStr}
  Title: ${page.title || '(missing)'}
  H1: ${page.h1 || '(missing)'}
  Meta: ${page.metaDescription?.slice(0, 100) || '(missing)'}${page.metaDescription && page.metaDescription.length > 100 ? '...' : ''}
  Words: ${page.wordCount}
  Schema: ${page.schemaTypes.length > 0 ? page.schemaTypes.join(', ') : 'none'}
  Headings: ${page.headings.slice(0, 5).join(' | ') || 'none'}${page.headings.length > 5 ? ` (+${page.headings.length - 5} more)` : ''}`
  }).join('\n')
}

function buildVisibilityAnalysis(
  responses: LLMResponseData[],
  scores: ActionPlanInput['scores']
): string {
  const platforms = ['chatgpt', 'claude', 'gemini', 'perplexity']

  let analysis = `OVERALL SCORE: ${scores.overall}%\n\n`

  for (const platform of platforms) {
    const platformData = scores.byPlatform[platform]
    if (platformData) {
      const pct = platformData.total > 0
        ? Math.round((platformData.mentioned / platformData.total) * 100)
        : 0
      analysis += `${platform.toUpperCase()}: ${pct}% (${platformData.mentioned}/${platformData.total} queries)\n`
    }
  }

  // Find missed queries (where domain wasn't mentioned)
  const missedQueries = responses.filter(r => !r.domainMentioned)
  if (missedQueries.length > 0) {
    analysis += '\nMISSED QUERIES:\n'
    for (const q of missedQueries.slice(0, 10)) {
      const competitors = q.competitorsMentioned.slice(0, 3).join(', ')
      analysis += `- "${q.promptText}" (${q.platform})${competitors ? ` - competitors: ${competitors}` : ''}\n`
    }
  }

  return analysis
}

function buildCompetitiveAnalysis(
  brandAwareness: BrandAwarenessData[],
  competitiveSummary: CompetitiveSummaryData | null
): string {
  let analysis = ''

  if (competitiveSummary) {
    analysis += 'COMPETITIVE POSITION:\n'
    analysis += `Overall: ${competitiveSummary.overallPosition}\n\n`
    analysis += `Strengths: ${competitiveSummary.strengths.join('; ')}\n`
    analysis += `Weaknesses: ${competitiveSummary.weaknesses.join('; ')}\n`
    analysis += `Opportunities: ${competitiveSummary.opportunities.join('; ')}\n\n`
  }

  // Brand recognition gaps
  const brandRecalls = brandAwareness.filter(b => b.queryType === 'brand_recall')
  const unrecognizedPlatforms = brandRecalls
    .filter(b => !b.entityRecognized)
    .map(b => b.platform)

  if (unrecognizedPlatforms.length > 0) {
    analysis += `BRAND NOT RECOGNIZED BY: ${unrecognizedPlatforms.join(', ')}\n`
  }

  // Service knowledge gaps
  const serviceChecks = brandAwareness.filter(b => b.queryType === 'service_check')
  const unknownServices = serviceChecks
    .filter(b => !b.attributeMentioned && b.testedAttribute)
    .map(b => `"${b.testedAttribute}" (unknown to ${b.platform})`)

  if (unknownServices.length > 0) {
    analysis += `\nSERVICE KNOWLEDGE GAPS:\n${unknownServices.join('\n')}\n`
  }

  return analysis
}

function buildPlatformAnalysis(platformData: PlatformDataInput | null): string {
  if (!platformData) {
    return 'Platform detection not available for this scan.'
  }

  let analysis = ''

  // CMS/Platform identification
  if (platformData.cms) {
    const confidence = platformData.cmsConfidence ? ` (${platformData.cmsConfidence} confidence)` : ''
    analysis += `CMS/PLATFORM: ${platformData.cms}${confidence}\n`
  } else {
    analysis += 'CMS/PLATFORM: Unknown (custom build or undetected)\n'
  }

  // Tech stack
  const techParts: string[] = []
  if (platformData.framework) techParts.push(`Framework: ${platformData.framework}`)
  if (platformData.cssFramework) techParts.push(`CSS: ${platformData.cssFramework}`)
  if (platformData.hosting) techParts.push(`Hosting: ${platformData.hosting}`)
  if (platformData.ecommerce) techParts.push(`E-commerce: ${platformData.ecommerce}`)

  if (techParts.length > 0) {
    analysis += `TECH STACK: ${techParts.join(', ')}\n`
  }

  // Analytics
  if (platformData.analytics && platformData.analytics.length > 0) {
    analysis += `ANALYTICS: ${platformData.analytics.join(', ')}\n`
  } else {
    analysis += 'ANALYTICS: None detected\n'
  }

  // Lead capture
  if (platformData.leadCapture && platformData.leadCapture.length > 0) {
    analysis += `LEAD CAPTURE: ${platformData.leadCapture.join(', ')}\n`
  }

  // Content sections present
  const sections: string[] = []
  if (platformData.contentSections.hasBlog) sections.push('Blog')
  if (platformData.contentSections.hasCaseStudies) sections.push('Case Studies')
  if (platformData.contentSections.hasResources) sections.push('Resources')
  if (platformData.contentSections.hasFaq) sections.push('FAQ')
  if (platformData.contentSections.hasAboutPage) sections.push('About')
  if (platformData.contentSections.hasTeamPage) sections.push('Team')
  if (platformData.contentSections.hasTestimonials) sections.push('Testimonials')

  if (sections.length > 0) {
    analysis += `CONTENT SECTIONS: ${sections.join(', ')}\n`
  }

  // E-commerce flag
  if (platformData.isEcommerce) {
    analysis += 'E-COMMERCE: Yes\n'
  }

  // AI Readability issues
  if (platformData.hasAiReadabilityIssues) {
    analysis += '\n⚠️ AI READABILITY ISSUES DETECTED:\n'
    if (platformData.rendersClientSide) {
      analysis += '- Site renders client-side (JS required) - AI crawlers may not see content\n'
    }
    for (const issue of platformData.aiReadabilityIssues) {
      analysis += `- ${issue}\n`
    }
  }

  // AI-generated content signals
  if (platformData.likelyAiGenerated && platformData.aiSignals.length > 0) {
    analysis += '\n⚠️ AI-GENERATED CONTENT SIGNALS:\n'
    for (const signal of platformData.aiSignals) {
      analysis += `- ${signal}\n`
    }
  }

  return analysis
}

function buildSystemPrompt(): string {
  return `You are an expert AI Search Optimization (GEO) consultant with deep expertise in helping businesses improve their visibility in AI assistants like ChatGPT, Claude, Perplexity, and Gemini.

Your task is to analyze a website's scan data and generate a comprehensive, actionable improvement plan.

CRITICAL RULES:
1. ONLY recommend actions for DETECTED issues - never hypothetical problems
2. Every action must reference SPECIFIC pages, elements, or findings from the data
3. Actions must be immediately implementable - include exact copy, code snippets, or clear instructions
4. Prioritize by IMPACT (what will move the needle most) then EFFORT (quick wins first)
5. "Consensus" field = which AI platforms' data supports this recommendation
6. Be an expert - use the best practices reference to ensure recommendations are current
7. Format output as valid JSON matching the schema exactly

CRITICAL - SCAN HISTORY:
The SCAN HISTORY section lists earlier scans of this same domain, the site changes
detected between them, and how many score points a single AI mention is worth.

8. Credit work the customer has already shipped. If the history shows a sitemap,
   schema, or meta descriptions appearing on a date, do not recommend adding them
   again — build on them instead.
9. Never present a score move smaller than the stated noise floor as progress or
   as a decline. Say the number held steady within measurement error, and point
   at the underlying mention counts instead.
10. Where the history shows a change that did not move the score, say so and
    explain what else has to be true before that change can pay off. Do not imply
    the work was wasted.
11. Judge progress on mention counts and technical readiness, which move in
    single steps, rather than on the headline score, which is noisy at this
    sample size.

CRITICAL - SOURCE INSIGHTS:
Each action MUST include a "sourceInsight" field that explicitly connects the recommendation to a specific finding from the scan data. This helps users understand WHY we're recommending this action based on what they've already seen in their report.

Use these prefixes based on the data source:
- "Based on your AI Responses: [specific finding]..." - when referencing missed queries or competitor mentions
- "Based on your AI Readiness scan: [specific issue]..." - when referencing technical SEO/meta/schema issues
- "Based on your Brand Awareness results: [specific gap]..." - when referencing brand recognition gaps
- "Based on your Competitive Intelligence: [specific insight]..." - when referencing competitor strengths/weaknesses

Examples of GOOD sourceInsight values:
- "Based on your AI Responses: ChatGPT and Perplexity mentioned competitors 'Acme Corp' and 'BetterCo' instead of you for 3 service-related queries."
- "Based on your AI Readiness scan: Your /services page is missing an H1 tag and has only 156 words of content."
- "Based on your Brand Awareness results: Claude and Gemini did not recognize your brand when asked directly."
- "Based on your Competitive Intelligence: Your competitors are being recommended for 'best [service] in [location]' queries while you are not."

IMPACT SCORING:
- 3 stars (⭐⭐⭐): High impact - directly addresses visibility gaps, affects multiple platforms
- 2 stars (⭐⭐): Medium impact - improves discoverability for specific queries
- 1 star (⭐): Lower impact - nice to have, improves overall quality

EFFORT SCORING:
- low: Can be done in < 30 minutes (meta tags, small content additions)
- medium: 1-4 hours of work (new content sections, schema implementation)
- high: Full day or more (new pages, major restructuring)

CATEGORY DEFINITIONS:
- content: Text content additions or improvements
- technical: Technical SEO (sitemap, robots.txt, page speed)
- schema: Structured data / JSON-LD markup
- citations: Getting mentioned in authoritative sources
- local: Geographic/location-based optimizations

ONLINE-ONLY / NATIONAL SERVICE BUSINESSES - CRITICAL SCHEMA GUIDANCE:
When a business has a physical address in one city but serves customers nationally or across a broader region online (e.g. online lenders, SaaS, telecoms, insurance, e-commerce), apply this pattern:

1. DETECT the mismatch: Physical location listed (e.g. "Sydney") but services are online/national. Signals include:
   - Domain is .com.au / .co.uk / .com but location is a single city
   - Services include "online application", "nationwide", "across Australia/UK/US"
   - Industry is financial services, insurance, SaaS, e-commerce, telecoms
   - The business type suggests customers don't visit the physical location

2. DO NOT recommend LocalBusiness schema alone — it implies a physical premises customers visit.
   Instead recommend the correct industry-specific schema type:
   - Financial services / lenders: "@type": ["FinancialService", "LocalBusiness"] with areaServed
   - Insurance: "@type": ["InsuranceAgency", "LocalBusiness"] with areaServed
   - Online retail: "@type": ["OnlineStore", "Organization"] with areaServed
   - SaaS / software: "@type": "SoftwareApplication" or "Organization" with areaServed
   - General online business: "@type": ["Service", "Organization"] with areaServed

3. ALWAYS recommend the areaServed field to explicitly declare geographic reach:
   - National (recommended for online-only): "areaServed": {"@type": "Country", "name": "Australia"}
   - Multi-state: "areaServed": [{"@type": "State", "name": "NSW"}, {"@type": "State", "name": "VIC"}]
   - Specific region/suburb targeting: "areaServed": [{"@type": "Country", "name": "Australia"}, {"@type": "AdministrativeArea", "name": "Western Sydney"}, {"@type": "AdministrativeArea", "name": "Regional NSW"}]
   - IMPORTANT: For businesses targeting suburbs and regional areas (not just CBDs), listing both the
     Country AND key AdministrativeArea regions signals to AI that this business is relevant to
     non-metropolitan searches — which is especially powerful for financial services, healthcare,
     and services where metro competitors dominate but regional demand is underserved.
   - Without areaServed, AI platforms assume the business only serves its registered address city

4. ALWAYS pair the physical address with a serviceChannel block to clarify online delivery:
   "availableChannel": {
     "@type": "ServiceChannel",
     "serviceUrl": "https://domain.com/apply",
     "serviceType": "Online",
     "availableLanguage": "English"
   }

5. For LOCATION-SPECIFIC landing pages (e.g. /personal-loans-sydney), use a SCOPED variant:
   Add a page-specific schema block with "areaServed": {"@type": "City", "name": "Sydney"}
   Keep the sitewide schema with the full national areaServed — these don't conflict.
   This tells AI: "this page is specifically about Sydney" without limiting national positioning.

6. EXPLAIN the impact clearly in the recommendation: without areaServed, AI treats the business
   as Sydney-only. With areaServed set to the country, AI will correctly recommend the business
   for queries from any location in that country.

PLATFORM-SPECIFIC RECOMMENDATIONS:
When platform/CMS data is available, you MUST tailor recommendations to the specific technology stack. This is critical for actionable advice.

For WordPress sites:
- Recommend specific plugins (Yoast SEO, Rank Math, Schema Pro, etc.)
- Reference wp-admin paths and settings locations
- Suggest theme-specific optimizations when relevant
- Mention .htaccess or wp-config.php changes where appropriate

For Webflow sites:
- Reference Webflow's native SEO settings panel
- Recommend Webflow-specific schema implementations
- Suggest using Webflow's CMS collections for content
- Mention Webflow's built-in 301 redirect manager

For Squarespace sites:
- Reference Squarespace's SEO panel locations
- Recommend Squarespace-compatible third-party tools
- Suggest using built-in blogging and page features
- Mention limitations of the platform where relevant

For Shopify sites:
- Recommend Shopify-specific apps (JSON-LD for SEO, etc.)
- Reference Shopify's native SEO fields in admin
- Suggest product/collection optimizations
- Mention Shopify's Liquid templating for advanced changes

For Wix sites:
- Reference Wix SEO Wiz and advanced SEO settings
- Suggest Wix-compatible solutions
- Mention Wix's URL structure limitations
- Recommend Wix Editor features for content optimization

For custom/React/Next.js sites:
- Provide code snippets for JSON-LD implementation
- Suggest using next-seo or similar packages
- Reference server-side rendering considerations
- Mention build/deployment optimizations

For sites with AI READABILITY ISSUES (client-side rendering):
- PRIORITIZE fixing client-side rendering issues
- Recommend server-side rendering or static generation
- Suggest pre-rendering services if framework allows
- This is CRITICAL - AI assistants cannot read JS-rendered content

For sites with AI-GENERATED CONTENT SIGNALS:
- Recommend humanizing content with specific examples
- Suggest adding unique expertise and personal insights
- Recommend including original research or data
- Suggest varying sentence structure and vocabulary

CONTENT QUALITY GUIDELINES - CRITICAL:
When suggesting URLs, content, meta tags, or any copy, follow these rules to avoid search engine and AI penalties:

1. NO UNSUBSTANTIATED SUPERLATIVES:
   - NEVER use: "best", "top", "#1", "leading", "premier", "ultimate", "greatest"
   - NEVER suggest URLs like: /best-[service]-[location] or /top-[industry]-company
   - Instead use descriptive URLs: /[service]-[location], /services/[service-name], /[location]-[service]
   - Replace claims with proof: "Trusted by 200+ clients" instead of "Best in town"

2. NO KEYWORD STUFFING:
   - Don't over-optimize titles/descriptions with repetitive keywords
   - Bad: "Digital Marketing Brisbane | Brisbane Digital Marketing Agency | Best Brisbane Marketing"
   - Good: "Digital Marketing Services in Brisbane | [Business Name]"

3. NO THIN OR DUPLICATED CONTENT:
   - Suggest substantial, unique content (300+ words for service pages)
   - Each page should have a distinct purpose and unique content
   - Don't suggest creating multiple pages targeting slight keyword variations

4. FOCUS ON VALUE, NOT MANIPULATION:
   - Content should answer user questions genuinely
   - Recommend content that demonstrates expertise (E-E-A-T)
   - Suggest proof points: case studies, testimonials, credentials, awards

5. PROFESSIONAL URL PATTERNS:
   - Good: /services/digital-marketing, /brisbane-office, /about-us
   - Bad: /best-cheap-digital-marketing-brisbane-australia-2024

6. HONEST CLAIMS ONLY:
   - Only suggest claims the business can substantiate
   - Use qualifiers when appropriate: "One of Brisbane's...", "Specialists in..."
   - Recommend adding proof alongside any positioning statements

VISIBILITY SCORE LANGUAGE - EXECUTIVE SUMMARY TONE:
When writing the executive summary, use accurate, calibrated language for visibility scores:

| Score Range | Label      | Description                                    |
|-------------|------------|------------------------------------------------|
| 0-5%        | Critical   | Virtually invisible to AI assistants           |
| 5-15%       | Very Low   | Rarely mentioned by AI assistants              |
| 15-30%      | Low        | Occasionally mentioned but not prominent       |
| 30-50%      | Moderate   | Some presence but significant room to grow     |
| 50-70%      | Good       | Solid visibility with optimization potential   |
| 70-85%      | Strong     | Well-represented across AI platforms           |
| 85-100%     | Excellent  | Exceptional AI visibility                      |

Language guidelines:
- NEVER say "poor" or "only X%" - these are unnecessarily negative
- Use factual, opportunity-focused framing: "moderate visibility at 49%" not "only 49% visibility"
- Frame gaps as opportunities: "40% visibility gap to close" not "failing at 60% of queries"
- Compare to platform averages when relevant: "ChatGPT shows 42% vs your 49% overall"
- Focus on actionable improvement, not criticism
- The executive summary should motivate action, not discourage the user`
}

/**
 * Render the scan history as measurement context rather than a scoreboard.
 *
 * Two things have to come through. First, which site changes the customer has
 * already made, and on what date, so the plan credits them instead of
 * repeating them. Second, how much of a score move is real: the visibility
 * score is built from a small number of mentions, so a single answer changing
 * shifts it several points. A plan that treats that as a trend sends the
 * customer chasing noise.
 */
function buildHistoryAnalysis(input: ActionPlanInput): string {
  const history = input.history ?? []
  if (history.length === 0) {
    return 'No earlier scans of this domain. This is the first measurement, so treat the current numbers as a baseline rather than a result.'
  }

  const timeline = history
    .map((point) => {
      const mentions = Object.entries(point.mentionsByPlatform)
        .map(([platform, count]) => `${platform} ${count}`)
        .join(', ')
      return `- ${point.scanDate}: score ${point.visibilityScore}, mentions ${mentions || 'none'}`
    })
    .join('\n')

  // Site changes the customer shipped between consecutive scans.
  const siteChanges: string[] = []
  const points = [
    ...history,
    {
      scanDate: input.currentScanDate ?? 'this scan',
      visibilityScore: input.scores.overall,
      mentionsByPlatform: {},
      hasSitemap: input.crawlData.hasSitemap,
      hasRobotsTxt: input.crawlData.hasRobotsTxt,
      hasMetaDescriptions: input.crawlData.hasMetaDescriptions,
      schemaTypes: input.crawlData.schemaTypes,
      pagesCrawled: input.crawlData.pagesCrawled,
    } satisfies ScanHistoryPoint,
  ]

  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1]
    const after = points[i]
    const when = after.scanDate

    if (!before.hasSitemap && after.hasSitemap) {
      siteChanges.push(`${when}: sitemap.xml appeared — the customer shipped this`)
    }
    if (before.hasSitemap && !after.hasSitemap) {
      siteChanges.push(`${when}: sitemap.xml disappeared — flag this as a regression`)
    }
    if (!before.hasRobotsTxt && after.hasRobotsTxt) {
      siteChanges.push(`${when}: robots.txt appeared`)
    }
    if (!before.hasMetaDescriptions && after.hasMetaDescriptions) {
      siteChanges.push(`${when}: meta descriptions appeared`)
    }
    const added = after.schemaTypes.filter((t) => !before.schemaTypes.includes(t))
    if (added.length > 0) {
      siteChanges.push(`${when}: schema added — ${added.join(', ')}`)
    }
    const pageDelta = after.pagesCrawled - before.pagesCrawled
    if (Math.abs(pageDelta) >= 3) {
      siteChanges.push(
        `${when}: pages crawled went from ${before.pagesCrawled} to ${after.pagesCrawled}`
      )
    }
  }

  const changesSection =
    siteChanges.length > 0
      ? siteChanges.map((c) => `- ${c}`).join('\n')
      : '- No detected change to sitemap, robots.txt, schema, meta descriptions, or page count across these scans.'

  // How many score points one mention is worth, so the model can tell a real
  // move from sampling noise. ChatGPT carries 10 of the 17 weight.
  const chatgptTotal = input.scores.byPlatform.chatgpt?.total ?? 0
  const noiseFloor =
    chatgptTotal > 0 ? Math.round((1 / chatgptTotal) * (10 / 17) * 100 * 10) / 10 : null

  const resolution = noiseFloor
    ? `This scan asks ${chatgptTotal} questions per platform. One ChatGPT answer changing its mind moves the visibility score by about ${noiseFloor} points on its own. Treat any week-to-week move smaller than ${Math.round(noiseFloor * 2)} points as sampling noise, not as a result of the customer's work.`
    : 'Score moves of a few points between scans are sampling noise rather than results.'

  const currentLine = input.currentScanDate
    ? `- ${input.currentScanDate}: score ${input.scores.overall} (this scan, the one you are writing the plan for)`
    : `- This scan: score ${input.scores.overall}`

  return `### Score timeline (oldest first)

${timeline}
${currentLine}

### Site changes detected between scans

${changesSection}

### How to read these numbers

${resolution}`
}

function buildUserPrompt(
  input: ActionPlanInput,
  bestPractices: string
): string {
  const businessName = input.analysis.businessName || input.domain
  const pageAnalysis = buildPageAnalysis(input.crawledPages)
  const visibilityAnalysis = buildVisibilityAnalysis(input.responses, input.scores)
  const competitiveAnalysis = buildCompetitiveAnalysis(input.brandAwareness, input.competitiveSummary)
  const platformAnalysis = buildPlatformAnalysis(input.platformData)
  const historyAnalysis = buildHistoryAnalysis(input)

  // Build completed actions section if any exist
  const completedSection = input.completedActionTitles && input.completedActionTitles.length > 0
    ? `\n## PREVIOUSLY COMPLETED ACTIONS\n\nThe user has already completed these actions from previous scans. DO NOT suggest similar actions again:\n${input.completedActionTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  return `${bestPractices}

## BUSINESS PROFILE

Name: ${businessName}
Domain: ${input.domain}
Type: ${input.analysis.businessType}
Industry: ${input.analysis.industry}
Location: ${input.analysis.location || 'Not specified'}
Services: ${input.analysis.services.join(', ') || 'None detected'}
Key Phrases: ${input.analysis.keyPhrases.join(', ') || 'None detected'}

## TECHNICAL READINESS

- Sitemap: ${input.crawlData.hasSitemap ? 'Present' : 'MISSING'}
- Robots.txt: ${input.crawlData.hasRobotsTxt ? 'Present' : 'MISSING'}
- Pages Crawled: ${input.crawlData.pagesCrawled}
- Meta Descriptions: ${input.crawlData.hasMetaDescriptions ? 'Some present' : 'MISSING on all pages'}
- Schema Types Found: ${input.crawlData.schemaTypes.length > 0 ? input.crawlData.schemaTypes.join(', ') : 'NONE'}

## PLATFORM & TECHNOLOGY STACK

${platformAnalysis}

## PAGE-BY-PAGE ANALYSIS

${pageAnalysis}

## AI VISIBILITY DATA

${visibilityAnalysis}

## COMPETITIVE INTELLIGENCE

${competitiveAnalysis}

## SCAN HISTORY AND WHAT HAS ALREADY CHANGED

${historyAnalysis}
${completedSection}
---

Based on the above data, generate a comprehensive action plan. You MUST respond with ONLY valid JSON matching this exact structure:

{
  "executiveSummary": "3-4 sentences. Open by naming what the customer changed since the last scan and what it did or did not do to the numbers, using the SCAN HISTORY section. Then give the current state and the top opportunity. If a score move is inside the noise floor, say so plainly rather than presenting it as progress or decline.",
  "priorityActions": [
    {
      "rank": 1,
      "title": "Specific action title",
      "description": "Detailed description of what to do",
      "rationale": "Why this matters - reference specific data",
      "sourceInsight": "Based on your [AI Responses/AI Readiness scan/Brand Awareness results/Competitive Intelligence]: [specific finding from the scan data]",
      "effort": "low|medium|high",
      "impact": 1|2|3,
      "consensus": ["chatgpt", "claude"],
      "targetPage": "/specific-page or null",
      "category": "content|technical|schema|citations|local",
      "implementationSteps": ["Step 1", "Step 2", "Step 3"],
      "expectedOutcome": "What improvement this will drive",
      "targetKeywords": ["keyword1", "keyword2"]
    }
  ],
  "pageEdits": [
    {
      "page": "/page-path",
      "metaTitle": "Optimized title or null",
      "metaDescription": "Optimized description or null",
      "h1Change": "keep or new H1 text",
      "contentToAdd": "Exact content to add or null"
    }
  ],
  "contentPriorities": [
    {
      "title": "New content piece title",
      "effort": "low|medium|high",
      "targetQuestion": "The AI query this addresses",
      "suggestedUrl": "/suggested-path",
      "keySections": ["Section 1", "Section 2"]
    }
  ],
  "keywordMap": [
    {
      "keyword": "keyword phrase",
      "bestPage": "/page-path",
      "whereToAdd": "Specific location (e.g., H2 heading, meta description)",
      "priority": "high|medium|low"
    }
  ],
  "keyTakeaways": [
    "Takeaway 1 with data point",
    "Takeaway 2 with data point",
    "Takeaway 3 with data point"
  ]
}

Generate 10-15 priority actions, 3-5 page edits, 3-5 content priorities, 8-12 keyword map entries, and 3-5 key takeaways.`
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate comprehensive AI-powered action plan
 *
 * Uses Claude at high reasoning effort for deep analysis
 * and web search for current best practices
 */
export async function generateActionPlan(
  input: ActionPlanInput,
  runId: string
): Promise<GeneratedActionPlan> {
  log.step(runId, 'Generating AI-powered action plan')

  // Step 1: Search for current best practices
  log.info(runId, 'Searching for current GEO/SEO best practices...')
  const bestPractices = await searchBestPractices(input.analysis.businessType, runId)

  // Step 2: Build prompts
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input, bestPractices)

  log.info(runId, `Action plan prompt: ~${Math.round(userPrompt.length / 4)} tokens input`)

  // Step 3: Generate with Claude at high reasoning effort
  const startTime = Date.now()

  try {
    const result = await generateText({
      model: anthropic(CLAUDE_MODEL),
      system: systemPrompt,
      prompt: userPrompt,
      // Sonnet 5 counts adaptive thinking against the same budget as the visible
      // text, and at high effort the thinking is substantial. A plan carrying
      // 15 actions with implementation steps runs to roughly 10k tokens of JSON
      // on its own, so the budget has to cover both. 8000 truncated the payload
      // mid-array, and the parser turned that into an empty plan.
      maxOutputTokens: 32000,
      providerOptions: CLAUDE_DEEP_REASONING_OPTIONS,
    })

    const responseTimeMs = Date.now() - startTime
    log.info(
      runId,
      `Action plan generated in ${(responseTimeMs / 1000).toFixed(1)}s ` +
        `(finish: ${result.finishReason}, ${result.text.length} chars)`
    )

    // `length` means the budget ran out mid-JSON. The parse below would fail on
    // the truncated payload, so name the real cause here.
    if (result.finishReason === 'length') {
      log.warn(runId, 'Action plan hit the output token budget and was truncated')
    }

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'generate_action_plan',
        model: CLAUDE_GATEWAY_MODEL,
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse JSON response
    const actionPlan = await parseActionPlanResponse(result.text, runId)

    log.done(runId, 'Action plan', `${actionPlan.priorityActions.length} actions, ${actionPlan.pageEdits.length} page edits`)

    return actionPlan

  } catch (error) {
    log.error(runId, 'Action plan generation failed', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

/**
 * Parse and validate action plan JSON response
 */
async function parseActionPlanResponse(
  text: string,
  runId: string,
  repaired = false
): Promise<GeneratedActionPlan> {
  // Try to extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = text

  // Check for markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  // Try to find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    jsonStr = objectMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr) as GeneratedActionPlan

    // Validate required fields
    if (!parsed.executiveSummary) {
      parsed.executiveSummary = 'Action plan generated - see priority actions below.'
    }
    if (!Array.isArray(parsed.priorityActions)) {
      parsed.priorityActions = []
    }
    if (!Array.isArray(parsed.pageEdits)) {
      parsed.pageEdits = []
    }
    if (!Array.isArray(parsed.contentPriorities)) {
      parsed.contentPriorities = []
    }
    if (!Array.isArray(parsed.keywordMap)) {
      parsed.keywordMap = []
    }
    if (!Array.isArray(parsed.keyTakeaways)) {
      parsed.keyTakeaways = []
    }

    // Validate and normalize priority actions
    parsed.priorityActions = parsed.priorityActions.map((action, index) => ({
      rank: action.rank || index + 1,
      title: action.title || 'Untitled Action',
      description: action.description || '',
      rationale: action.rationale || '',
      sourceInsight: action.sourceInsight || '',
      effort: normalizeEffort(action.effort),
      impact: normalizeImpact(action.impact),
      consensus: Array.isArray(action.consensus) ? action.consensus : [],
      targetPage: action.targetPage || null,
      category: normalizeCategory(action.category),
      implementationSteps: Array.isArray(action.implementationSteps) ? action.implementationSteps : [],
      expectedOutcome: action.expectedOutcome || '',
      targetKeywords: Array.isArray(action.targetKeywords) ? action.targetKeywords : [],
    }))

    return parsed

  } catch (parseError) {
    const detail = parseError instanceof Error ? parseError.message : 'Parse error'

    // Sonnet 5 intermittently wraps the payload in fences or pads it with
    // prose. Try the shared repair before giving up.
    if (!repaired) {
      const candidate = await repairMalformedJson({ text })
      if (candidate && candidate !== jsonStr) {
        log.warn(runId, `Action plan JSON needed repair: ${detail}`)
        return parseActionPlanResponse(candidate, runId, true)
      }
    }

    // Returning an empty plan here used to look like success: the caller stored
    // a plan with zero actions and the report showed a blank Action Plan tab
    // with no error anywhere. Throw so the enrichment step records a failure.
    log.error(runId, 'Failed to parse action plan JSON', detail)
    throw new Error(`Action plan JSON was unparseable: ${detail}`)
  }
}

function normalizeEffort(effort: unknown): 'low' | 'medium' | 'high' {
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort
  return 'medium'
}

function normalizeImpact(impact: unknown): 1 | 2 | 3 {
  if (impact === 1 || impact === 2 || impact === 3) return impact
  if (typeof impact === 'number') return Math.min(3, Math.max(1, Math.round(impact))) as 1 | 2 | 3
  return 2
}

function normalizeCategory(category: unknown): 'content' | 'technical' | 'schema' | 'citations' | 'local' {
  const valid = ['content', 'technical', 'schema', 'citations', 'local']
  if (typeof category === 'string' && valid.includes(category)) {
    return category as 'content' | 'technical' | 'schema' | 'citations' | 'local'
  }
  return 'content'
}
