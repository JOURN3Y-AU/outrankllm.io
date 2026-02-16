/**
 * Shared HiringBrand report data fetcher
 * Used by both the report page (page.tsx) and the PPTX export route
 */

import { createServiceClient } from '@/lib/supabase/server'
import type {
  HBReportData,
  HBResponse,
  HBPrompt,
  HBQuestionCategory,
  HBEmployerTopic,
  HBTopicWithConfidence,
  HBCompetitorAnalysis,
  HBStrategicSummary,
  HBMentionStats,
  HBWebMention,
  HBMentionSourceType,
  HBMentionSentiment,
  HBTrendsData,
  HBScoreHistoryEntry,
  HBCompetitorHistorySnapshot,
  HBPlatform,
  HBEmployerDimension,
  HBRoleFamily,
  HBRoleFamilyScores,
  HBJobFamily,
  HBRoleActionPlans,
} from '@/app/hiringbrand/report/components/shared/types'

// Fetch trends data (score history + competitor history)
async function getTrendsData(
  supabase: ReturnType<typeof createServiceClient>,
  monitoredDomainId: string
): Promise<HBTrendsData> {
  const { data: scoreHistoryRaw } = await supabase
    .from('hb_score_history')
    .select('*')
    .eq('monitored_domain_id', monitoredDomainId)
    .order('scan_date', { ascending: true })
    .limit(52)

  const { data: competitorHistoryRaw } = await supabase
    .from('hb_competitor_history')
    .select('*')
    .eq('monitored_domain_id', monitoredDomainId)
    .order('scan_date', { ascending: true })
    .limit(520)

  // Deduplicate score history - keep only most recent entry per day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoreByDay = new Map<string, any>()
  for (const h of scoreHistoryRaw || []) {
    const dayKey = h.scan_date.split('T')[0] // Extract YYYY-MM-DD
    const existing = scoreByDay.get(dayKey)
    // Keep the most recent scan (later timestamp) for each day
    if (!existing || h.scan_date > existing.scan_date) {
      scoreByDay.set(dayKey, h)
    }
  }

  const scoreHistory: HBScoreHistoryEntry[] = Array.from(scoreByDay.values())
    .sort((a, b) => a.scan_date.localeCompare(b.scan_date))
    .map((h) => ({
      id: h.id,
      scanDate: h.scan_date,
      desirabilityScore: h.desirability_score,
      awarenessScore: h.awareness_score,
      differentiationScore: h.differentiation_score,
      platformScores: (h.platform_scores || {}) as Record<HBPlatform, number>,
      competitorRank: h.competitor_rank,
      competitorCount: h.competitor_count,
      dimensionScores: (h.dimension_scores || {}) as Record<HBEmployerDimension, number>,
      roleFamilyScores: (h.role_family_scores || {}) as HBRoleFamilyScores,
    }))

  // Deduplicate competitor history - keep only most recent entry per day
  const competitorByDate = new Map<string, HBCompetitorHistorySnapshot>()
  for (const h of competitorHistoryRaw || []) {
    const dayKey = h.scan_date.split('T')[0] // Extract YYYY-MM-DD
    if (!competitorByDate.has(dayKey)) {
      competitorByDate.set(dayKey, { scanDate: h.scan_date, employers: [] })
    }
    const snapshot = competitorByDate.get(dayKey)!
    // Update to use the most recent scan_date timestamp for this day
    if (h.scan_date > snapshot.scanDate) {
      snapshot.scanDate = h.scan_date
    }
    snapshot.employers.push({
      name: h.competitor_name,
      isTarget: h.is_target,
      compositeScore: parseFloat(h.composite_score) || 0,
      rankByComposite: h.rank_by_composite || 0,
    })
  }

  const competitorHistory = Array.from(competitorByDate.values())
    .sort((a, b) => new Date(a.scanDate).getTime() - new Date(b.scanDate).getTime())
    .map((snapshot) => ({
      ...snapshot,
      employers: snapshot.employers.sort((a, b) => b.compositeScore - a.compositeScore),
    }))

  return {
    scoreHistory,
    competitorHistory,
    hasTrends: scoreHistory.length > 1 || competitorHistory.length > 1,
  }
}

export type HBReportDataWithExtras = HBReportData & {
  trends: HBTrendsData
  navBrands: Array<{
    domain: string
    companyName: string | null
    latestReportToken: string | null
    latestScore: number | null
    isScanning: boolean
  }>
}

/**
 * Fetch complete HiringBrand report data by URL token
 */
