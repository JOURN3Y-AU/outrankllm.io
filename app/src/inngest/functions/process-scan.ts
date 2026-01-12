import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import { crawlSite, combineCrawledContent } from "@/lib/ai/crawl"
import { analyzeWebsite } from "@/lib/ai/analyze"
import {
  researchQueriesOnPlatform,
  dedupeAndRankQueries,
  generateFallbackQueries,
  type Platform as ResearchPlatform,
  type RawQuerySuggestion,
} from "@/lib/ai/query-research"
import {
  queryPlatformWithSearch,
  calculateSearchVisibilityScore,
  type LocationContext,
  type PlatformResult,
} from "@/lib/ai/search-providers"
import { extractTopCompetitors } from "@/lib/ai/query"
// Brand awareness is now handled by enrich-subscriber function
import { sendVerificationEmail, sendScanCompleteEmail } from "@/lib/email/resend"
import { detectGeography, extractTldCountry, countryToIsoCode } from "@/lib/geo/detect"
import { log } from "@/lib/logger"
import { getUserTier } from "@/lib/features/flags"
import crypto from "crypto"

// Free report expiry (days from creation)
const FREE_REPORT_EXPIRY_DAYS = parseInt(process.env.FREE_REPORT_EXPIRY_DAYS || "7", 10)

