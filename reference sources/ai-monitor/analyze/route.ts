import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generatePRDWithClaude } from '@/lib/ai-monitor/generatePRD'
import { createCostRecord, sumCosts, type CostRecord, type TokenUsage } from '@/lib/ai-monitor/costTracking'

export const maxDuration = 300 // 5 minutes - allows for all 5 API calls (3 analysis + synthesis + PRD)

interface AnalysisResult {
  chatgptInsights: string
  claudeInsights: string
  geminiInsights: string
  synthesizedRecommendations: string
}

interface InsightResult {
  content: string
  usage: TokenUsage | null
}

interface QuestionGroupData {
  groupName: string
  groupDescription: string | null
  mentioned: number
  total: number
  missedQuestions: { question: string; platform: string; competitorsMentioned: string[] }[]
  mentionedQuestions: { question: string; platform: string }[]
}

interface SitePageData {
  path: string
  title: string | null
  description: string | null
  h1: string | null
  page_type: string | null
  schema_types: string[] | null
  word_count: number | null
  headings: string[] | null
  detected_sections: string[] | null
  key_phrases: string[] | null
}

function buildAnalysisPrompt(data: {
  totalQuestions: number
  mentionRate: number
  platformStats: Record<string, { mentioned: number; total: number }>
  topCompetitors: { name: string; count: number }[]
  questionGroups: QuestionGroupData[]
  sitePages?: SitePageData[]
}): string {
  const competitorList = data.topCompetitors
    .slice(0, 10)
    .map(c => `- ${c.name}: ${c.count} mentions`)
    .join('\n')

  // Build group-by-group breakdown
  const groupBreakdowns = data.questionGroups.map(group => {
    const mentionRate = group.total > 0 ? ((group.mentioned / group.total) * 100).toFixed(1) : '0'

    const missedList = group.missedQuestions
      .slice(0, 10)
      .map(q => `  - "${q.question}" (${q.platform})${q.competitorsMentioned.length > 0 ? ` - Competitors: ${q.competitorsMentioned.join(', ')}` : ''}`)
      .join('\n')

    const mentionedList = group.mentionedQuestions
      .slice(0, 5)
      .map(q => `  - "${q.question}" (${q.platform})`)
      .join('\n')

    return `### ${group.groupName}
${group.groupDescription ? `*${group.groupDescription}*\n` : ''}
**Mention Rate:** ${mentionRate}% (${group.mentioned}/${group.total})

**Missed Questions:**
${missedList || '  None'}

**Mentioned Questions:**
${mentionedList || '  None'}`
  }).join('\n\n')

  // Build site structure section if pages are available
  let siteStructureSection = ''
  if (data.sitePages && data.sitePages.length > 0) {
    // Build detailed page content listing
    const pageDetails = data.sitePages.map(p => {
      let detail = `### ${p.path}\n`
      if (p.title) detail += `- **Title:** "${p.title}"\n`
      if (p.h1) detail += `- **H1:** "${p.h1}"\n`
      if (p.schema_types?.length) detail += `- **Schema:** ${p.schema_types.join(', ')}\n`
      if (p.detected_sections?.length) detail += `- **Content Sections:** ${p.detected_sections.join(', ')}\n`
      if (p.headings?.length) {
        const topHeadings = p.headings.slice(0, 8)
        detail += `- **Key Headings:** ${topHeadings.join(' | ')}${p.headings.length > 8 ? ' ...' : ''}\n`
      }
      if (p.key_phrases?.length) detail += `- **Key Phrases Found:** ${p.key_phrases.join(', ')}\n`
      return detail
    }).join('\n')

    siteStructureSection = `
## Current Site Structure & Content

JOURN3Y's website has ${data.sitePages.length} indexed pages. **READ THIS CAREFULLY** - each page's existing content is listed below. DO NOT recommend adding content that already exists!

${pageDetails}

**CRITICAL:** Before recommending "add X to page Y", verify X is not already present in the page's Content Sections, Key Headings, or Key Phrases above. Only recommend GENUINE GAPS.

`
  }

  return `You are an expert AI Search Optimization consultant analyzing visibility data for JOURN3Y, an Australian AI consulting firm.

## About JOURN3Y

JOURN3Y has TWO DISTINCT SERVICE AREAS that require separate strategies:

1. **Glean Enterprise Search** - Implementation and consulting for Glean's enterprise AI search platform
   - Target: Medium-to-large enterprises
   - Key page: /products/glean
   - Value prop: Australia's premier Glean implementation partner

2. **Small Business AI** - AI consulting, training, and implementation
   - Target: Australian small businesses
   - Key page: /small-business-ai (with industry-specific subpages)
   - Value prop: Practical, affordable AI adoption for SMBs

Website: https://journ3y.com.au
${siteStructureSection}
## Current Performance Data

**Overall Mention Rate:** ${data.mentionRate.toFixed(1)}% (${data.platformStats.chatgpt?.mentioned || 0}/${data.platformStats.chatgpt?.total || 0} ChatGPT, ${data.platformStats.claude?.mentioned || 0}/${data.platformStats.claude?.total || 0} Claude, ${data.platformStats.gemini?.mentioned || 0}/${data.platformStats.gemini?.total || 0} Gemini)

**Top Competitors Being Mentioned Instead:**
${competitorList}

## Performance by Question Group

${groupBreakdowns}

---

## YOUR ANALYSIS TASK

You must provide EXPERT-LEVEL, ACTIONABLE recommendations. For each recommendation:
- Reference SPECIFIC pages from the site structure above
- Provide EXACT copy/content suggestions where relevant
- Include effort level: 🟢 Low (< 1 hour) | 🟡 Medium (1-4 hours) | 🔴 High (> 4 hours)
- Include impact level: ⭐ Low | ⭐⭐ Medium | ⭐⭐⭐ High

### FORMAT YOUR RESPONSE AS:

## PRIORITY ACTIONS (Top 5)

For each action:
1. **[Action Title]** - Effort: [🟢/🟡/🔴] | Impact: [⭐/⭐⭐/⭐⭐⭐]
   - **Page to update:** [specific path from site structure]
   - **What to add/change:** [specific content or meta tag changes]
   - **Why:** [connection to missed questions]

## PAGE-SPECIFIC RECOMMENDATIONS

For each relevant page in the site structure, provide:

### [Page Path]
- **Current gap:** What's missing that would help AI mention this page?
- **Title tag suggestion:** If meta title should change
- **H1/content additions:** Specific phrases or sections to add
- **Schema opportunity:** Any JSON-LD schema that would help

## KEYWORD GAPS

List specific phrases/keywords that appear in missed questions but are NOT present on the site:
- [keyword 1] - Relevant page: [path] - Suggested placement: [where on page]
- [keyword 2] - etc.

## COMPETITOR DIFFERENTIATION

For the top 3 competitors mentioned:
1. **[Competitor]**: Why they're being mentioned, how JOURN3Y should differentiate

## QUESTIONS TO TARGET NEXT

List 3 specific missed questions that would be easiest to "win" with targeted content changes.

---

IMPORTANT RULES:
- Keep Glean enterprise recommendations SEPARATE from small business recommendations
- Reference ACTUAL page paths from the site structure
- Be SPECIFIC with copy suggestions - don't just say "add keywords", say exactly what to add
- Focus on what AI search engines look for: clear answers, structured data, expertise signals`
}

