import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin'
import {
  generateActionPlan,
  type ActionPlanInput,
  type CrawledPage,
  type LLMResponseData,
  type BrandAwarenessData,
  type CompetitiveSummaryData,
  type PlatformDataInput,
} from '@/lib/ai/generate-actions'

/**
 * Admin endpoint to regenerate action plans for a specific report
 * This is useful for testing changes to action plan generation
 *
 * POST /api/admin/regenerate-actions
 * Body: { reportToken: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const adminSecret = request.headers.get('x-admin-secret')
    const hasValidSecret = adminSecret && adminSecret === process.env.ADMIN_SECRET
    const adminSession = await getAdminSession()

    if (!hasValidSecret && !adminSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { reportToken } = body

    if (!reportToken) {
      return NextResponse.json({ error: 'Must provide reportToken' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get report and scan run info
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        id,
        run_id,
        visibility_score,
        platform_scores,
        scan_runs (
          id,
          lead_id,
          domain,
          domain_subscription_id
        )
      `)
      .eq('url_token', reportToken)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const scanRun = report.scan_runs as {
      id: string
      lead_id: string
      domain: string
      domain_subscription_id: string | null
    }
    const scanRunId = scanRun.id
    const leadId = scanRun.lead_id
    const domainSubscriptionId = scanRun.domain_subscription_id

    console.log(`[regenerate-actions] Starting for ${scanRun.domain} (run: ${scanRunId})`)

    // Get site analysis
    const { data: analysis } = await supabase
      .from('site_analyses')
      .select('*')
      .eq('run_id', scanRunId)
      .single()

    if (!analysis) {
      return NextResponse.json({ error: 'Site analysis not found' }, { status: 404 })
    }

    // Get crawled pages
    const { data: crawledPagesData } = await supabase
      .from('crawled_pages')
      .select('*')
      .eq('run_id', scanRunId)

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

    // Get LLM responses
    const { data: responsesData } = await supabase
      .from('llm_responses')
      .select('platform, response_text, domain_mentioned, competitors_mentioned, prompt:scan_prompts(prompt_text)')
      .eq('run_id', scanRunId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responses: LLMResponseData[] = (responsesData || []).map((r: any) => ({
      platform: r.platform,
      promptText: (r.prompt as { prompt_text?: string } | null)?.prompt_text || '',
      responseText: r.response_text || '',
      domainMentioned: r.domain_mentioned || false,
      competitorsMentioned: r.competitors_mentioned || [],
    }))

    // Get brand awareness results
    const { data: brandAwarenessData } = await supabase
      .from('brand_awareness_results')
      .select('*')
      .eq('run_id', scanRunId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brandAwareness: BrandAwarenessData[] = (brandAwarenessData || []).map((r: any) => ({
      platform: r.platform,
      queryType: r.query_type,
      entityRecognized: r.entity_recognized,
      attributeMentioned: r.attribute_mentioned,
      testedAttribute: r.tested_attribute,
      positioning: r.positioning,
      comparedTo: r.compared_to,
    }))

    // Get competitive summary
    const { data: reportWithSummary } = await supabase
      .from('reports')
      .select('competitive_summary')
      .eq('run_id', scanRunId)
      .single()

    const competitiveSummary = reportWithSummary?.competitive_summary as CompetitiveSummaryData | null

    // Build platform data
    const platformData: PlatformDataInput | null = analysis.detected_cms !== undefined ? {
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

    console.log(`[regenerate-actions] Platform data:`, {
      cms: platformData?.cms,
      framework: platformData?.framework,
      hasAiReadabilityIssues: platformData?.hasAiReadabilityIssues,
    })

    // Get previously completed action titles
    let previouslyCompleted: { title: string }[] | null = null
    if (domainSubscriptionId) {
      const { data } = await supabase
        .from('action_items_history')
        .select('title')
        .eq('lead_id', leadId)
        .or(`domain_subscription_id.eq.${domainSubscriptionId},domain_subscription_id.is.null`)
      previouslyCompleted = data
    } else {
      const { data } = await supabase
        .from('action_items_history')
        .select('title')
        .eq('lead_id', leadId)
      previouslyCompleted = data
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedActionTitles = (previouslyCompleted || []).map((h: any) => h.title as string)

    // Build platform scores
    const platforms = ['chatgpt', 'claude', 'gemini', 'perplexity']
    const platformScores: Record<string, { score: number; mentioned: number; total: number }> = {}
    for (const platform of platforms) {
      const platformResponses = responses.filter((r) => r.platform === platform)
      const mentioned = platformResponses.filter((r) => r.domainMentioned).length
      platformScores[platform] = {
        score: (report.platform_scores as Record<string, number>)?.[platform] || 0,
        mentioned,
        total: platformResponses.length,
      }
    }

    // Build action plan input
    const actionPlanInput: ActionPlanInput = {
      analysis: {
        businessName: analysis.business_name,
        businessType: analysis.business_type,
        services: analysis.services || [],
        location: analysis.location,
        locations: analysis.locations || [],
        keyPhrases: analysis.key_phrases || [],
        industry: analysis.industry,
      },
      crawledPages,
      crawlData: {
        hasSitemap: analysis.has_sitemap || false,
        hasRobotsTxt: analysis.has_robots_txt || false,
        schemaTypes: analysis.schema_types || [],
        hasMetaDescriptions: analysis.has_meta_descriptions || false,
        pagesCrawled: analysis.pages_crawled || 0,
      },
      responses,
      brandAwareness,
      competitiveSummary,
      scores: {
        overall: report.visibility_score || 0,
        byPlatform: platformScores,
      },
      domain: scanRun.domain,
      platformData,
      completedActionTitles,
    }

    // Generate the action plan
    console.log(`[regenerate-actions] Generating action plan...`)
    const generatedPlan = await generateActionPlan(actionPlanInput, scanRunId)

    console.log(`[regenerate-actions] Generated ${generatedPlan.priorityActions.length} actions`)

    // Delete existing action plan
    let deletePlanQuery = supabase.from('action_plans').delete()
    if (domainSubscriptionId) {
      deletePlanQuery = deletePlanQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      deletePlanQuery = deletePlanQuery.eq('lead_id', leadId)
    }
    await deletePlanQuery

    // Create new action plan
    const { data: planData, error: planError } = await supabase
      .from('action_plans')
      .insert({
        lead_id: leadId,
        domain_subscription_id: domainSubscriptionId || null,
        run_id: scanRunId,
        executive_summary: generatedPlan.executiveSummary,
        page_edits: generatedPlan.pageEdits,
        content_priorities: generatedPlan.contentPriorities,
        keyword_map: generatedPlan.keywordMap,
        key_takeaways: generatedPlan.keyTakeaways,
        quick_wins_count: generatedPlan.priorityActions.filter((a) => a.effort === 'low' && a.impact >= 2).length,
        strategic_count: generatedPlan.priorityActions.filter((a) => a.effort === 'medium').length,
        backlog_count: generatedPlan.priorityActions.filter((a) => a.effort === 'high').length,
      })
      .select('id')
      .single()

    if (planError) {
      return NextResponse.json({ error: 'Failed to create action plan', details: planError.message }, { status: 500 })
    }

    // Insert action items
    const actionInserts = generatedPlan.priorityActions.map((action, index) => ({
      plan_id: planData.id,
      title: action.title,
      description: action.description,
      rationale: action.rationale,
      source_insight: action.sourceInsight,
      priority: action.effort === 'low' && action.impact >= 2 ? 'quick_win' : action.effort === 'high' ? 'backlog' : 'strategic',
      category: action.category,
      estimated_impact: action.impact === 3 ? 'high' : action.impact === 2 ? 'medium' : 'low',
      estimated_effort: action.effort,
      target_page: action.targetPage,
      target_keywords: action.targetKeywords,
      consensus: action.consensus,
      implementation_steps: action.implementationSteps,
      expected_outcome: action.expectedOutcome,
      sort_order: index,
      status: 'pending',
    }))

    if (actionInserts.length > 0) {
      const { error: itemsError } = await supabase.from('action_items').insert(actionInserts)
      if (itemsError) {
        console.warn(`[regenerate-actions] Failed to insert action items:`, itemsError.message)
      }
    }

    console.log(`[regenerate-actions] Complete - ${actionInserts.length} actions saved`)

    return NextResponse.json({
      success: true,
      domain: scanRun.domain,
      actionsGenerated: actionInserts.length,
      platformData: {
        cms: platformData?.cms,
        framework: platformData?.framework,
        hasAiReadabilityIssues: platformData?.hasAiReadabilityIssues,
      },
      executiveSummary: generatedPlan.executiveSummary,
      sampleActions: generatedPlan.priorityActions.slice(0, 3).map(a => ({
        title: a.title,
        category: a.category,
        effort: a.effort,
      })),
    })
  } catch (error) {
    console.error('[regenerate-actions] Error:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate actions', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
