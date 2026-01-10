import { inngest, type ScanProcessEvent } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import { crawlSite, combineCrawledContent } from "@/lib/ai/crawl"
import { analyzeWebsite } from "@/lib/ai/analyze"
import {
  researchQueries,
  dedupeAndRankQueries,
  generateFallbackQueries,
} from "@/lib/ai/query-research"
import {
  queryPlatformWithSearch,
  calculateSearchVisibilityScore,
  type LocationContext,
  type PlatformResult,
} from "@/lib/ai/search-providers"
import { extractTopCompetitors } from "@/lib/ai/query"
import { sendVerificationEmail, sendScanCompleteEmail } from "@/lib/email/resend"
import { detectGeography, extractTldCountry, countryToIsoCode } from "@/lib/geo/detect"
import { log } from "@/lib/logger"
import { getUserTier } from "@/lib/features/flags"
import crypto from "crypto"

// Free report expiry (days from creation)
const FREE_REPORT_EXPIRY_DAYS = parseInt(process.env.FREE_REPORT_EXPIRY_DAYS || "7", 10)

// Platform weights for scoring (from CLAUDE.md)
const PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"] as const
type Platform = (typeof PLATFORMS)[number]

export const processScan = inngest.createFunction(
  {
    id: "process-scan",
    retries: 3,
    // Cancel any existing runs for the same scan when a new one starts
    cancelOn: [
      {
        event: "scan/process",
        match: "data.scanId",
      },
    ],
  },
  { event: "scan/process" },
  async ({ event, step }) => {
    const { domain, email, leadId, verificationToken, skipEmail } = event.data
    const startTime = Date.now()

    // Step 1: Setup - create or get scan run
    const scanId = await step.run("setup-scan", async () => {
      const supabase = createServiceClient()

      if (event.data.scanId) {
        // Update existing scan status
        await supabase
          .from("scan_runs")
          .update({ status: "crawling", progress: 5, started_at: new Date().toISOString() })
          .eq("id", event.data.scanId)
        return event.data.scanId
      }

      // Create new scan run (for weekly cron scans)
      const { data, error } = await supabase
        .from("scan_runs")
        .insert({
          lead_id: leadId,
          status: "crawling",
          progress: 5,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (error) throw new Error(`Failed to create scan run: ${error.message}`)
      return data.id
    })

    log.start(scanId, domain)

    // Step 2: Crawl the site
    const crawlResult = await step.run("crawl-site", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "crawling", 10)

      log.step(scanId, "Crawling", domain)
      const result = await crawlSite(domain)
      log.done(scanId, "Crawl", `${result.totalPages} pages`)

      return result
    })

    // Step 3: Analyze content
    const analysisResult = await step.run("analyze-content", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "analyzing", 25)

      // Enhanced geo detection
      const tldCountry = extractTldCountry(domain)
      if (tldCountry) log.info(scanId, `TLD country: ${tldCountry}`)

      log.step(scanId, "Analyzing", "website content")
      const combinedContent = combineCrawledContent(crawlResult)
      const analysis = await analyzeWebsite(combinedContent, tldCountry, scanId)
      log.done(scanId, "Analysis", analysis.businessType)

      // Enhanced geo detection - combine TLD + content + AI analysis
      const geoResult = detectGeography(domain, combinedContent, analysis.location)
      log.info(scanId, `Geo: ${geoResult.location} (${geoResult.confidence})`)

      const finalLocation = geoResult.location || analysis.location
      const hasMetaDescriptions = crawlResult.pages.some((p) => p.hasMetaDescription)

      // Save site analysis
      await supabase.from("site_analyses").insert({
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
        has_sitemap: crawlResult.hasSitemap,
        has_robots_txt: crawlResult.hasRobotsTxt,
        schema_types: crawlResult.schemaTypes,
        extracted_locations: crawlResult.extractedLocations,
        extracted_services: crawlResult.extractedServices,
        extracted_products: crawlResult.extractedProducts,
        has_meta_descriptions: hasMetaDescriptions,
      })

      return {
        analysis,
        geoResult,
        finalLocation,
        combinedContent,
      }
    })

    // Step 4: Research queries
    const savedPrompts = await step.run("research-queries", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "researching", 35)

      const { analysis, geoResult, finalLocation } = analysisResult
      const analysisWithEnhancedGeo = {
        ...analysis,
        location: finalLocation,
        geoConfidence: geoResult.confidence,
        city: geoResult.city,
        country: geoResult.country,
      }

      log.step(scanId, "Getting queries", analysis.businessType)

      // Check if this lead has subscriber questions
      let prompts: { id: string; prompt_text: string; category: string }[] = []
      let usedSubscriberQuestions = false

      const userTier = await getUserTier(leadId)

      if (userTier !== "free") {
        // Check for existing subscriber questions
        const { data: subscriberQuestions } = await supabase
          .from("subscriber_questions")
          .select("id, prompt_text, category")
          .eq("lead_id", leadId)
          .eq("is_active", true)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })

        if (subscriberQuestions && subscriberQuestions.length > 0) {
          log.info(scanId, `Using ${subscriberQuestions.length} subscriber questions`)

          const { data: insertedPrompts, error } = await supabase
            .from("scan_prompts")
            .insert(
              subscriberQuestions.map((q: { id: string; prompt_text: string; category: string }) => ({
                run_id: scanId,
                prompt_text: q.prompt_text,
                category: q.category,
                source: "subscriber",
              }))
            )
            .select("id, prompt_text, category")

          if (!error && insertedPrompts && insertedPrompts.length > 0) {
            prompts = insertedPrompts
            usedSubscriberQuestions = true
          }
        }
      }

      // If no subscriber questions, research new ones
      if (!usedSubscriberQuestions) {
        const keyPhrases = analysis.keyPhrases || []

        let researchedQueryList = await researchQueries(
          analysisWithEnhancedGeo,
          scanId,
          (platform) => log.platform(scanId, platform, "researching queries"),
          keyPhrases
        )

        let topQueries = dedupeAndRankQueries(researchedQueryList, 7, keyPhrases)
        log.done(scanId, "Query research", `${topQueries.length} unique queries`)

        if (topQueries.length === 0) {
          log.warn(scanId, "Research failed, using fallback queries")
          topQueries = generateFallbackQueries(analysisWithEnhancedGeo)
        }

        // Save research results
        const researchInserts = researchedQueryList.map((q) => ({
          run_id: scanId,
          platform: q.platform,
          suggested_query: q.query,
          category: q.category,
          selected_for_scan: topQueries.some((t) => t.query === q.query),
        }))

        if (researchInserts.length > 0) {
          await supabase.from("query_research_results").insert(researchInserts)
        }

        await updateScanStatus(supabase, scanId, "generating", 45)

        // Save selected queries as prompts
        const { data: insertedPrompts } = await supabase
          .from("scan_prompts")
          .insert(
            topQueries.map((q) => ({
              run_id: scanId,
              prompt_text: q.query,
              category: q.category,
              source: "researched",
            }))
          )
          .select("id, prompt_text, category")

        if (insertedPrompts && insertedPrompts.length > 0) {
          prompts = insertedPrompts

          // Seed subscriber_questions for first-time subscribers
          if (userTier !== "free") {
            const { count } = await supabase
              .from("subscriber_questions")
              .select("id", { count: "exact", head: true })
              .eq("lead_id", leadId)

            if (!count || count === 0) {
              log.info(scanId, "Seeding subscriber questions for first-time subscriber")
              await supabase.from("subscriber_questions").insert(
                insertedPrompts.map((p: { id: string; prompt_text: string; category: string }, index: number) => ({
                  lead_id: leadId,
                  prompt_text: p.prompt_text,
                  category: p.category,
                  source: "ai_generated",
                  is_active: true,
                  is_archived: false,
                  sort_order: index,
                  original_prompt_id: p.id,
                  source_run_id: scanId,
                }))
              )
            }
          }
        }
      }

      if (!prompts || prompts.length === 0) {
        throw new Error("Failed to save prompts")
      }

      return prompts
    })

    // Build location context for LLM queries
    const locationContext: LocationContext = {
      location: analysisResult.finalLocation || undefined,
      city: analysisResult.geoResult.city || undefined,
      country: analysisResult.geoResult.country || undefined,
      countryCode: countryToIsoCode(analysisResult.geoResult.country) || undefined,
    }

    // Steps 5-8: Query each platform sequentially
    // This keeps us on Inngest free tier (5 concurrent steps)
    // Each platform query is a separate step for retry resilience

    const allPlatformResults: Array<{
      promptId: string
      results: PlatformResult[]
    }> = []

    // Initialize structure for accumulating results across platforms
    const resultsByPrompt = new Map<string, PlatformResult[]>()
    savedPrompts.forEach((p) => resultsByPrompt.set(p.id, []))

    // Step 5: Query ChatGPT
    const chatgptResults = await step.run("query-chatgpt", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "querying", 50)
      log.platform(scanId, "chatgpt", "querying")

      const results = await queryPlatformSequentially(
        "chatgpt",
        savedPrompts,
        domain,
        scanId,
        locationContext
      )

      // Save results immediately
      await saveResponsesToDb(supabase, scanId, results)
      log.done(scanId, "ChatGPT", `${results.length} responses`)

      return results
    })

    // Step 6: Query Claude
    const claudeResults = await step.run("query-claude", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "querying", 62)
      log.platform(scanId, "claude", "querying")

      const results = await queryPlatformSequentially(
        "claude",
        savedPrompts,
        domain,
        scanId,
        locationContext
      )

      await saveResponsesToDb(supabase, scanId, results)
      log.done(scanId, "Claude", `${results.length} responses`)

      return results
    })

    // Step 7: Query Gemini
    const geminiResults = await step.run("query-gemini", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "querying", 75)
      log.platform(scanId, "gemini", "querying")

      const results = await queryPlatformSequentially(
        "gemini",
        savedPrompts,
        domain,
        scanId,
        locationContext
      )

      await saveResponsesToDb(supabase, scanId, results)
      log.done(scanId, "Gemini", `${results.length} responses`)

      return results
    })

    // Step 8: Query Perplexity
    const perplexityResults = await step.run("query-perplexity", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "querying", 87)
      log.platform(scanId, "perplexity", "querying")

      const results = await queryPlatformSequentially(
        "perplexity",
        savedPrompts,
        domain,
        scanId,
        locationContext
      )

      await saveResponsesToDb(supabase, scanId, results)
      log.done(scanId, "Perplexity", `${results.length} responses`)

      return results
    })

    // Combine all results by prompt
    const allResults = [...chatgptResults, ...claudeResults, ...geminiResults, ...perplexityResults]
    for (const result of allResults) {
      const existing = resultsByPrompt.get(result.promptId) || []
      existing.push(result.result)
      resultsByPrompt.set(result.promptId, existing)
    }

    // Convert to array format expected by scoring
    for (const [promptId, results] of resultsByPrompt.entries()) {
      allPlatformResults.push({ promptId, results })
    }

    // Step 9: Finalize report
    const report = await step.run("finalize-report", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "complete", 95)

      log.step(scanId, "Calculating scores")
      const searchScores = calculateSearchVisibilityScore(allPlatformResults)

      const scores = {
        overallScore: searchScores.overall,
        platformScores: {
          chatgpt: searchScores.byPlatform.chatgpt.score,
          claude: searchScores.byPlatform.claude.score,
          gemini: searchScores.byPlatform.gemini.score,
          perplexity: searchScores.byPlatform.perplexity.score,
        },
        platformMentions: {
          chatgpt: searchScores.byPlatform.chatgpt.mentioned,
          claude: searchScores.byPlatform.claude.mentioned,
          gemini: searchScores.byPlatform.gemini.mentioned,
          perplexity: searchScores.byPlatform.perplexity.mentioned,
        },
        totalMentions: Object.values(searchScores.byPlatform).reduce((sum, p) => sum + p.mentioned, 0),
        totalQueries: Object.values(searchScores.byPlatform).reduce((sum, p) => sum + p.total, 0),
      }

      // Extract competitors
      const topCompetitors = extractTopCompetitors(
        allPlatformResults.map(({ promptId, results }) => ({
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

      // Generate summary
      const summary = generateSummary(
        analysisResult.analysis,
        scores,
        topCompetitors,
        domain
      )

      // Generate URL token
      const urlToken = crypto.randomBytes(8).toString("hex")

      // Set expiry for free reports
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + FREE_REPORT_EXPIRY_DAYS)

      // Create report
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
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
        .select("id, url_token")
        .single()

      if (reportError) {
        throw new Error(`Failed to create report: ${reportError.message}`)
      }

      // Update scan status to complete
      await supabase
        .from("scan_runs")
        .update({
          status: "complete",
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanId)

      // Record score history for subscribers
      try {
        const queryCoverage = scores.totalQueries > 0
          ? (scores.totalMentions / scores.totalQueries) * 100
          : 0

        await supabase.from("score_history").upsert(
          {
            lead_id: leadId,
            run_id: scanId,
            visibility_score: scores.overallScore,
            chatgpt_score: scores.platformScores.chatgpt,
            claude_score: scores.platformScores.claude,
            gemini_score: scores.platformScores.gemini,
            perplexity_score: scores.platformScores.perplexity,
            chatgpt_mentions: scores.platformMentions.chatgpt,
            claude_mentions: scores.platformMentions.claude,
            gemini_mentions: scores.platformMentions.gemini,
            perplexity_mentions: scores.platformMentions.perplexity,
            query_coverage: queryCoverage,
            total_queries: scores.totalQueries,
            total_mentions: scores.totalMentions,
            recorded_at: new Date().toISOString(),
          },
          { onConflict: "run_id" }
        )
      } catch (scoreError) {
        console.error("Failed to record score history:", scoreError)
      }

      return {
        urlToken: reportData.url_token,
        scores,
      }
    })

    // Step 10: Send email
    await step.run("send-email", async () => {
      if (skipEmail) {
        log.info(scanId, "Skipping email (admin rescan)")
        return { skipped: true }
      }

      const supabase = createServiceClient()
      log.step(scanId, "Sending email", email)

      const userTier = await getUserTier(leadId)
      const isSubscriber = userTier !== "free"

      let emailResult: { success: boolean; messageId?: string; error?: string }

      if (isSubscriber) {
        // Get previous score for comparison
        let previousScore: number | undefined
        const { data: prevScores } = await supabase
          .from("score_history")
          .select("visibility_score")
          .eq("lead_id", leadId)
          .neq("run_id", scanId)
          .order("recorded_at", { ascending: false })
          .limit(1)

        if (prevScores && prevScores.length > 0) {
          previousScore = prevScores[0].visibility_score
        }

        log.info(scanId, `Sending scan complete email (prev: ${previousScore ?? "none"})`)
        emailResult = await sendScanCompleteEmail(
          email,
          report.urlToken,
          domain,
          report.scores.overallScore,
          previousScore
        )

        if (emailResult.success) {
          await supabase.from("email_logs").insert({
            lead_id: leadId,
            run_id: scanId,
            email_type: "scan_complete",
            recipient: email,
            resend_id: emailResult.messageId,
            status: "sent",
          })
        }
      } else {
        // Free user: send verification email
        let tokenToUse = verificationToken
        if (!tokenToUse) {
          tokenToUse = crypto.randomBytes(32).toString("hex")
          const tokenExpiresAt = new Date()
          tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24)

          await supabase.from("email_verification_tokens").insert({
            lead_id: leadId,
            run_id: scanId,
            token: tokenToUse,
            email: email,
            expires_at: tokenExpiresAt.toISOString(),
          })
        }

        emailResult = await sendVerificationEmail(email, tokenToUse, domain)

        if (emailResult.success) {
          await supabase.from("email_logs").insert({
            lead_id: leadId,
            run_id: scanId,
            email_type: "verification",
            recipient: email,
            resend_id: emailResult.messageId,
            status: "sent",
          })
        }
      }

      if (!emailResult.success) {
        log.error(scanId, "Failed to send email", emailResult.error)
      } else {
        log.done(scanId, "Email sent")
      }

      return emailResult
    })

    log.end(scanId, true)

    return {
      success: true,
      scanId,
      reportToken: report.urlToken,
      processingTimeMs: Date.now() - startTime,
    }
  }
)