async function getOpenAIInsights(prompt: string): Promise<InsightResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return { content: 'OpenAI API key not configured', usage: null }

  try {
    const openai = new OpenAI({ apiKey: openaiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an SEO and AI visibility expert. Provide concise, actionable insights.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500
    })
    return {
      content: completion.choices[0]?.message?.content || 'No response',
      usage: completion.usage ? {
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
        model: 'gpt-4o'
      } : null
    }
  } catch (error) {
    console.error('OpenAI analysis error:', error)
    return { content: `Error: ${error}`, usage: null }
  }
}

async function getClaudeInsights(prompt: string): Promise<InsightResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return { content: 'Anthropic API key not configured', usage: null }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are an SEO and AI visibility expert. Provide concise, actionable insights.',
      messages: [{ role: 'user', content: prompt }]
    })
    return {
      content: message.content[0]?.type === 'text' ? message.content[0].text : 'No response',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model: 'claude-sonnet-4-20250514'
      }
    }
  } catch (error) {
    console.error('Claude analysis error:', error)
    return { content: `Error: ${error}`, usage: null }
  }
}

async function getGeminiInsights(prompt: string): Promise<InsightResult> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY
  if (!googleApiKey) return { content: 'Google AI API key not configured', usage: null }

  try {
    const genAI = new GoogleGenerativeAI(googleApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500 }
    })
    // Gemini usage metadata
    const usageMetadata = result.response.usageMetadata
    return {
      content: result.response.text(),
      usage: usageMetadata ? {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        model: 'gemini-2.0-flash-exp'
      } : null
    }
  } catch (error) {
    console.error('Gemini analysis error:', error)
    return { content: `Error: ${error}`, usage: null }
  }
}

