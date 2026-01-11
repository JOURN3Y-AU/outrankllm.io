import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import {
  generateBrandAwarenessQueries,
  runBrandAwarenessQueries,
  generateCompetitiveSummary,
  type BrandAwarenessResult,
} from "@/lib/ai/brand-awareness"
import {
  generateActionPlan,
  type ActionPlanInput,
  type CrawledPage,
  type LLMResponseData,
  type BrandAwarenessData,
  type CompetitiveSummaryData,
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
    const { leadId, scanRunId } = event.data
    const startTime = Date.now()

    log.info(scanRunId, `Starting enrichment for lead ${leadId}`)

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

      // Get the lead and scan data we need
      const { data: lead } = await supabase
        .from("leads")
        .select("domain, email")
        .eq("id", leadId)
        .single()

      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`)
      }

      // Get site analysis for this scan
      const { data: analysis } = await supabase
        .from("site_analyses")
        .select("*")
        .eq("run_id", scanRunId)
        .single()

      if (!analysis) {
        throw new Error(`Site analysis not found for scan: ${scanRunId}`)
      }

      // Get competitors to compare against
      // First try subscriber_competitors table (for tracked competitors)
      const { data: subscriberCompetitors } = await supabase
        .from("subscriber_competitors")
        .select("name")
        .eq("lead_id", leadId)
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
          competitors = report.top_competitors
            .slice(0, 3)
            .map((c: { name: string }) => c.name)
          log.info(scanRunId, `Using ${competitors.length} fallback competitors: ${competitors.join(', ')}`)
        }
      }

      return {
        domain: lead.domain,
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

    // Step 2: Run brand awareness queries
    const brandResults = await step.run("brand-awareness-queries", async () => {
      const supabase = createServiceClient()

      log.step(scanRunId, "Running brand awareness queries")

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

      // Run all queries across all platforms
      const results = await runBrandAwarenessQueries(queries, scanRunId)

      log.done(scanRunId, "Brand awareness", `${results.length} results`)

      // Save results to database
      const inserts = results.map((r) => ({
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
        totalQueries: queries.length,
        totalResults: results.length,
        recognized: results.filter((r) => r.recognized).length,
        // Return raw results for competitive summary generation
        rawResults: results,
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

        // Get site analysis for technical data
        const { data: analysis } = await supabase
          .from("site_analyses")
          .select("has_sitemap, has_robots_txt, schema_types, has_meta_descriptions, pages_crawled")
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
        const { data: previouslyCompleted } = await supabase
          .from("action_items_history")
          .select("title")
          .eq("lead_id", leadId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedActionTitles = (previouslyCompleted || []).map((h: any) => h.title as string)

        if (completedActionTitles.length > 0) {
          log.info(scanRunId, `Found ${completedActionTitles.length} previously completed actions to exclude from generation`)
        }

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
          completedActionTitles, // Pass to Claude to avoid re-suggesting
        }

        // Generate the action plan
        const generatedPlan = await generateActionPlan(actionPlanInput, scanRunId)

        // Archive any existing completed/dismissed actions before saving new ones
        // First get the existing plan for this lead
        const { data: existingPlan } = await supabase
          .from("action_plans")
          .select("id")
          .eq("lead_id", leadId)
          .single()

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
            original_action_id: a.id,
            title: a.title,
            description: a.description,
            category: a.category,
            scan_run_id: scanRunId,
          }))

          await supabase.from("action_items_history").insert(historyInserts)
          log.info(scanRunId, `Archived ${historyInserts.length} completed actions to history`)
        }

        // Delete existing action plan for this lead (will recreate fresh)
        await supabase.from("action_plans").delete().eq("lead_id", leadId)

        // Create new action plan
        const { data: planData, error: planError } = await supabase
          .from("action_plans")
          .insert({
            lead_id: leadId,
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

      // Get site analysis for context
      const { data: analysis } = await supabase
        .from("site_analyses")
        .select("business_name, business_type, services")
        .eq("run_id", scanRunId)
        .single()

      try {
        log.step(scanRunId, "Generating PRD from action plan")

        // Get previously completed PRD task titles to pass to Claude
        // This tells Claude not to suggest similar tasks again
        const { data: previouslyCompletedTasks } = await supabase
          .from("prd_tasks_history")
          .select("title")
          .eq("lead_id", leadId)

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

        const siteContext: SiteContext = {
          domain: scanData.domain,
          businessName: analysis?.business_name || null,
          businessType: analysis?.business_type || null,
          techStack: ["Next.js", "React", "TypeScript"], // Default for most modern sites
          services: analysis?.services || null,
        }

        // Generate PRD
        const generatedPrd = await generatePrd(actionPlanContext, siteContext, scanRunId, completedPrdTaskTitles)

        // Save PRD document
        const { data: prdDoc, error: prdError } = await supabase
          .from("prd_documents")
          .insert({
            lead_id: leadId,
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
