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
import {
  generateBrandAwarenessQueries,
  runBrandAwarenessQueries,
} from '@/lib/ai/brand-awareness'
import { sendVerificationEmail } from '@/lib/email/resend'
import { detectGeography, extractTldCountry } from '@/lib/geo/detect'
import crypto from 'crypto'

// Allow up to 5 minutes for processing
export const maxDuration = 300

interface ProcessRequest {
  scanId: string
  domain: string
  email: string
  verificationToken?: string
  leadId?: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: ProcessRequest = await request.json()
    const { scanId, domain, email, verificationToken, leadId } = body

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

    // Step 1.5: Enhanced geo detection
    const tldCountry = extractTldCountry(domain)
    console.log(`[${scanId}] TLD country: ${tldCountry || 'none detected'}`)

    // Update status: analyzing
    await updateScanStatus(supabase, scanId, 'analyzing', 25)

    // Step 2: Analyze the crawled content
    console.log(`[${scanId}] Analyzing website content`)
    const combinedContent = combineCrawledContent(crawlResult)
    const analysis = await analyzeWebsite(combinedContent, tldCountry, scanId)
    console.log(`[${scanId}] Analysis complete: ${analysis.businessType}`)

    // Enhanced geo detection - combine TLD + content + AI analysis
    const geoResult = detectGeography(domain, combinedContent, analysis.location)
    console.log(`[${scanId}] Geo detection: ${geoResult.location} (${geoResult.confidence})`)

    // Use the combined geo result for location
    const finalLocation = geoResult.location || analysis.location

    // Check if any pages have meta descriptions
    const hasMetaDescriptions = crawlResult.pages.some(p => p.hasMetaDescription)

    // Save site analysis with enhanced geo fields and crawl data
    await supabase.from('site_analyses').insert({
      run_id: scanId,
      business_type: analysis.businessType,
      business_name: analysis.businessName,
      services: analysis.services,
      products: analysis.products || [],
      location: finalLocation,
      locations: analysis.locations || [],
      target_audience: analysis.targetAudience,
      key_phrases: analysis.keyPhrases,
      industry: analysis.industry,
      pages_crawled: crawlResult.totalPages,
      raw_content: combinedContent.slice(0, 50000),
      tld_country: geoResult.tldCountry,
      detected_country: geoResult.country,
      geo_confidence: geoResult.confidence,
      // New crawl data fields
      has_sitemap: crawlResult.hasSitemap,
      has_robots_txt: crawlResult.hasRobotsTxt,
      schema_types: crawlResult.schemaTypes,
      extracted_locations: crawlResult.extractedLocations,
      extracted_services: crawlResult.extractedServices,
      extracted_products: crawlResult.extractedProducts,
      has_meta_descriptions: hasMetaDescriptions,
    })

    // Update status: generating prompts
    await updateScanStatus(supabase, scanId, 'generating', 40)

    // Step 3: Generate prompts with enhanced location data
    console.log(`[${scanId}] Generating prompts`)
    const analysisWithEnhancedGeo = {
      ...analysis,
      location: finalLocation,
      geoConfidence: geoResult.confidence,
      city: geoResult.city,
      country: geoResult.country,
    }
    const generatedPrompts = await generatePrompts(analysisWithEnhancedGeo, domain, scanId)
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
        const progress = 50 + Math.round((completed / total) * 35)
        await updateScanStatus(supabase, scanId, 'querying', progress)
      },
      scanId // Pass runId for cost tracking
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

    // Step 5: Calculate scores (do this early to get top competitors for brand awareness)
    console.log(`[${scanId}] Calculating visibility score`)
    const scores = calculateVisibilityScore(queryResults)
    const topCompetitors = extractTopCompetitors(queryResults)

    // Step 5.5: Brand Awareness Queries
    await updateScanStatus(supabase, scanId, 'brand_awareness', 88)
    console.log(`[${scanId}] Running brand awareness tests`)

    const brandQueries = generateBrandAwarenessQueries(
      analysis,
      domain,
      topCompetitors[0]?.name // Compare against top competitor
    )

    const brandResults = await runBrandAwarenessQueries(
      brandQueries,
      scanId,
      async (completed, total) => {
        const progress = 88 + Math.round((completed / total) * 7) // 88-95%
        await updateScanStatus(supabase, scanId, 'brand_awareness', progress)
      }
    )

    // Save brand awareness results
    if (brandResults.length > 0) {
      await supabase.from('brand_awareness_results').insert(
        brandResults.map(r => ({
          run_id: scanId,
          platform: r.platform,
          query_type: r.queryType,
          tested_entity: r.testedEntity,
          tested_attribute: r.testedAttribute,
          entity_recognized: r.recognized,
          attribute_mentioned: r.attributeMentioned,
          response_text: r.responseText,
          confidence_score: r.confidenceScore,
          compared_to: r.comparedTo,
          positioning: r.positioning,
          response_time_ms: r.responseTimeMs,
        }))
      )
    }
    console.log(`[${scanId}] Brand awareness tests complete: ${brandResults.length} results`)

    // Generate summary
    const summary = generateSummary(analysis, scores, topCompetitors, domain)

    // Generate URL token (use crypto for better randomness)
    const urlToken = crypto.randomBytes(8).toString('hex')

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
        requires_verification: true,
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

    // Step 6: Send verification email (instead of report-ready email)
    console.log(`[${scanId}] Sending verification email to ${email}`)

    // Use provided token or generate a new one
    let tokenToUse = verificationToken
    if (!tokenToUse) {
      tokenToUse = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      // Get lead ID if not provided
      let leadIdToUse = leadId
      if (!leadIdToUse) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('email', email)
          .eq('domain', domain)
          .single()
        leadIdToUse = lead?.id
      }

      if (leadIdToUse) {
        await supabase.from('email_verification_tokens').insert({
          lead_id: leadIdToUse,
          run_id: scanId,
          token: tokenToUse,
          email: email,
          expires_at: expiresAt.toISOString()
        })
      }
    }

    const emailResult = await sendVerificationEmail(email, tokenToUse, domain)

    if (emailResult.success) {
      // Log the email
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .eq('domain', domain)
        .single()

      if (lead) {
        await supabase.from('email_logs').insert({
          lead_id: lead.id,
          run_id: scanId,
          email_type: 'verification',
          recipient: email,
          resend_id: emailResult.messageId,
          status: 'sent'
        })
      }
    } else {
      console.error(`[${scanId}] Failed to send verification email:`, emailResult.error)
    }

    const processingTime = Date.now() - startTime
    console.log(`[${scanId}] Processing complete in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      reportToken: report.url_token,
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