export async function fetchHBReportData(token: string): Promise<HBReportDataWithExtras | null> {
  const supabase = createServiceClient()

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select(
      `
      id,
      url_token,
      visibility_score,
      researchability_score,
      differentiation_score,
      platform_scores,
      top_competitors,
      topics_covered,
      topics_missing,
      topics_with_confidence,
      competitor_analysis,
      strategic_summary,
      mention_stats,
      role_action_plans,
      summary,
      created_at,
      expires_at,
      run:scan_runs(
        id,
        domain,
        organization_id,
        monitored_domain_id,
        monitored_domain:monitored_domains(
          id,
          domain,
          company_name,
          organization:organizations(id, name, tier, status)
        )
      )
    `
    )
    .eq('url_token', token)
    .eq('brand', 'hiringbrand')
    .single()

  if (reportError || !report) {
    return null
  }

  const run = report.run as {
    id: string
    domain: string
    organization_id: string
    monitored_domain_id: string
    monitored_domain: {
      id: string
      domain: string
      company_name: string
      organization: { id: string; name: string; tier: string; status: string }
    } | null
  } | null

  if (!run) {
    return null
  }

  const { data: analysis } = await supabase
    .from('site_analyses')
    .select('business_name, business_type, location, services, key_phrases')
    .eq('run_id', run.id)
    .single()

  const { data: responsesRaw } = await supabase
    .from('llm_responses')
    .select(
      `
      id,
      platform,
      response_text,
      domain_mentioned,
      mention_position,
      competitors_mentioned,
      sources,
      response_time_ms,
      sentiment_score,
      sentiment_category,
      sentiment_positive_phrases,
      sentiment_negative_phrases,
      specificity_score,
      confidence_score,
      topics_covered,
      positive_highlights,
      negative_highlights,
      red_flags,
      green_flags,
      recommendation_score,
      recommendation_summary,
      hedging_level,
      source_quality,
      response_recency,
      job_family,
      prompt:scan_prompts(id, prompt_text, category)
    `
    )
    .eq('run_id', run.id)
    .order('platform')

  const { data: promptsRaw } = await supabase
    .from('scan_prompts')
    .select('id, prompt_text, category')
    .eq('run_id', run.id)
    .order('category')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses: HBResponse[] = (responsesRaw || []).map((r: any) => {
    const prompt = r.prompt as { id: string; prompt_text: string; category: string } | null
    return {
      id: r.id,
      platform: r.platform as HBResponse['platform'],
      promptText: prompt?.prompt_text || '',
      promptCategory: prompt?.category || 'reputation',
      responseText: r.response_text || '',
      domainMentioned: r.domain_mentioned || false,
      mentionPosition: r.mention_position,
      competitorsMentioned: (r.competitors_mentioned as Array<{ name: string; context?: string }>) || [],
      sources: r.sources as Array<{ url: string; title?: string }> | null,
      responseTimeMs: r.response_time_ms,
      sentimentScore: r.sentiment_score,
      sentimentCategory: r.sentiment_category as HBResponse['sentimentCategory'],
      sentimentPositivePhrases: (r.sentiment_positive_phrases as string[]) || [],
      sentimentNegativePhrases: (r.sentiment_negative_phrases as string[]) || [],
      specificityScore: r.specificity_score,
      confidenceScore: r.confidence_score,
      topicsCovered: (r.topics_covered as HBEmployerTopic[]) || [],
      positiveHighlights: (r.positive_highlights as string[]) || [],
      negativeHighlights: (r.negative_highlights as string[]) || [],
      redFlags: (r.red_flags as string[]) || [],
      greenFlags: (r.green_flags as string[]) || [],
      recommendationScore: r.recommendation_score,
      recommendationSummary: r.recommendation_summary,
      hedgingLevel: r.hedging_level as HBResponse['hedgingLevel'],
      sourceQuality: r.source_quality as HBResponse['sourceQuality'],
      responseRecency: r.response_recency as HBResponse['responseRecency'],
      jobFamily: (r.job_family as HBJobFamily) || null,
    }
  })

  const sentimentCounts = {
    strong: responses.filter((r) => r.sentimentCategory === 'strong').length,
    positive: responses.filter((r) => r.sentimentCategory === 'positive').length,
    mixed: responses.filter((r) => r.sentimentCategory === 'mixed').length,
    negative: responses.filter((r) => r.sentimentCategory === 'negative').length,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompts: HBPrompt[] = (promptsRaw || []).map((p: any) => ({
    id: p.id,
    promptText: p.prompt_text,
    category: p.category as HBQuestionCategory,
  }))

  let trends: HBTrendsData = { scoreHistory: [], competitorHistory: [], hasTrends: false }
  if (run.monitored_domain_id) {
    trends = await getTrendsData(supabase, run.monitored_domain_id)
  }

  const { data: mentionsRaw } = await supabase
    .from('hb_web_mentions')
    .select('id, url, title, snippet, published_date, source_type, sentiment, sentiment_score, relevance_score, domain_name')
    .eq('report_id', report.id)
    .gte('relevance_score', 5) // Filter out low-relevance mentions (wrong company, wrong location, etc.)
    .order('relevance_score', { ascending: false, nullsFirst: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentions: HBWebMention[] = (mentionsRaw || []).map((m: any) => ({
    id: m.id,
    url: m.url,
    title: m.title,
    snippet: m.snippet,
    publishedDate: m.published_date,
    sourceType: m.source_type as HBMentionSourceType,
    sentiment: m.sentiment as HBMentionSentiment,
    sentimentScore: m.sentiment_score,
    relevanceScore: m.relevance_score,
    domainName: m.domain_name,
  }))

  // Fetch role families if monitored domain exists
  let roleFamilies: HBRoleFamily[] = []
  let roleFamilyScores: HBRoleFamilyScores = {}

  if (run.monitored_domain_id) {
    // Fetch frozen role families
    const { data: frozenFamilies } = await supabase
      .from('hb_frozen_role_families')
      .select('id, family, display_name, description, source, is_active, sort_order')
      .eq('monitored_domain_id', run.monitored_domain_id)
      .eq('is_active', true)
      .order('sort_order')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roleFamilies = (frozenFamilies || []).map((rf: any) => ({
      id: rf.id,
      family: rf.family as HBJobFamily,
      displayName: rf.display_name,
      description: rf.description || '',
      source: rf.source as 'employer_research' | 'user_custom',
      isActive: rf.is_active,
      sortOrder: rf.sort_order,
    }))

    // Get latest role family scores from most recent score history
    if (trends.scoreHistory.length > 0) {
      const latestHistory = trends.scoreHistory[trends.scoreHistory.length - 1]
      roleFamilyScores = latestHistory.roleFamilyScores || {}
    }
  }

  // Fetch all brands for this org (for the report switcher nav)
  let navBrands: Array<{ domain: string; companyName: string | null; latestReportToken: string | null; latestScore: number | null; isScanning: boolean }> = []
  const orgId = run.monitored_domain?.organization?.id
  if (orgId) {
    const { data: allDomains } = await supabase
      .from('monitored_domains')
      .select('domain, company_name')
      .eq('organization_id', orgId)
      .eq('is_primary', true)
      .order('company_name', { ascending: true })

    navBrands = await Promise.all(
      (allDomains || []).map(async (md: { domain: string; company_name: string | null }) => {
        const { data: latestRun } = await supabase
          .from('scan_runs')
          .select('id, status')
          .eq('domain', md.domain)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let latestReport = null
        if (latestRun) {
          const { data: rpt } = await supabase
            .from('reports')
            .select('url_token, visibility_score')
            .eq('run_id', latestRun.id)
            .single()
          latestReport = rpt
        }

        return {
          domain: md.domain,
          companyName: md.company_name,
          latestReportToken: latestReport?.url_token ?? null,
          latestScore: latestReport?.visibility_score ?? null,
          isScanning: latestRun?.status === 'running' || latestRun?.status === 'pending',
        }
      })
    )
    navBrands = navBrands.filter((b) => b.latestReportToken || b.isScanning)
  }

  const companyName =
    run.monitored_domain?.company_name ||
    analysis?.business_name ||
    run.domain.split('.')[0].charAt(0).toUpperCase() + run.domain.split('.')[0].slice(1)

  return {
    report: {
      id: report.id,
      urlToken: report.url_token,
      visibilityScore: report.visibility_score || 0,
      researchabilityScore: report.researchability_score,
      differentiationScore: (report as { differentiation_score?: number }).differentiation_score ?? null,
      platformScores: (report.platform_scores as Record<string, number>) || {},
      topCompetitors: (report.top_competitors as Array<{ name: string; count: number }>) || [],
      topicsCovered: (report.topics_covered as HBEmployerTopic[]) || [],
      topicsMissing: (report.topics_missing as HBEmployerTopic[]) || [],
      topicsWithConfidence: ((report as { topics_with_confidence?: HBTopicWithConfidence[] }).topics_with_confidence as HBTopicWithConfidence[]) || [],
      summary: report.summary,
      createdAt: report.created_at,
      expiresAt: report.expires_at,
      competitorAnalysis: (report as { competitor_analysis?: HBCompetitorAnalysis }).competitor_analysis ?? null,
      strategicSummary: (report as { strategic_summary?: HBStrategicSummary }).strategic_summary ?? null,
      mentionStats: (report as { mention_stats?: HBMentionStats }).mention_stats ?? null,
      monitoredDomainId: run.monitored_domain_id || null,
      roleActionPlans: (report as { role_action_plans?: HBRoleActionPlans }).role_action_plans || {},
    },
    company: {
      name: companyName,
      domain: run.domain,
      industry: analysis?.business_type || null,
      location: analysis?.location || null,
      commonRoles: (analysis?.services as string[]) || [],
      cultureKeywords: (analysis?.key_phrases as string[]) || [],
    },
    organization: run.monitored_domain?.organization || null,
    navBrands,
    responses,
    prompts,
    mentions,
    sentimentCounts,
    trends,
    roleFamilies,
    roleFamilyScores,
  }
}