async function synthesizeWithClaude(
  chatgptInsights: string,
  claudeInsights: string,
  geminiInsights: string
): Promise<InsightResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return { content: 'Cannot synthesize - Anthropic API key not configured', usage: null }

  const synthesisPrompt = `You are synthesizing expert AI search visibility analyses from three different AI systems into an actionable implementation plan.

## ChatGPT's Analysis:
${chatgptInsights}

## Claude's Analysis:
${claudeInsights}

## Gemini's Analysis:
${geminiInsights}

---

## YOUR SYNTHESIS TASK

Create a PRIORITIZED ACTION PLAN that combines the best insights from all three analyses. Use this format:

---

## EXECUTIVE SUMMARY

2-3 sentences: What's the current state? What's the biggest opportunity?

---

## TOP 10 PRIORITY ACTIONS

Rank by impact, combining recommendations where multiple AIs agreed. For each:

### 1. [Action Title]
- **Effort:** 🟢 Low / 🟡 Medium / 🔴 High
- **Impact:** ⭐ / ⭐⭐ / ⭐⭐⭐
- **Consensus:** [Which AIs recommended this? "All 3" or specific ones]
- **Page:** [Specific page path to update]
- **Implementation:**
  - Step 1: [specific action]
  - Step 2: [specific action]
- **Expected outcome:** [What will this achieve?]

(Continue for all 10 actions)

---

## PAGE-BY-PAGE EDIT GUIDE

For the most important pages needing updates, provide copy-paste ready suggestions:

### /products/glean
**Meta Title:** [exact new title]
**Meta Description:** [exact new description]
**H1 Change:** [current → suggested]
**Add to page:** [specific paragraph or bullet points]

### /small-business-ai
(Same format)

### [Other key pages]
(Same format)

---

## CONTENT CREATION PRIORITIES

New pages or blog posts to create, ranked by impact:

1. **[Page/Post Title]** - Effort: [🟢/🟡/🔴]
   - Target question: [which missed question this addresses]
   - Suggested URL: [path]
   - Key sections to include: [outline]

---

## KEYWORD INTEGRATION MAP

| Keyword/Phrase | Best Page | Where to Add | Priority |
|----------------|-----------|--------------|----------|
| [keyword 1] | [path] | [section] | 🔴 High |
| [keyword 2] | [path] | [section] | 🟡 Medium |
| [keyword 3] | [path] | [section] | 🟢 Low |

(Include top 10 keyword gaps)

---

## KEY TAKEAWAYS

- [Critical finding 1]
- [Critical finding 2]
- [Critical finding 3]
- [Critical finding 4]
- [Critical finding 5]

---

RULES:
- Prioritize CONSENSUS recommendations (where 2+ AIs agreed)
- Include SPECIFIC page paths and copy suggestions
- Keep Glean enterprise separate from small business recommendations
- Focus on high-impact, low-effort actions first
- Every recommendation must be immediately actionable
- IMPORTANT: Use markdown syntax for lists (use "-" not "•" for bullet points)`

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: 'You are an expert AI Search Optimization strategist creating implementation-ready action plans. Be extremely specific with page paths, copy suggestions, and step-by-step instructions. Every recommendation must be immediately actionable.',
      messages: [{ role: 'user', content: synthesisPrompt }]
    })
    return {
      content: message.content[0]?.type === 'text' ? message.content[0].text : 'No response',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model: 'claude-sonnet-4-20250514'
      }
    }
  } catch (error) {
    console.error('Synthesis error:', error)
    return { content: `Error synthesizing: ${error}`, usage: null }
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // Check if force refresh is requested
    const body = await request.json().catch(() => ({}))
    const forceRefresh = body.force === true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the latest run with responses
    const { data: latestRun, error: runError } = await supabase
      .from('ai_monitor_runs')
      .select('id, started_at')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (runError || !latestRun) {
      return NextResponse.json({ error: 'No completed runs found' }, { status: 400 })
    }

    // Check if we have a cached analysis for this run in the new analyses table
    if (!forceRefresh) {
      const { data: existingAnalysis } = await supabase
        .from('ai_monitor_analyses')
        .select('*')
        .eq('run_id', latestRun.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingAnalysis) {
        return NextResponse.json({
          chatgptInsights: existingAnalysis.chatgpt_insights,
          claudeInsights: existingAnalysis.claude_insights,
          geminiInsights: existingAnalysis.gemini_insights,
          synthesizedRecommendations: existingAnalysis.synthesized_recommendations,
          cached: true,
          analysisId: existingAnalysis.id,
          runId: latestRun.id,
          runDate: latestRun.started_at
        })
      }
    }

    // Get responses for this run with question AND group info
    const { data: responses, error: responsesError } = await supabase
      .from('ai_monitor_responses')
      .select(`
        *,
        question:ai_monitor_questions(
          question,
          group:ai_monitor_question_groups(id, name, description)
        )
      `)
      .eq('run_id', latestRun.id)

    if (responsesError || !responses) {
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
    }

    // Calculate stats
    const platformStats: Record<string, { mentioned: number; total: number }> = {}
    const competitorCounts: Record<string, number> = {}
    const groupDataMap: Record<string, QuestionGroupData> = {}

    responses.forEach((r: {
      platform: string
      journ3y_mentioned: boolean
      competitors_mentioned: { name: string }[] | null
      question: {
        question: string
        group: { id: string; name: string; description: string | null } | null
      } | null
    }) => {
      // Platform stats
      if (!platformStats[r.platform]) {
        platformStats[r.platform] = { mentioned: 0, total: 0 }
      }
      platformStats[r.platform].total++
      if (r.journ3y_mentioned) {
        platformStats[r.platform].mentioned++
      }

      // Competitor counts
      if (r.competitors_mentioned) {
        r.competitors_mentioned.forEach((c: { name: string }) => {
          competitorCounts[c.name] = (competitorCounts[c.name] || 0) + 1
        })
      }

      // Group-level data
      const groupId = r.question?.group?.id || 'unknown'
      const groupName = r.question?.group?.name || 'Ungrouped'
      const groupDescription = r.question?.group?.description || null

      if (!groupDataMap[groupId]) {
        groupDataMap[groupId] = {
          groupName,
          groupDescription,
          mentioned: 0,
          total: 0,
          missedQuestions: [],
          mentionedQuestions: []
        }
      }

      groupDataMap[groupId].total++

      if (r.journ3y_mentioned) {
        groupDataMap[groupId].mentioned++
        groupDataMap[groupId].mentionedQuestions.push({
          question: r.question?.question || 'Unknown',
          platform: r.platform
        })
      } else {
        const competitors = (r.competitors_mentioned || []).map(c => c.name)
        groupDataMap[groupId].missedQuestions.push({
          question: r.question?.question || 'Unknown',
          platform: r.platform,
          competitorsMentioned: competitors
        })
      }
    })

    const topCompetitors = Object.entries(competitorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const questionGroups = Object.values(groupDataMap)
    const totalMentioned = Object.values(platformStats).reduce((sum, p) => sum + p.mentioned, 0)
    const totalResponses = Object.values(platformStats).reduce((sum, p) => sum + p.total, 0)
    const mentionRate = totalResponses > 0 ? (totalMentioned / totalResponses) * 100 : 0

    // Fetch site pages for context (if available)
    let sitePages: SitePageData[] = []
    try {
      const { data: pages } = await supabase
        .from('site_pages')
        .select('path, title, description, h1, page_type, schema_types, word_count, headings, detected_sections, key_phrases')
        .eq('crawl_status', 'success')
        .order('path')

      if (pages) {
        sitePages = pages
      }
    } catch (e) {
      console.log('Site pages not available:', e)
    }

    // Build the analysis prompt
    const analysisPrompt = buildAnalysisPrompt({
      totalQuestions: totalResponses,
      mentionRate,
      platformStats,
      topCompetitors,
      questionGroups,
      sitePages
    })

    // Get insights from all three AIs in parallel
    const [chatgptResult, claudeResult, geminiResult] = await Promise.all([
      getOpenAIInsights(analysisPrompt),
      getClaudeInsights(analysisPrompt),
      getGeminiInsights(analysisPrompt)
    ])

    // Collect cost records
    const costRecords: CostRecord[] = []
    if (chatgptResult.usage) {
      costRecords.push(createCostRecord('chatgpt_analysis', chatgptResult.usage))
    }
    if (claudeResult.usage) {
      costRecords.push(createCostRecord('claude_analysis', claudeResult.usage))
    }
    if (geminiResult.usage) {
      costRecords.push(createCostRecord('gemini_analysis', geminiResult.usage))
    }

    // Synthesize with Claude
    const synthesisResult = await synthesizeWithClaude(
      chatgptResult.content,
      claudeResult.content,
      geminiResult.content
    )
    if (synthesisResult.usage) {
      costRecords.push(createCostRecord('synthesis', synthesisResult.usage))
    }

    const result: AnalysisResult = {
      chatgptInsights: chatgptResult.content,
      claudeInsights: claudeResult.content,
      geminiInsights: geminiResult.content,
      synthesizedRecommendations: synthesisResult.content
    }

    const processingTimeMs = Date.now() - startTime

    // Build stats snapshot for trend tracking
    const statsSnapshot = {
      mentionRate,
      totalQuestions: totalResponses,
      platformStats: {
        chatgpt: platformStats.chatgpt || { mentioned: 0, total: 0 },
        claude: platformStats.claude || { mentioned: 0, total: 0 },
        gemini: platformStats.gemini || { mentioned: 0, total: 0 }
      },
      topCompetitors
    }

    // Generate a brief summary from the synthesized recommendations
    const summaryMatch = synthesisResult.content.match(/## KEY TAKEAWAYS\n([\s\S]*?)(?:\n---|\n##|$)/)
    const summary = summaryMatch
      ? summaryMatch[1].trim().substring(0, 500)
      : `Analysis of ${totalResponses} responses with ${mentionRate.toFixed(1)}% mention rate`

    // Calculate total cost so far
    const totalCostCents = sumCosts(costRecords)

    // Save analysis to the new analyses table
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_monitor_analyses')
      .insert({
        run_id: latestRun.id,
        chatgpt_insights: chatgptResult.content,
        claude_insights: claudeResult.content,
        gemini_insights: geminiResult.content,
        synthesized_recommendations: synthesisResult.content,
        summary,
        stats_snapshot: statsSnapshot,
        was_forced_refresh: forceRefresh,
        processing_time_ms: processingTimeMs,
        total_cost_cents: totalCostCents
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('Error saving analysis:', saveError)
    }

    // Save individual cost records
    if (savedAnalysis?.id && costRecords.length > 0) {
      const costInserts = costRecords.map(c => ({
        analysis_id: savedAnalysis.id,
        step: c.step,
        model: c.model,
        input_tokens: c.inputTokens,
        output_tokens: c.outputTokens,
        cost_cents: c.costCents
      }))

      const { error: costSaveError } = await supabase
        .from('ai_monitor_api_costs')
        .insert(costInserts)

      if (costSaveError) {
        console.error('Error saving cost records:', costSaveError)
      }
    }

    // Generate PRD tasks from the synthesized recommendations
    if (savedAnalysis?.id) {
      console.log('Starting PRD generation for analysis:', savedAnalysis.id)
      try {
        // Pass site pages to PRD generator so it knows current state
        const sitePagesForPRD = sitePages.map(p => ({
          path: p.path,
          title: p.title,
          description: p.description,
          h1: p.h1,
          schema_types: p.schema_types,
          headings: p.headings,
          detected_sections: p.detected_sections,
          key_phrases: p.key_phrases
        }))
        const prdResult = await generatePRDWithClaude(synthesisResult.content, sitePagesForPRD)
        console.log('PRD generation completed, tasks:', {
          quickWins: prdResult.prdOutput.quickWins?.length || 0,
          strategic: prdResult.prdOutput.strategic?.length || 0,
          backlog: prdResult.prdOutput.backlog?.length || 0
        })

        // Add PRD cost if available
        if (prdResult.usage) {
          const prdCostRecord = createCostRecord('prd_generation', prdResult.usage)
          costRecords.push(prdCostRecord)

          // Save PRD cost record
          await supabase
            .from('ai_monitor_api_costs')
            .insert({
              analysis_id: savedAnalysis.id,
              step: prdCostRecord.step,
              model: prdCostRecord.model,
              input_tokens: prdCostRecord.inputTokens,
              output_tokens: prdCostRecord.outputTokens,
              cost_cents: prdCostRecord.costCents
            })

          // Update total cost
          const newTotalCost = sumCosts(costRecords)
          await supabase
            .from('ai_monitor_analyses')
            .update({ total_cost_cents: newTotalCost })
            .eq('id', savedAnalysis.id)
        }

        const prdOutputWithMeta = {
          ...prdResult.prdOutput,
          generatedAt: new Date().toISOString()
        }

        // Save PRD to the analysis record
        const { error: prdSaveError } = await supabase
          .from('ai_monitor_analyses')
          .update({ prd_output: prdOutputWithMeta })
          .eq('id', savedAnalysis.id)

        if (prdSaveError) {
          console.error('Error saving PRD output:', prdSaveError)
        } else {
          console.log('PRD saved successfully')
        }
      } catch (prdError) {
        console.error('Error generating PRD:', prdError)
        // Don't fail the whole analysis if PRD generation fails
      }
    } else {
      console.log('No saved analysis ID, skipping PRD generation')
    }

    return NextResponse.json({
      ...result,
      cached: false,
      analysisId: savedAnalysis?.id,
      runId: latestRun.id,
      runDate: latestRun.started_at,
      totalCostCents: sumCosts(costRecords)
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
