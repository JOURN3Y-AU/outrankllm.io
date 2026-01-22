import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import {
  generateBrandAwarenessQueries,
  runBrandAwarenessQueriesForPlatform,
  generateCompetitiveSummary,
  type BrandAwarenessResult,
  type BrandAwarenessQuery,
  type Platform,
} from "@/lib/ai/brand-awareness"
import {
  generateActionPlan,
  type ActionPlanInput,
  type CrawledPage,
  type LLMResponseData,
  type BrandAwarenessData,
  type CompetitiveSummaryData,
  type PlatformDataInput,
} from "@/lib/ai/generate-actions"
import {
  generatePrd,
  type ActionPlanContext,
  type SiteContext,
} from "@/lib/ai/generate-prd"
import { getUserTier, getFeatureFlags } from "@/lib/features/flags"
import { log } from "@/lib/logger"

/**
 * Enrich Subscriber Report
 *
 * Runs premium features (brand awareness, action plans) on an existing scan.
 * Triggered when:
 * 1. User completes subscription checkout (enrich their existing free report)
 * 2. Called as part of weekly subscriber scans
 *
 * This is separate from the main scan pipeline to:
 * - Keep free scans fast
 * - Avoid wasting API calls on free users who can't see the results
 */
export const enrichSubscriber = inngest.createFunction(
  {
    id: "enrich-subscriber",
    retries: 3,
    // Increase total function timeout for LLM-heavy steps
    // Action plans and PRD use extended thinking which can be slow
    timeouts: {
      finish: "15m",
    },
    // Cancel any existing enrichment for the same scan
    cancelOn: [
      {
        event: "subscriber/enrich",
        match: "data.scanRunId",
      },
    ],
  },
  { event: "subscriber/enrich" },
  async ({ event, step }) => {
    const { leadId, scanRunId, domainSubscriptionId } = event.data
    const startTime = Date.now()

    log.info(scanRunId, `Starting enrichment for lead ${leadId}${domainSubscriptionId ? ` (domain_subscription: ${domainSubscriptionId})` : ''}`)

    // Step 1: Mark enrichment as processing and get scan data
    const scanData = await step.run("setup-enrichment", async () => {
      const supabase = createServiceClient()

      // Mark enrichment as processing
      await supabase
        .from("scan_runs")
        .update({
          enrichment_status: "processing",
          enrichment_started_at: new Date().toISOString(),
        })
        .eq("id", scanRunId)

      // CRITICAL: Resolve domain from the correct source for multi-domain support
      // Priority: 1) domain_subscription 2) scan_run 3) lead.domain (legacy fallback)
      let resolvedDomain: string | null = null

      // Try 1: Get from domain_subscription (most accurate for multi-domain)
      if (domainSubscriptionId) {
        const { data: domainSub } = await supabase
          .from("domain_subscriptions")
          .select("domain")
          .eq("id", domainSubscriptionId)
          .single()
        if (domainSub) {
          resolvedDomain = domainSub.domain
          log.info(scanRunId, `Resolved domain from subscription: ${resolvedDomain}`)
        }
      }

      // Try 2: Get from scan_run (for scans that have domain column)
      if (!resolvedDomain) {
        const { data: scanRun } = await supabase
          .from("scan_runs")
          .select("domain")
          .eq("id", scanRunId)
          .single()
        if (scanRun?.domain) {
          resolvedDomain = scanRun.domain
          log.info(scanRunId, `Resolved domain from scan_run: ${resolvedDomain}`)
        }
      }

      // Try 3: Legacy fallback to lead.domain (for old single-domain data)
      if (!resolvedDomain) {
        const { data: leadWithDomain } = await supabase
          .from("leads")
          .select("domain")
          .eq("id", leadId)
          .single()
        if (leadWithDomain?.domain) {
          resolvedDomain = leadWithDomain.domain
          log.warn(scanRunId, `Fallback to lead.domain: ${resolvedDomain} (legacy)`)
        }
      }

      if (!resolvedDomain) {
        throw new Error(`Could not resolve domain for scan: ${scanRunId}`)
      }

      // Get site analysis for this scan
      // Note: This data is created by process-scan step 3 (analyze-content)
      // Use .limit(1) instead of .single() to handle cases where retries created duplicates
      // Order by created_at desc to get the most recent one
      const { data: analysisRows } = await supabase
        .from("site_analyses")
        .select("*")
        .eq("run_id", scanRunId)
        .order("created_at", { ascending: false })
        .limit(1)

      const analysis = analysisRows?.[0] || null

      if (!analysis) {
        // Check if the scan run even exists and what its status is
        const { data: scanRun } = await supabase
          .from("scan_runs")
          .select("status, progress")
          .eq("id", scanRunId)
          .single()

        if (!scanRun) {
          throw new Error(`Scan run not found: ${scanRunId}`)
        }

        throw new Error(`Site analysis not found for scan: ${scanRunId} (scan status: ${scanRun.status}, progress: ${scanRun.progress}%). This may be a re-triggered event for a scan that failed before analysis completed.`)
      }

      // Get competitors to compare against
      // First try subscriber_competitors table (for tracked competitors)
      let competitorsQuery = supabase
        .from("subscriber_competitors")
        .select("name")

      if (domainSubscriptionId) {
        competitorsQuery = competitorsQuery.eq("domain_subscription_id", domainSubscriptionId)
      } else {
        competitorsQuery = competitorsQuery.eq("lead_id", leadId)
      }

      const { data: subscriberCompetitors } = await competitorsQuery
        .eq("is_active", true)
        .limit(5)

      let competitors: string[] = []

      if (subscriberCompetitors && subscriberCompetitors.length > 0) {
        // Use subscriber's tracked competitors
        competitors = subscriberCompetitors.map((c: { name: string }) => c.name)
        log.info(scanRunId, `Using ${competitors.length} tracked competitors: ${competitors.join(', ')}`)
      } else {
        // Fallback to top competitors from report (for new subscribers)
        // Use top 3 competitors for comprehensive analysis
        const { data: report } = await supabase
          .from("reports")
          .select("top_competitors")
          .eq("run_id", scanRunId)
          .single()

        if (report?.top_competitors && report.top_competitors.length > 0) {
          // Take top 3 competitors (or fewer if not available)
          const topThree = report.top_competitors.slice(0, 3)
          competitors = topThree.map((c: { name: string }) => c.name)
          log.info(scanRunId, `Using ${competitors.length} fallback competitors: ${competitors.join(', ')}`)

          // PERSIST these detected competitors to subscriber_competitors table
          // This ensures consistency across future scans - the same competitors will be used
          // unless the user manually changes them
          // Use individual inserts with conflict handling since we have partial unique indexes
          let persistedCount = 0
          for (const comp of topThree) {
            const { error: insertError } = await supabase
              .from("subscriber_competitors")
              .insert({
                lead_id: leadId,
                domain_subscription_id: domainSubscriptionId || null,
                name: comp.name,
                source: 'detected',
                is_active: true,
              })

            if (insertError) {
              // Likely duplicate - that's fine, competitor already exists
              if (insertError.code !== '23505') {
                log.warn(scanRunId, `Failed to persist competitor "${comp.name}": ${insertError.message}`)
              }
            } else {
              persistedCount++
            }
          }

          if (persistedCount > 0) {
            log.info(scanRunId, `Persisted ${persistedCount} detected competitors for future scans`)
          }
        }
      }

      return {
        domain: resolvedDomain,
        analysis: {
          businessName: analysis.business_name,
          businessType: analysis.business_type,
          services: analysis.services || [],
          location: analysis.location,
          locations: analysis.locations || [],
          targetAudience: analysis.target_audience,
          keyPhrases: analysis.key_phrases || [],
          industry: analysis.industry,
          products: analysis.products || [],
        },
        competitors,
      }
    })

    // Step 2a: Generate brand awareness queries and clean up old results
    const brandQueries = await step.run("brand-awareness-setup", async () => {
      const supabase = createServiceClient()

      log.step(scanRunId, "Setting up brand awareness queries")

      // Delete any existing brand awareness results for this run (in case of re-enrichment)
      const { error: deleteError } = await supabase
        .from("brand_awareness_results")
        .delete()
        .eq("run_id", scanRunId)

      if (deleteError) {
        log.warn(scanRunId, `Failed to delete existing brand awareness results: ${deleteError.message}`)
      }

      // Generate queries based on analysis
      // Pass competitors array for batch comparison (or empty array if none)
      const queries = generateBrandAwarenessQueries(
        scanData.analysis,
        scanData.domain,
        scanData.competitors.length > 0 ? scanData.competitors : undefined
      )

      log.info(scanRunId, `Generated ${queries.length} brand awareness queries`)

      return queries
    })

    // Step 2b-2e: Run brand awareness queries on each platform IN PARALLEL
    // Each platform runs as its own step with independent retry/timeout
    // This is a DAG pattern - all 4 platforms run concurrently
    const platforms: Platform[] = ["chatgpt", "claude", "gemini", "perplexity"]

    const platformResults = await Promise.all(
      platforms.map((platform) =>
        step.run(`brand-awareness-${platform}`, async () => {
          const results = await runBrandAwarenessQueriesForPlatform(
            brandQueries as BrandAwarenessQuery[],
            platform,
            scanRunId
          )
          return results
        })
      )
    )

    // Step 2f: Save all brand awareness results to database
    const brandResults = await step.run("brand-awareness-save", async () => {
      const supabase = createServiceClient()

      // Combine all platform results
      const allResults: BrandAwarenessResult[] = platformResults.flat()

      log.done(scanRunId, "Brand awareness", `${allResults.length} results`)

      // Save results to database
      const inserts = allResults.map((r) => ({
        run_id: scanRunId,
        platform: r.platform,
        query_type: r.queryType,
        tested_entity: r.testedEntity,
        tested_attribute: r.testedAttribute || null,
        entity_recognized: r.recognized,
        attribute_mentioned: r.attributeMentioned,
        response_text: r.responseText,
        confidence_score: r.confidenceScore,
        compared_to: r.comparedTo || null,
        positioning: r.positioning || null,
        response_time_ms: r.responseTimeMs,
      }))

      const { error } = await supabase.from("brand_awareness_results").insert(inserts)

      if (error) {
        log.error(scanRunId, "Failed to save brand awareness results", error.message)
        throw error
      }

      return {
        totalQueries: (brandQueries as BrandAwarenessQuery[]).length,
        totalResults: allResults.length,
        recognized: allResults.filter((r) => r.recognized).length,
        // Return raw results for competitive summary generation
        rawResults: allResults,
      }
    })

    // Step 3: Generate competitive intelligence summary (if we have competitor data)
    const competitiveSummary = await step.run("competitive-summary", async () => {
      const supabase = createServiceClient()

      // Transform raw results to BrandAwarenessResult format
      const resultsForSummary: BrandAwarenessResult[] = brandResults.rawResults.map((r) => ({
        platform: r.platform,
        queryType: r.queryType,
        query_type: r.queryType,
        testedEntity: r.testedEntity,
        tested_entity: r.testedEntity,
        testedAttribute: r.testedAttribute,
        tested_attribute: r.testedAttribute,
        recognized: r.recognized,
        entity_recognized: r.recognized,
        attributeMentioned: r.attributeMentioned,
        attribute_mentioned: r.attributeMentioned,
        responseText: r.responseText,
        response_text: r.responseText,
        confidenceScore: r.confidenceScore,
        confidence_score: r.confidenceScore,
        comparedTo: r.comparedTo,
        compared_to: r.comparedTo,
        positioning: r.positioning,
        responseTimeMs: r.responseTimeMs,
        response_time_ms: r.responseTimeMs,
      }))

      // Check if we have competitor comparison results
      const hasCompetitorData = resultsForSummary.some(r => r.queryType === 'competitor_compare')
      if (!hasCompetitorData) {
        log.info(scanRunId, "No competitor data, skipping competitive summary")
        return null
      }

      log.step(scanRunId, "Generating competitive summary with Claude")

      const summary = await generateCompetitiveSummary(
        resultsForSummary,
        scanData.analysis.businessName || scanData.domain,
        scanRunId
      )

      if (summary) {
        // Save to reports table
        const { error } = await supabase
          .from("reports")
          .update({ competitive_summary: summary })
          .eq("run_id", scanRunId)

        if (error) {
          log.warn(scanRunId, `Failed to save competitive summary: ${error.message}`)
        } else {
          log.done(scanRunId, "Competitive summary", `${summary.strengths.length} strengths, ${summary.weaknesses.length} weaknesses`)
        }
      }

      return summary
    })

    // Step 4: Generate AI-powered action plans
    const actionPlanResult = await step.run("generate-action-plan", async () => {
      const supabase = createServiceClient()

      log.step(scanRunId, "Generating AI-powered action plan")

      try {
        // Gather all input data for comprehensive action plan generation

        // Get crawled pages for page-specific recommendations
        const { data: crawledPagesData } = await supabase
          .from("crawled_pages")
          .select("*")
          .eq("run_id", scanRunId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawledPages: CrawledPage[] = (crawledPagesData || []).map((p: any) => ({
          path: p.path,
          url: p.url,
          title: p.title,
          metaDescription: p.meta_description,
          h1: p.h1,
          headings: p.headings || [],
          wordCount: p.word_count || 0,
          hasMetaDescription: p.has_meta_description || false,
          schemaTypes: p.schema_types || [],
          schemaData: p.schema_data || [],
        }))

        // Get LLM responses for visibility analysis
        const { data: responsesData } = await supabase
          .from("llm_responses")
          .select("platform, response_text, domain_mentioned, competitors_mentioned, prompt:scan_prompts(prompt_text)")
          .eq("run_id", scanRunId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responses: LLMResponseData[] = (responsesData || []).map((r: any) => ({
          platform: r.platform,
          promptText: (r.prompt as { prompt_text?: string } | null)?.prompt_text || "",
          responseText: r.response_text || "",
          domainMentioned: r.domain_mentioned || false,
          competitorsMentioned: r.competitors_mentioned || [],
        }))

        // Get report for scores
        const { data: report } = await supabase
          .from("reports")
          .select("visibility_score, platform_scores")
          .eq("run_id", scanRunId)
          .single()

        // Get site analysis for technical data and platform detection
        const { data: analysis } = await supabase
          .from("site_analyses")
          .select(`
            has_sitemap, has_robots_txt, schema_types, has_meta_descriptions, pages_crawled,
            detected_cms, detected_cms_confidence, detected_framework, detected_css_framework,
            detected_ecommerce, detected_hosting, detected_analytics, detected_lead_capture,
            has_blog, has_case_studies, has_resources, has_faq, has_about_page, has_team_page,
            has_testimonials, is_ecommerce, has_ai_readability_issues, ai_readability_issues,
            renders_client_side, likely_ai_generated, ai_generated_signals
          `)
          .eq("run_id", scanRunId)
          .single()

        // Transform brand awareness results
        const brandAwarenessInput: BrandAwarenessData[] = brandResults.rawResults.map((r) => ({
          platform: r.platform,
          queryType: r.queryType,
          entityRecognized: r.recognized,
          attributeMentioned: r.attributeMentioned,
          testedAttribute: r.testedAttribute || null,
          positioning: r.positioning,
          comparedTo: r.comparedTo,
        }))

        // Get previously completed action titles to pass to Claude
        // This tells Claude not to suggest similar actions again
        // Include BOTH: matching domain_subscription_id AND legacy NULL records for this lead
        // This ensures we don't regenerate tasks that were completed before multi-domain migration
        let previouslyCompleted: { title: string }[] | null = null

        if (domainSubscriptionId) {
          const { data } = await supabase
            .from("action_items_history")
            .select("title")
            .eq("lead_id", leadId)
            .or(`domain_subscription_id.eq.${domainSubscriptionId},domain_subscription_id.is.null`)
          previouslyCompleted = data
        } else {
          const { data } = await supabase
            .from("action_items_history")
            .select("title")
            .eq("lead_id", leadId)
          previouslyCompleted = data
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedActionTitles = (previouslyCompleted || []).map((h: any) => h.title as string)

        if (completedActionTitles.length > 0) {
          log.info(scanRunId, `Found ${completedActionTitles.length} previously completed actions to exclude from generation`)
        }

        // Build platform data from site_analyses
        const platformData: PlatformDataInput | null = analysis?.detected_cms !== undefined ? {
          cms: analysis.detected_cms,
          cmsConfidence: analysis.detected_cms_confidence as 'high' | 'medium' | 'low' | null,
          framework: analysis.detected_framework || null,
          cssFramework: analysis.detected_css_framework || null,
          ecommerce: analysis.detected_ecommerce || null,
          hosting: analysis.detected_hosting || null,
          analytics: analysis.detected_analytics || [],
          leadCapture: analysis.detected_lead_capture || [],
          contentSections: {
            hasBlog: analysis.has_blog || false,
            hasCaseStudies: analysis.has_case_studies || false,
            hasResources: analysis.has_resources || false,
            hasFaq: analysis.has_faq || false,
            hasAboutPage: analysis.has_about_page || false,
            hasTeamPage: analysis.has_team_page || false,
            hasTestimonials: analysis.has_testimonials || false,
          },
          isEcommerce: analysis.is_ecommerce || false,
          hasAiReadabilityIssues: analysis.has_ai_readability_issues || false,
          aiReadabilityIssues: analysis.ai_readability_issues || [],
          rendersClientSide: analysis.renders_client_side || false,
          likelyAiGenerated: analysis.likely_ai_generated || false,
          aiSignals: analysis.ai_generated_signals || [],
        } : null

        // Build action plan input
        const actionPlanInput: ActionPlanInput = {
          analysis: {
            businessName: scanData.analysis.businessName,
            businessType: scanData.analysis.businessType,
            services: scanData.analysis.services,
            location: scanData.analysis.location,
            locations: scanData.analysis.locations,
            keyPhrases: scanData.analysis.keyPhrases,
            industry: scanData.analysis.industry,
          },
          crawledPages,
          crawlData: {
            hasSitemap: analysis?.has_sitemap || false,
            hasRobotsTxt: analysis?.has_robots_txt || false,
            schemaTypes: analysis?.schema_types || [],
            hasMetaDescriptions: analysis?.has_meta_descriptions || false,
            pagesCrawled: analysis?.pages_crawled || 0,
          },
          responses,
          brandAwareness: brandAwarenessInput,
          competitiveSummary: competitiveSummary as CompetitiveSummaryData | null,
          scores: {
            overall: report?.visibility_score || 0,
            byPlatform: buildPlatformScores(report?.platform_scores, responses),
          },
          domain: scanData.domain,
          platformData, // Platform/technology detection data
          completedActionTitles, // Pass to Claude to avoid re-suggesting
        }

        // Generate the action plan
        const generatedPlan = await generateActionPlan(actionPlanInput, scanRunId)

        // Archive any existing completed/dismissed actions before saving new ones
        // First get the existing plan for this domain subscription or lead
        let existingPlanQuery = supabase
          .from("action_plans")
          .select("id")

        if (domainSubscriptionId) {
          existingPlanQuery = existingPlanQuery.eq("domain_subscription_id", domainSubscriptionId)
        } else {
          existingPlanQuery = existingPlanQuery.eq("lead_id", leadId)
        }

        const { data: existingPlan } = await existingPlanQuery.single()

        let existingActions: { id: string; title: string; description: string; category: string | null; status: string }[] | null = null
        if (existingPlan) {
          const { data } = await supabase
            .from("action_items")
            .select("id, title, description, category, status")
            .eq("plan_id", existingPlan.id)
            .in("status", ["completed", "dismissed"])
          existingActions = data
        }

        if (existingActions && existingActions.length > 0) {
          // Move completed actions to history
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const historyInserts = existingActions.map((a: any) => ({
            lead_id: leadId,
            domain_subscription_id: domainSubscriptionId || null,
            original_action_id: a.id,
            title: a.title,
            description: a.description,
            category: a.category,
            scan_run_id: scanRunId,
          }))

          await supabase.from("action_items_history").insert(historyInserts)
          log.info(scanRunId, `Archived ${historyInserts.length} completed actions to history`)
        }

        // Delete existing action plan for this domain subscription or lead (will recreate fresh)
        let deletePlanQuery = supabase.from("action_plans").delete()
        if (domainSubscriptionId) {
          deletePlanQuery = deletePlanQuery.eq("domain_subscription_id", domainSubscriptionId)
        } else {
          deletePlanQuery = deletePlanQuery.eq("lead_id", leadId)
        }
        await deletePlanQuery

        // Create new action plan
        const { data: planData, error: planError } = await supabase
          .from("action_plans")
          .insert({
            lead_id: leadId,
            domain_subscription_id: domainSubscriptionId || null,
            run_id: scanRunId,
            executive_summary: generatedPlan.executiveSummary,
            page_edits: generatedPlan.pageEdits,
            content_priorities: generatedPlan.contentPriorities,
            keyword_map: generatedPlan.keywordMap,
            key_takeaways: generatedPlan.keyTakeaways,
            quick_wins_count: generatedPlan.priorityActions.filter((a) => a.effort === "low" && a.impact >= 2).length,
            strategic_count: generatedPlan.priorityActions.filter((a) => a.effort === "medium").length,
            backlog_count: generatedPlan.priorityActions.filter((a) => a.effort === "high").length,
          })
          .select("id")
          .single()

        if (planError) {
          throw new Error(`Failed to create action plan: ${planError.message}`)
        }

        // Safety net: Also filter at insert time in case Claude still generates similar actions
        // We already passed completedActionTitles to Claude, but this ensures no duplicates
        const completedTitlesNormalized = new Set(completedActionTitles.map((t: string) => normalizeTitle(t)))

        // Insert action items (skip if similar action was previously completed)
        const actionInserts = generatedPlan.priorityActions
          .filter((action) => !completedTitlesNormalized.has(normalizeTitle(action.title)))
          .map((action, index) => ({
            plan_id: planData.id,
            title: action.title,
            description: action.description,
            rationale: action.rationale,
            source_insight: action.sourceInsight,
            priority: action.effort === "low" && action.impact >= 2 ? "quick_win" : action.effort === "high" ? "backlog" : "strategic",
            category: action.category,
            estimated_impact: action.impact === 3 ? "high" : action.impact === 2 ? "medium" : "low",
            estimated_effort: action.effort,
            target_page: action.targetPage,
            target_keywords: action.targetKeywords,
            consensus: action.consensus,
            implementation_steps: action.implementationSteps,
            expected_outcome: action.expectedOutcome,
            sort_order: index,
            status: "pending",
          }))

        if (actionInserts.length > 0) {
          const { error: itemsError } = await supabase.from("action_items").insert(actionInserts)
          if (itemsError) {
            log.warn(scanRunId, `Failed to insert action items: ${itemsError.message}`)
          }
        }

        log.done(scanRunId, "Action plan", `${actionInserts.length} actions (${generatedPlan.priorityActions.length - actionInserts.length} skipped as previously completed)`)

        return {
          success: true,
          actionsGenerated: actionInserts.length,
          actionsSkipped: generatedPlan.priorityActions.length - actionInserts.length,
        }
      } catch (error) {
        log.error(scanRunId, "Action plan generation failed", error instanceof Error ? error.message : "Unknown error")
        // Don't fail the enrichment - action plan is supplementary
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
      }
    })

    // Step 5: Generate PRD for Pro/Agency tiers (based on action plan)
    const prdResult = await step.run("generate-prd", async () => {
      const supabase = createServiceClient()

      // Check if user has PRD access (Pro or Agency tier)
      const tier = await getUserTier(leadId)
      const flags = await getFeatureFlags(tier)

      if (!flags.showPrdTasks) {
        log.info(scanRunId, `PRD generation skipped - tier ${tier} doesn't have PRD access`)
        return { skipped: true, reason: "tier_not_eligible" }
      }

      // Delete existing PRD for this run (regenerate fresh like action plans)
      // Completed tasks are preserved in prd_tasks_history and filtered during generation
      const { data: existingPrd } = await supabase
        .from("prd_documents")
        .select("id")
        .eq("run_id", scanRunId)
        .single()

      if (existingPrd) {
        log.info(scanRunId, "Deleting existing PRD to regenerate fresh")
        await supabase.from("prd_documents").delete().eq("id", existingPrd.id)
      }

      // Get action plan data for PRD generation
      const { data: actionPlan } = await supabase
        .from("action_plans")
        .select("id, executive_summary, page_edits, keyword_map")
        .eq("run_id", scanRunId)
        .single()

      if (!actionPlan) {
        log.warn(scanRunId, "No action plan found for PRD generation")
        return { skipped: true, reason: "no_action_plan" }
      }

      // Get action items
      const { data: actionItems } = await supabase
        .from("action_items")
        .select("*")
        .eq("plan_id", actionPlan.id)
        .order("sort_order", { ascending: true })

      if (!actionItems || actionItems.length === 0) {
        log.warn(scanRunId, "No action items found for PRD generation")
        return { skipped: true, reason: "no_action_items" }
      }

      // Get site analysis for context (including platform detection for PRD)
      const { data: analysis } = await supabase
        .from("site_analyses")
        .select(`
          business_name, business_type, services,
          detected_cms, detected_cms_confidence, detected_framework, detected_css_framework,
          detected_ecommerce, detected_hosting, detected_analytics, detected_lead_capture,
          has_blog, has_case_studies, has_resources, has_faq, has_about_page, has_team_page,
          has_testimonials, is_ecommerce, has_ai_readability_issues, ai_readability_issues,
          renders_client_side, likely_ai_generated, ai_generated_signals
        `)
        .eq("run_id", scanRunId)
        .single()

      // Get report for visibility score
      const { data: report } = await supabase
        .from("reports")
        .select("visibility_score")
        .eq("run_id", scanRunId)
        .single()

      try {
        log.step(scanRunId, "Generating PRD from action plan")

        // Get previously completed PRD task titles to pass to Claude
        // This tells Claude not to suggest similar tasks again
        // Include BOTH: matching domain_subscription_id AND legacy NULL records for this lead
        // This ensures we don't regenerate tasks that were completed before multi-domain migration
        let previouslyCompletedTasks: { title: string }[] | null = null

        if (domainSubscriptionId) {
          const { data } = await supabase
            .from("prd_tasks_history")
            .select("title")
            .eq("lead_id", leadId)
            .or(`domain_subscription_id.eq.${domainSubscriptionId},domain_subscription_id.is.null`)
          previouslyCompletedTasks = data
        } else {
          const { data } = await supabase
            .from("prd_tasks_history")
            .select("title")
            .eq("lead_id", leadId)
          previouslyCompletedTasks = data
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedPrdTaskTitles = (previouslyCompletedTasks || []).map((h: any) => h.title as string)

        if (completedPrdTaskTitles.length > 0) {
          log.info(scanRunId, `Found ${completedPrdTaskTitles.length} previously completed PRD tasks to exclude from generation`)
        }

        // Build action plan context for PRD generation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionPlanContext: ActionPlanContext = {
          executiveSummary: actionPlan.executive_summary,
          actions: actionItems.map((item: {
            id: string
            title: string
            description: string
            rationale: string | null
            source_insight: string | null
            priority: 'quick_win' | 'strategic' | 'backlog'
            category: string | null
            estimated_impact: string | null
            estimated_effort: string | null
            target_page: string | null
            target_keywords: string[] | null
            consensus: string[] | null
            implementation_steps: string[] | null
            expected_outcome: string | null
          }) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            rationale: item.rationale,
            sourceInsight: item.source_insight,
            priority: item.priority,
            category: item.category,
            estimatedImpact: item.estimated_impact,
            estimatedEffort: item.estimated_effort,
            targetPage: item.target_page,
            targetKeywords: item.target_keywords,
            consensus: item.consensus,
            implementationSteps: item.implementation_steps,
            expectedOutcome: item.expected_outcome,
          })),
          pageEdits: actionPlan.page_edits,
          keywordMap: actionPlan.keyword_map,
        }

        // Build platform data from site_analyses for PRD generation
        const platformData: PlatformDataInput | null = analysis?.detected_cms !== undefined ? {
          cms: analysis.detected_cms,
          cmsConfidence: analysis.detected_cms_confidence as 'high' | 'medium' | 'low' | null,
          framework: analysis.detected_framework || null,
          cssFramework: analysis.detected_css_framework || null,
          ecommerce: analysis.detected_ecommerce || null,
          hosting: analysis.detected_hosting || null,
          analytics: analysis.detected_analytics || [],
          leadCapture: analysis.detected_lead_capture || [],
          contentSections: {
            hasBlog: analysis.has_blog || false,
            hasCaseStudies: analysis.has_case_studies || false,
            hasResources: analysis.has_resources || false,
            hasFaq: analysis.has_faq || false,
            hasAboutPage: analysis.has_about_page || false,
            hasTeamPage: analysis.has_team_page || false,
            hasTestimonials: analysis.has_testimonials || false,
          },
          isEcommerce: analysis.is_ecommerce || false,
          hasAiReadabilityIssues: analysis.has_ai_readability_issues || false,
          aiReadabilityIssues: analysis.ai_readability_issues || [],
          rendersClientSide: analysis.renders_client_side || false,
          likelyAiGenerated: analysis.likely_ai_generated || false,
          aiSignals: analysis.ai_generated_signals || [],
        } : null

        // Build tech stack from platform detection or use defaults
        const techStack: string[] = []
        if (platformData?.framework) techStack.push(platformData.framework)
        if (platformData?.cms) techStack.push(platformData.cms)
        if (platformData?.cssFramework) techStack.push(platformData.cssFramework)
        if (techStack.length === 0) {
          techStack.push("Next.js", "React", "TypeScript") // Default for modern sites
        }

        const siteContext: SiteContext = {
          domain: scanData.domain,
          businessName: analysis?.business_name || null,
          businessType: analysis?.business_type || null,
          techStack,
          services: analysis?.services || null,
          platformData, // Pass platform detection data
          visibilityScore: report?.visibility_score || null, // Pass visibility score for context
        }

        // Generate PRD
        const generatedPrd = await generatePrd(actionPlanContext, siteContext, scanRunId, completedPrdTaskTitles)

        // Save PRD document
        const { data: prdDoc, error: prdError } = await supabase
          .from("prd_documents")
          .insert({
            lead_id: leadId,
            domain_subscription_id: domainSubscriptionId || null,
            run_id: scanRunId,
            title: generatedPrd.title,
            overview: generatedPrd.overview,
            goals: generatedPrd.goals,
            tech_stack: generatedPrd.techStack,
            target_platforms: generatedPrd.targetPlatforms,
          })
          .select("id")
          .single()

        if (prdError) {
          throw new Error(`Failed to create PRD document: ${prdError.message}`)
        }

        // Safety net: Filter out tasks similar to previously completed ones
        // We already passed completedPrdTaskTitles to Claude, but this ensures no duplicates
        const completedTitlesNormalized = new Set(completedPrdTaskTitles.map((t: string) => normalizeTitle(t)))

        // Filter and prepare tasks for insert
        const filteredTasks = generatedPrd.tasks.filter(
          (task) => !completedTitlesNormalized.has(normalizeTitle(task.title))
        )
        const skippedCount = generatedPrd.tasks.length - filteredTasks.length

        const tasksToInsert = filteredTasks.map((task, index) => ({
          prd_id: prdDoc.id,
          title: task.title,
          description: task.description,
          acceptance_criteria: task.acceptanceCriteria,
          section: task.section,
          category: task.category,
          priority: task.priority,
          estimated_hours: task.estimatedHours,
          file_paths: task.filePaths,
          code_snippets: task.codeSnippets,
          prompt_context: task.promptContext,
          implementation_notes: task.implementationNotes,
          requires_content: task.requiresContent,
          content_prompts: task.contentPrompts,
          sort_order: index,
        }))

        if (tasksToInsert.length > 0) {
          const { error: tasksError } = await supabase
            .from("prd_tasks")
            .insert(tasksToInsert)

          if (tasksError) {
            log.warn(scanRunId, `Failed to insert PRD tasks: ${tasksError.message}`)
          }
        }

        log.done(scanRunId, "PRD", `${tasksToInsert.length} tasks generated${skippedCount > 0 ? ` (${skippedCount} skipped as previously completed)` : ''}`)

        return {
          success: true,
          prdId: prdDoc.id,
          tasksCount: tasksToInsert.length,
          tasksSkipped: skippedCount,
        }
      } catch (error) {
        log.error(scanRunId, "PRD generation failed", error instanceof Error ? error.message : "Unknown error")
        // Don't fail enrichment - PRD is supplementary
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
      }
    })

    // Step 6: Mark enrichment as complete
    await step.run("finalize-enrichment", async () => {
      const supabase = createServiceClient()

      await supabase
        .from("scan_runs")
        .update({
          enrichment_status: "complete",
          enrichment_completed_at: new Date().toISOString(),
        })
        .eq("id", scanRunId)

      log.done(scanRunId, "Enrichment complete")
    })

    return {
      success: true,
      scanRunId,
      leadId,
      brandAwareness: {
        totalQueries: brandResults.totalQueries,
        totalResults: brandResults.totalResults,
        recognized: brandResults.recognized,
      },
      competitiveSummary: competitiveSummary || undefined,
      actionPlan: actionPlanResult,
      prd: prdResult,
      processingTimeMs: Date.now() - startTime,
    }
  }
)

// Helper: Build platform scores from report data and responses
function buildPlatformScores(
  platformScores: Record<string, number> | null,
  responses: LLMResponseData[]
): Record<string, { score: number; mentioned: number; total: number }> {
  const platforms = ["chatgpt", "claude", "gemini", "perplexity"]
  const result: Record<string, { score: number; mentioned: number; total: number }> = {}

  for (const platform of platforms) {
    const platformResponses = responses.filter((r) => r.platform === platform)
    const mentioned = platformResponses.filter((r) => r.domainMentioned).length

    result[platform] = {
      score: platformScores?.[platform] || 0,
      mentioned,
      total: platformResponses.length,
    }
  }

  return result
}

// Helper: Normalize action title for comparison
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50)
}
