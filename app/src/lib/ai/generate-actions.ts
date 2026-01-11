/**
 * AI-Powered Action Plan Generation
 *
 * Generates comprehensive, PRD-ready action plans using Claude with:
 * - Extended thinking for deep analysis
 * - Web search for current best practices
 * - Full page-level site data for specific recommendations
 *
 * Output: Prioritized actions with implementation steps, page edits, keyword maps
 */

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { trackCost } from './costs'
import { log } from '@/lib/logger'

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

  // Previously completed action titles (to avoid regenerating)
  completedActionTitles?: string[]
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
   - Recommend adding proof alongside any positioning statements`
}

function buildUserPrompt(
  input: ActionPlanInput,
  bestPractices: string
): string {
  const businessName = input.analysis.businessName || input.domain
  const pageAnalysis = buildPageAnalysis(input.crawledPages)
  const visibilityAnalysis = buildVisibilityAnalysis(input.responses, input.scores)
  const competitiveAnalysis = buildCompetitiveAnalysis(input.brandAwareness, input.competitiveSummary)

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

## PAGE-BY-PAGE ANALYSIS

${pageAnalysis}

## AI VISIBILITY DATA

${visibilityAnalysis}

## COMPETITIVE INTELLIGENCE

${competitiveAnalysis}
${completedSection}
---

Based on the above data, generate a comprehensive action plan. You MUST respond with ONLY valid JSON matching this exact structure:

{
  "executiveSummary": "2-3 sentence summary of current state and top opportunity",
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
 * Uses Claude with extended thinking for deep analysis
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

  // Step 3: Generate with Claude using extended thinking
  const startTime = Date.now()

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 8000,
      providerOptions: {
        anthropic: {
          // Enable extended thinking for deeper analysis
          thinking: {
            type: 'enabled',
            budgetTokens: 10000, // Allow up to 10k tokens for reasoning
          },
        },
      },
    })

    const responseTimeMs = Date.now() - startTime
    log.info(runId, `Action plan generated in ${(responseTimeMs / 1000).toFixed(1)}s`)

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'generate_action_plan',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Parse JSON response
    const actionPlan = parseActionPlanResponse(result.text, runId)

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
function parseActionPlanResponse(text: string, runId: string): GeneratedActionPlan {
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
    log.error(runId, 'Failed to parse action plan JSON', parseError instanceof Error ? parseError.message : 'Parse error')

    // Return minimal valid structure
    return {
      executiveSummary: 'Action plan generation encountered an error. Please try regenerating.',
      priorityActions: [],
      pageEdits: [],
      contentPriorities: [],
      keywordMap: [],
      keyTakeaways: ['Generation encountered a parsing error - please regenerate'],
    }
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
