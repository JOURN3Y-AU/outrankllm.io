import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite, combineCrawledContent } from '@/lib/ai/crawl'
import { analyzeWebsite } from '@/lib/ai/analyze'
import {
  researchQueries,
  dedupeAndRankQueries,
  generateFallbackQueries,
} from '@/lib/ai/query-research'
import {
  queryAllPlatformsWithSearch,
  calculateSearchVisibilityScore,
  type LocationContext,
} from '@/lib/ai/search-providers'
import { extractTopCompetitors } from '@/lib/ai/query'
// Brand awareness imports - disabled for free reports, will be used in subscriber pipeline
// import {
//   generateBrandAwarenessQueries,
//   runBrandAwarenessQueries,
// } from '@/lib/ai/brand-awareness'
import { sendVerificationEmail } from '@/lib/email/resend'
import { detectGeography, extractTldCountry, countryToIsoCode } from '@/lib/geo/detect'
import { log } from '@/lib/logger'
import crypto from 'crypto'

// Allow up to ~13 minutes for processing (Vercel Pro max is 800s)
// With parallel queries, 7 queries should complete in ~2-3 minutes
// Extra buffer for brand awareness + retries
export const maxDuration = 800

// Free report expiry (days from creation) - configurable via env var
const FREE_REPORT_EXPIRY_DAYS = parseInt(process.env.FREE_REPORT_EXPIRY_DAYS || '7', 10)

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
    log.start(scanId, domain)
    log.step(scanId, 'Crawling', domain)
    const crawlResult = await crawlSite(domain)
    log.done(scanId, 'Crawl', `${crawlResult.totalPages} pages`)

    // Step 1.5: Enhanced geo detection
    const tldCountry = extractTldCountry(domain)
    if (tldCountry) log.info(scanId, `TLD country: ${tldCountry}`)

    // Update status: analyzing
    await updateScanStatus(supabase, scanId, 'analyzing', 25)

    // Step 2: Analyze the crawled content
    log.step(scanId, 'Analyzing', 'website content')
    const combinedContent = combineCrawledContent(crawlResult)
    const analysis = await analyzeWebsite(combinedContent, tldCountry, scanId)
    log.done(scanId, 'Analysis', analysis.businessType)

    // Enhanced geo detection - combine TLD + content + AI analysis
    const geoResult = detectGeography(domain, combinedContent, analysis.location)
    log.info(scanId, `Geo: ${geoResult.location} (${geoResult.confidence})`)

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

    // Update status: researching queries
    await updateScanStatus(supabase, scanId, 'researching', 35)

    // Step 3: Research what queries people actually use (NEW APPROACH)
    log.step(scanId, 'Researching queries', analysis.businessType)
    const analysisWithEnhancedGeo = {
      ...analysis,
      location: finalLocation,
      geoConfidence: geoResult.confidence,
      city: geoResult.city,
      country: geoResult.country,
    }

    // Get key phrases for query research
    const keyPhrases = analysis.keyPhrases || []

    let researchedQueryList = await researchQueries(
      analysisWithEnhancedGeo,
      scanId,
      (platform) => log.platform(scanId, platform, 'researching queries'),
      keyPhrases
    )

    // Dedupe and rank, limit to 7 for free tier
    // Pass keyPhrases to boost queries that contain relevant terms
    let topQueries = dedupeAndRankQueries(researchedQueryList, 7, keyPhrases)
    log.done(scanId, 'Query research', `${topQueries.length} unique queries`)

    // Fallback if research failed
    if (topQueries.length === 0) {
      log.warn(scanId, 'Research failed, using fallback queries')
      topQueries = generateFallbackQueries(analysisWithEnhancedGeo)
    }

    // Save researched queries to database
    const researchInserts = researchedQueryList.map((q) => ({
      run_id: scanId,
      platform: q.platform,
      suggested_query: q.query,
      category: q.category,
      selected_for_scan: topQueries.some((t) => t.query === q.query),
    }))

    if (researchInserts.length > 0) {
      const { error: researchInsertError } = await supabase.from('query_research_results').insert(researchInserts)
      if (researchInsertError) {
        log.error(scanId, `Failed to insert query research results: ${researchInsertError.message}`)
        console.error('Query research insert error:', researchInsertError)
      }
    }

    // Update status: generating prompts
    await updateScanStatus(supabase, scanId, 'generating', 45)

    // Save selected queries as prompts
    log.info(scanId, `Saving ${topQueries.length} prompts`)
    const { data: savedPrompts } = await supabase
      .from('scan_prompts')
      .insert(
        topQueries.map((q) => ({
          run_id: scanId,
          prompt_text: q.query,
          category: q.category,
          source: 'researched',
        }))
      )
      .select('id, prompt_text, category')

    if (!savedPrompts || savedPrompts.length === 0) {
      throw new Error('Failed to save prompts')
    }

    // Update status: querying LLMs with search
    await updateScanStatus(supabase, scanId, 'querying', 50)

    // Step 4: Query all LLMs WITH SEARCH ENABLED
    log.step(scanId, 'Querying LLMs', `${savedPrompts.length} prompts (search enabled)`)

    // Build location context for search providers (helps with "near me" queries)
    const locationContext: LocationContext = {
      location: finalLocation || undefined,
      city: geoResult.city || undefined,
      country: geoResult.country || undefined,
      countryCode: countryToIsoCode(geoResult.country) || undefined,
    }
    log.data(scanId, 'Location context', locationContext as Record<string, unknown>)

    const queryResults = await queryAllPlatformsWithSearch(
      savedPrompts.map((p: { id: string; prompt_text: string; category: string }) => ({
        id: p.id,
        text: p.prompt_text,
        category: p.category,
      })),
      domain,
      scanId,
      async (completed, total) => {
        const progress = 50 + Math.round((completed / total) * 35)
        await updateScanStatus(supabase, scanId, 'querying', progress)
        log.progress(scanId, completed, total, 'LLM queries')
      },
      locationContext
    )

    // Save LLM responses with search metadata
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
        search_enabled: r.searchEnabled,
        sources: r.sources,
      }))
    )

    const { error: responseInsertError } = await supabase.from('llm_responses').insert(responseInserts)
    if (responseInsertError) {
      log.error(scanId, `Failed to insert LLM responses: ${responseInsertError.message}`)
      console.error('LLM responses insert error:', responseInsertError)
    } else {
      log.step(scanId, `Saved ${responseInserts.length} LLM responses`)
    }

    // Step 5: Calculate scores (do this early to get top competitors for brand awareness)
    log.step(scanId, 'Calculating scores')
    const searchScores = calculateSearchVisibilityScore(queryResults)

    // Convert to format expected by rest of code
    const scores = {
      overallScore: searchScores.overall,
      platformScores: {
        chatgpt: searchScores.byPlatform.chatgpt.score,
        claude: searchScores.byPlatform.claude.score,
        gemini: searchScores.byPlatform.gemini.score,
        perplexity: searchScores.byPlatform.perplexity.score,
      },
      totalMentions: Object.values(searchScores.byPlatform).reduce((sum, p) => sum + p.mentioned, 0),
      totalQueries: Object.values(searchScores.byPlatform).reduce((sum, p) => sum + p.total, 0),
    }

    // Extract competitors from search results
    const topCompetitors = extractTopCompetitors(
      queryResults.map(({ promptId, results }) => ({
        promptId,
        results: results.map((r) => ({
          platform: r.platform,
          promptText: r.query,
          response: r.response,
          domainMentioned: r.domainMentioned,
          mentionPosition: r.mentionPosition,
          competitorsMentioned: r.competitorsMentioned,
          responseTimeMs: r.responseTimeMs,
          error: r.error || null,
        })),
      }))
    )

    // Step 5.5: Brand Awareness Queries
    // DISABLED for free reports - will be enabled for subscribers in a separate pipeline
    // This saves API costs since free users can't see the results anyway
    // TODO: Re-enable when subscription-specific processing is built
    /*
    await updateScanStatus(supabase, scanId, 'brand_awareness', 88)
    log.step(scanId, 'Brand awareness', 'testing recognition')

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
        log.progress(scanId, completed, total, 'brand tests')
      }
    )

    // Save brand awareness results
    if (brandResults.length > 0) {
      const { error: brandInsertError } = await supabase.from('brand_awareness_results').insert(
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
      if (brandInsertError) {
        log.error(scanId, `Failed to insert brand awareness results: ${brandInsertError.message}`)
        console.error('Brand awareness insert error:', brandInsertError)
      }
    }
    log.done(scanId, 'Brand awareness', `${brandResults.length} results`)
    */

    // Generate summary
    const summary = generateSummary(analysis, scores, topCompetitors, domain)

    // Generate URL token (use crypto for better randomness)
    const urlToken = crypto.randomBytes(8).toString('hex')

    // Set expiry date for free reports
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + FREE_REPORT_EXPIRY_DAYS)

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
        expires_at: expiresAt.toISOString(),
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
    log.step(scanId, 'Sending email', email)

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
      log.error(scanId, 'Failed to send verification email', emailResult.error)
    }

    log.done(scanId, 'Email sent')
    log.end(scanId, true)

    return NextResponse.json({
      success: true,
      reportToken: report.url_token,
      processingTimeMs: Date.now() - startTime,
    })
  } catch (error) {
    // Try to update scan status to failed
    try {
      const body = await request.clone().json()
      if (body.scanId) {
        log.error(body.scanId, 'Process failed', error)
        log.end(body.scanId, false)
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
      console.error('Process error:', error)
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