// Platform weights for scoring (from CLAUDE.md)
const PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"] as const

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
    const { domain, email, verificationToken, skipEmail, domainSubscriptionId } = event.data
    const startTime = Date.now()

    // Step 1: Setup - resolve leadId and create or get scan run
    const { scanId, leadId } = await step.run("setup-scan", async () => {
      const supabase = createServiceClient()

      // Resolve leadId - either from event data or look up by email
      let resolvedLeadId = event.data.leadId
      if (!resolvedLeadId && email) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .ilike("email", email.toLowerCase().trim())
          .limit(1)
          .single()

        if (lead) {
          resolvedLeadId = lead.id
        }
      }

      if (!resolvedLeadId) {
        throw new Error("Could not resolve lead ID from event data or email lookup")
      }

      if (event.data.scanId) {
        // Update existing scan status (and link to domain_subscription if provided)
        const updateData: Record<string, unknown> = {
          status: "crawling",
          progress: 5,
          started_at: new Date().toISOString(),
          domain: domain,  // CRITICAL: Store domain for multi-domain isolation
        }
        if (domainSubscriptionId) {
          updateData.domain_subscription_id = domainSubscriptionId
        }
        await supabase
          .from("scan_runs")
          .update(updateData)
          .eq("id", event.data.scanId)
        return { scanId: event.data.scanId, leadId: resolvedLeadId }
      }

      // Create new scan run (for weekly cron scans or manual triggers)
      const insertData: Record<string, unknown> = {
        lead_id: resolvedLeadId,
        domain: domain,  // CRITICAL: Store domain for multi-domain isolation
        status: "crawling",
        progress: 5,
        started_at: new Date().toISOString(),
      }
      if (domainSubscriptionId) {
        insertData.domain_subscription_id = domainSubscriptionId
      }
      const { data, error } = await supabase
        .from("scan_runs")
        .insert(insertData)
        .select("id")
        .single()

      if (error) throw new Error(`Failed to create scan run: ${error.message}`)
      return { scanId: data.id, leadId: resolvedLeadId }
    })

    log.start(scanId, domain)

    // Step 2: Crawl the site
    const crawlResult = await step.run("crawl-site", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "crawling", 10)

      log.step(scanId, "Crawling", domain)
      const result = await crawlSite(domain)
      log.done(scanId, "Crawl", `${result.totalPages} pages`)

      // Save page-level crawl data for specific, actionable recommendations
      // This enables PRD-ready actions like "/services missing H1"
      if (result.pages.length > 0) {
        const crawlInserts = result.pages.map(page => ({
          run_id: scanId,
          url: page.url,
          path: page.path,
          title: page.title,
          meta_description: page.description,
          h1: page.h1,
          headings: page.headings,
          word_count: page.wordCount,
          has_meta_description: page.hasMetaDescription,
          schema_types: page.schemaData.map(s => s.type),
          schema_data: page.schemaData,
        }))

        const { error: crawlError } = await supabase.from("crawled_pages").insert(crawlInserts)
        if (crawlError) {
          log.warn(scanId, `Failed to save crawled pages: ${crawlError.message}`)
        } else {
          log.info(scanId, `Saved ${crawlInserts.length} crawled pages to DB`)
        }
      }

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

    // Step 4a: Check for existing subscriber questions (fast DB check)
    const subscriberQuestionsResult = await step.run("check-subscriber-questions", async () => {
      const supabase = createServiceClient()
      await updateScanStatus(supabase, scanId, "researching", 35)

      const userTier = await getUserTier(leadId)

      if (userTier === "free") {
        return { hasSubscriberQuestions: false, prompts: [], userTier }
      }

      // Check for existing subscriber questions
      let questionsQuery = supabase
        .from("subscriber_questions")
        .select("id, prompt_text, category")

      if (domainSubscriptionId) {
        questionsQuery = questionsQuery.eq("domain_subscription_id", domainSubscriptionId)
      } else {
        questionsQuery = questionsQuery.eq("lead_id", leadId)
      }

      const { data: subscriberQuestions } = await questionsQuery
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
          return { hasSubscriberQuestions: true, prompts: insertedPrompts, userTier }
        }
      }

      return { hasSubscriberQuestions: false, prompts: [], userTier }
    })

    // Build analysis context for research (used by multiple steps)
    const { analysis, geoResult, finalLocation } = analysisResult
    const analysisWithEnhancedGeo = {
      ...analysis,
      location: finalLocation,
      geoConfidence: geoResult.confidence,
      city: geoResult.city,
      country: geoResult.country,
    }
    const keyPhrases = analysis.keyPhrases || []

    // Steps 4b-4d: Research queries on each platform (only if no subscriber questions)
    let researchedQueryList: RawQuerySuggestion[] = []

    if (!subscriberQuestionsResult.hasSubscriberQuestions) {
      log.step(scanId, "Getting queries", analysis.businessType)

      const researchPlatforms: ResearchPlatform[] = ["chatgpt", "claude", "gemini"]

      for (const platform of researchPlatforms) {
        const platformResults = await step.run(`research-queries-${platform}`, async () => {
          log.platform(scanId, platform, "researching queries")

          const suggestions = await researchQueriesOnPlatform(
            analysisWithEnhancedGeo,
            platform,
            scanId,
            keyPhrases
          )

          log.done(scanId, `Research ${platform}`, `${suggestions.length} suggestions`)
          return suggestions
        })

        researchedQueryList.push(...platformResults)
      }
    }

    // Step 4e: Save prompts (dedupe, rank, and save to DB)
    const savedPrompts = await step.run("save-prompts", async () => {
      const supabase = createServiceClient()

      // If we already have subscriber questions, return them
      if (subscriberQuestionsResult.hasSubscriberQuestions) {
        return subscriberQuestionsResult.prompts
      }

      // Dedupe and rank researched queries
      let topQueries = dedupeAndRankQueries(researchedQueryList, 7, keyPhrases)
      log.done(scanId, "Query research", `${topQueries.length} unique queries`)

      if (topQueries.length === 0) {
        log.warn(scanId, "Research failed, using fallback queries")
        topQueries = generateFallbackQueries(analysisWithEnhancedGeo)
      }

      // Save research results
      const researchInserts = researchedQueryList.map((q: RawQuerySuggestion) => ({
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
        // Seed subscriber_questions for first-time subscribers
        if (subscriberQuestionsResult.userTier !== "free") {
          let countQuery = supabase
            .from("subscriber_questions")
            .select("id", { count: "exact", head: true })

          if (domainSubscriptionId) {
            countQuery = countQuery.eq("domain_subscription_id", domainSubscriptionId)
          } else {
            countQuery = countQuery.eq("lead_id", leadId)
          }

          const { count } = await countQuery

          if (!count || count === 0) {
            log.info(scanId, "Seeding subscriber questions for first-time subscriber")
            await supabase.from("subscriber_questions").insert(
              insertedPrompts.map((p: { id: string; prompt_text: string; category: string }, index: number) => ({
                lead_id: leadId,
                domain_subscription_id: domainSubscriptionId || null,
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

        return insertedPrompts
      }

      throw new Error("Failed to save prompts")
    })

    // Build location context for LLM queries
    const locationContext: LocationContext = {
      location: analysisResult.finalLocation || undefined,
      city: analysisResult.geoResult.city || undefined,
      country: analysisResult.geoResult.country || undefined,
      countryCode: countryToIsoCode(analysisResult.geoResult.country) || undefined,
    }

    // Query each platform with individual steps per query
    // This ensures each API call is independently retryable and stays under timeout
    // With 7 queries × 4 platforms = 28 steps, each ~30-60s max

    const allPlatformResults: Array<{
      promptId: string
      results: PlatformResult[]
    }> = []

    // Initialize structure for accumulating results across platforms
    const resultsByPrompt = new Map<string, PlatformResult[]>()
    savedPrompts.forEach((p: { id: string; prompt_text: string; category: string }) => resultsByPrompt.set(p.id, []))

    // Calculate progress increments: queries span from 50% to 90%
    // 4 platforms × N queries, spread across 40% progress
    const totalQueries = savedPrompts.length * 4
    const progressPerQuery = 40 / totalQueries
    let currentProgress = 50

    // Query each platform, one query at a time as separate steps
    for (const platform of PLATFORMS) {
      log.platform(scanId, platform, "querying")

      for (let i = 0; i < savedPrompts.length; i++) {
        const prompt = savedPrompts[i]
        const stepName = `query-${platform}-${i}`

        const result = await step.run(stepName, async () => {
          const db = createServiceClient()

          // Update progress
          currentProgress += progressPerQuery
          await updateScanStatus(db, scanId, "querying", Math.round(currentProgress))

          try {
            const queryResult = await queryPlatformWithSearch(
              platform,
              prompt.prompt_text,
              domain,
              locationContext
            )

            // Save result immediately
            await saveResponseToDb(db, scanId, prompt.id, queryResult)

            return { promptId: prompt.id, result: queryResult }
          } catch (error) {
            // Create error result
            const errorResult: PlatformResult = {
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
            }

            // Save error result
            await saveResponseToDb(db, scanId, prompt.id, errorResult)

            return { promptId: prompt.id, result: errorResult }
          }
        })

        // Accumulate result
        const existing = resultsByPrompt.get(result.promptId) || []
        existing.push(result.result)
        resultsByPrompt.set(result.promptId, existing)
      }

      log.done(scanId, platform, `${savedPrompts.length} responses`)
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
            domain_subscription_id: domainSubscriptionId || null,
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
        topCompetitors,
      }
    })

    // Step 10: Trigger subscriber enrichment (subscribers only)
    // This sends an event to the enrich-subscriber function which handles:
    // - Brand awareness queries
    // - Competitive intelligence summary
    // - AI-powered action plan generation
    const userTier = await getUserTier(leadId)
    const isSubscriberForEnrichment = userTier !== "free"

    if (isSubscriberForEnrichment) {
      await step.run("trigger-enrichment", async () => {
        const supabase = createServiceClient()

        log.step(scanId, "Triggering subscriber enrichment")

        // Mark enrichment as pending (will be updated to processing by enrich-subscriber)
        await supabase
          .from("scan_runs")
          .update({
            enrichment_status: "pending",
          })
          .eq("id", scanId)

        // Send event to trigger the enrich-subscriber function
        await inngest.send({
          name: "subscriber/enrich",
          data: {
            leadId,
            scanRunId: scanId,
            domainSubscriptionId: domainSubscriptionId || undefined,
          },
        })

        log.info(scanId, "Enrichment event sent")
        return { triggered: true }
      })
    } else {
      // Mark as not applicable for free users
      await step.run("mark-enrichment-not-applicable", async () => {
        const supabase = createServiceClient()
        await supabase
          .from("scan_runs")
          .update({ enrichment_status: "not_applicable" })
          .eq("id", scanId)
      })
    }

    // Step 11: Send email
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

// Helper: Save a single LLM response to database
async function saveResponseToDb(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  promptId: string,
  result: PlatformResult
) {
  const { error } = await supabase.from("llm_responses").insert({
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
  })

  if (error) {
    console.error("Failed to insert LLM response:", error)
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
