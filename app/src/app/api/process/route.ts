import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite, combineCrawledContent } from '@/lib/ai/crawl'
import { analyzeWebsite } from '@/lib/ai/analyze'
import { generatePrompts } from '@/lib/ai/prompts'
import {
  queryAllPlatformsWithPrompts,
  calculateVisibilityScore,
  extractTopCompetitors,
} from '@/lib/ai/query'
import { sendReportReadyEmail } from '@/lib/email/send'

// Allow up to 5 minutes for processing
export const maxDuration = 300

interface ProcessRequest {
  scanId: string
  domain: string
  email: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: ProcessRequest = await request.json()
    const { scanId, domain, email } = body

    if (!scanId || !domain || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Update status: crawling
    await updateScanStatus(supabase, scanId, 'crawling', 10)

    // Step 1: Crawl the site
    console.log(`[${scanId}] Starting crawl for ${domain}`)
    const crawlResult = await crawlSite(domain)
    console.log(`[${scanId}] Crawled ${crawlResult.totalPages} pages`)

    // Update status: analyzing
    await updateScanStatus(supabase, scanId, 'analyzing', 25)

    // Step 2: Analyze the crawled content
    console.log(`[${scanId}] Analyzing website content`)
    const combinedContent = combineCrawledContent(crawlResult)
    const analysis = await analyzeWebsite(combinedContent)
    console.log(`[${scanId}] Analysis complete: ${analysis.businessType}`)

    // Save site analysis
    await supabase.from('site_analyses').insert({
      run_id: scanId,
      business_type: analysis.businessType,
      business_name: analysis.businessName,
      services: analysis.services,
      location: analysis.location,
      target_audience: analysis.targetAudience,
      key_phrases: analysis.keyPhrases,
      pages_crawled: crawlResult.totalPages,
      raw_content: combinedContent.slice(0, 50000), // Limit stored content
    })

    // Update status: generating prompts
    await updateScanStatus(supabase, scanId, 'generating', 40)

    // Step 3: Generate prompts
    console.log(`[${scanId}] Generating prompts`)
    const generatedPrompts = await generatePrompts(analysis, domain)
    console.log(`[${scanId}] Generated ${generatedPrompts.length} prompts`)

    // Save prompts to database
    const { data: savedPrompts } = await supabase
      .from('scan_prompts')
      .insert(
        generatedPrompts.map((p) => ({
          run_id: scanId,
          prompt_text: p.text,
          category: p.category,
        }))
      )
      .select('id, prompt_text')

    if (!savedPrompts || savedPrompts.length === 0) {
      throw new Error('Failed to save prompts')
    }

    // Update status: querying LLMs
    await updateScanStatus(supabase, scanId, 'querying', 50)

    // Step 4: Query all LLMs
    console.log(`[${scanId}] Querying LLMs with ${savedPrompts.length} prompts`)
    const queryResults = await queryAllPlatformsWithPrompts(
      savedPrompts.map((p: { id: string; prompt_text: string }) => ({ id: p.id, text: p.prompt_text })),
      domain,
      async (completed, total) => {
        // Update progress during querying
        const progress = 50 + Math.round((completed / total) * 35)
        await updateScanStatus(supabase, scanId, 'querying', progress)
      }
    )

    // Save LLM responses
    const responseInserts = queryResults.flatMap(({ promptId, results }) =>
      results.map((r) => ({
        run_id: scanId,
        prompt_id: promptId,
        platform: r.platform,
        response_text: r.response,
        domain_mentioned: r.domainMentioned,
        mention_position: r.mentionPosition,
        competitors_mentioned: r.competitorsMentioned,
        response_time_ms: r.responseTimeMs,
        error_message: r.error,
      }))
    )

    await supabase.from('llm_responses').insert(responseInserts)

    // Step 5: Calculate scores
    console.log(`[${scanId}] Calculating visibility score`)
    const scores = calculateVisibilityScore(queryResults)
    const topCompetitors = extractTopCompetitors(queryResults)

    // Generate summary
    const summary = generateSummary(analysis, scores, topCompetitors, domain)

    // Generate URL token
    const urlToken = generateUrlToken()

    // Create report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        run_id: scanId,
        url_token: urlToken,
        visibility_score: scores.overallScore,
        platform_scores: scores.platformScores,
        top_competitors: topCompetitors,
        summary,
      })
      .select('id, url_token')
      .single()

    if (reportError) {
      throw new Error(`Failed to create report: ${reportError.message}`)
    }

    // Update scan status: complete
    await supabase
      .from('scan_runs')
      .update({
        status: 'complete',
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    // Step 6: Send email notification
    const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/report/${report.url_token}`
    console.log(`[${scanId}] Sending email to ${email}`)
    await sendReportReadyEmail(email, domain, reportUrl, scores.overallScore)

    const processingTime = Date.now() - startTime
    console.log(`[${scanId}] Processing complete in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      reportUrl,
      processingTimeMs: processingTime,
    })
  } catch (error) {
    console.error('Process error:', error)

    // Try to update scan status to failed
    try {
      const body = await request.clone().json()
      if (body.scanId) {
        const supabase = createServiceClient()
        await supabase
          .from('scan_runs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', body.scanId)
      }
    } catch {
      // Ignore error updating status
    }

    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper: Update scan status
async function updateScanStatus(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  status: string,
  progress: number
) {
  await supabase
    .from('scan_runs')
    .update({
      status,
      progress,
      started_at: status === 'crawling' ? new Date().toISOString() : undefined,
    })
    .eq('id', scanId)
}

// Helper: Generate URL token
function generateUrlToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper: Generate summary text
function generateSummary(
  analysis: { businessType: string; businessName: string | null },
  scores: { overallScore: number; platformScores: Record<string, number>; totalMentions: number; totalQueries: number },
  topCompetitors: { name: string; count: number }[],
  domain: string
): string {
  const businessName = analysis.businessName || domain
  const scoreDescription =
    scores.overallScore >= 70
      ? 'strong'
      : scores.overallScore >= 40
        ? 'moderate'
        : scores.overallScore >= 20
          ? 'low'
          : 'very low'

  let summary = `${businessName} has ${scoreDescription} AI visibility with an overall score of ${scores.overallScore}%. `
  summary += `The site was mentioned in ${scores.totalMentions} out of ${scores.totalQueries} AI queries across ChatGPT, Claude, and Gemini. `

  if (topCompetitors.length > 0) {
    const topThree = topCompetitors.slice(0, 3).map((c) => c.name)
    summary += `Top competitors mentioned by AI include: ${topThree.join(', ')}. `
  }

  if (scores.overallScore < 50) {
    summary += `There is significant opportunity to improve AI visibility through content optimization and structured data.`
  }

  return summary
}
