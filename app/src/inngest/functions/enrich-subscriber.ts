import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import {
  generateBrandAwarenessQueries,
  runBrandAwarenessQueries,
  generateCompetitiveSummary,
  type BrandAwarenessResult,
} from "@/lib/ai/brand-awareness"
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
        // Fallback to top competitor from report (for new subscribers)
        const { data: report } = await supabase
          .from("reports")
          .select("top_competitors")
          .eq("run_id", scanRunId)
          .single()

        if (report?.top_competitors && report.top_competitors.length > 0) {
          competitors = [report.top_competitors[0].name]
          log.info(scanRunId, `Using fallback top competitor: ${competitors[0]}`)
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

    // Step 4: Mark enrichment as complete
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
      processingTimeMs: Date.now() - startTime,
    }
  }
)