// Helper: Update scan status in DB
async function updateScanStatus(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  status: string,
  progress: number
) {
  await supabase
    .from("scan_runs")
    .update({ status, progress })
    .eq("id", scanId)
}

// Helper: Query a single platform for all prompts
async function queryPlatformSequentially(
  platform: Platform,
  prompts: { id: string; prompt_text: string; category: string }[],
  domain: string,
  scanId: string,
  locationContext: LocationContext
): Promise<Array<{ promptId: string; result: PlatformResult }>> {
  const results: Array<{ promptId: string; result: PlatformResult }> = []

  for (const prompt of prompts) {
    try {
      const result = await queryPlatformWithSearch(
        platform,
        prompt.prompt_text,
        domain,
        locationContext
      )
      results.push({ promptId: prompt.id, result })
    } catch (error) {
      // Create error result
      results.push({
        promptId: prompt.id,
        result: {
          platform,
          query: prompt.prompt_text,
          response: "",
          domainMentioned: false,
          mentionPosition: null,
          competitorsMentioned: [],
          responseTimeMs: 0,
          error: error instanceof Error ? error.message : "Unknown error",
          searchEnabled: true,
          sources: [],
        },
      })
    }
  }

  return results
}

// Helper: Save LLM responses to database
async function saveResponsesToDb(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  results: Array<{ promptId: string; result: PlatformResult }>
) {
  const inserts = results.map(({ promptId, result }) => ({
    run_id: scanId,
    prompt_id: promptId,
    platform: result.platform,
    response_text: result.response,
    domain_mentioned: result.domainMentioned,
    mention_position: result.mentionPosition,
    competitors_mentioned: result.competitorsMentioned,
    response_time_ms: result.responseTimeMs,
    error_message: result.error,
    search_enabled: result.searchEnabled,
    sources: result.sources,
  }))

  const { error } = await supabase.from("llm_responses").insert(inserts)
  if (error) {
    console.error("Failed to insert LLM responses:", error)
  }
}

// Helper: Generate summary text
function generateSummary(
  analysis: { businessType: string; businessName: string | null },
  scores: {
    overallScore: number
    platformScores: Record<string, number>
    totalMentions: number
    totalQueries: number
  },
  topCompetitors: { name: string; count: number }[],
  domain: string
): string {
  const businessName = analysis.businessName || domain
  const scoreDescription =
    scores.overallScore >= 70
      ? "strong"
      : scores.overallScore >= 40
        ? "moderate"
        : scores.overallScore >= 20
          ? "low"
          : "very low"

  let summary = `${businessName} has ${scoreDescription} AI visibility with an overall score of ${scores.overallScore}%. `
  summary += `The site was mentioned in ${scores.totalMentions} out of ${scores.totalQueries} AI queries across ChatGPT, Claude, and Gemini. `

  if (topCompetitors.length > 0) {
    const topThree = topCompetitors.slice(0, 3).map((c) => c.name)
    summary += `Top competitors mentioned by AI include: ${topThree.join(", ")}. `
  }

  if (scores.overallScore < 50) {
    summary += `There is significant opportunity to improve AI visibility through content optimization and structured data.`
  }

  return summary
}
