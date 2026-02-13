/**
 * HiringBrand Report Page - Server Component
 * Completely separate from outrankllm report
 */

import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { ReportClient } from './ReportClient'
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
} from '../components/shared/types'

interface PageProps {
  params: Promise<{ token: string }>
}

// Fetch trends data (score history + competitor history)
async function getTrendsData(
  supabase: ReturnType<typeof createServiceClient>,
  monitoredDomainId: string
): Promise<HBTrendsData> {
  // Fetch score history for this monitored domain
  const { data: scoreHistoryRaw } = await supabase
    .from('hb_score_history')
    .select('*')
    .eq('monitored_domain_id', monitoredDomainId)
    .order('scan_date', { ascending: true })
    .limit(52) // Up to 1 year of weekly scans

  // Fetch competitor history
  const { data: competitorHistoryRaw } = await supabase
    .from('hb_competitor_history')
    .select('*')
    .eq('monitored_domain_id', monitoredDomainId)
    .order('scan_date', { ascending: true })
    .limit(520) // 52 weeks * up to 10 competitors

  // Transform score history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoreHistory: HBScoreHistoryEntry[] = (scoreHistoryRaw || []).map((h: any) => ({
    id: h.id,
    scanDate: h.scan_date,
    desirabilityScore: h.desirability_score,
    awarenessScore: h.awareness_score,
    differentiationScore: h.differentiation_score,
    platformScores: (h.platform_scores || {}) as Record<HBPlatform, number>,
    competitorRank: h.competitor_rank,
    competitorCount: h.competitor_count,
    dimensionScores: (h.dimension_scores || {}) as Record<HBEmployerDimension, number>,
  }))

  // Group competitor history by scan date for line chart
  const competitorByDate = new Map<string, HBCompetitorHistorySnapshot>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const h of competitorHistoryRaw || []) {
    const dateKey = h.scan_date.split('T')[0] // Group by date (ignore time)
    if (!competitorByDate.has(dateKey)) {
      competitorByDate.set(dateKey, {
        scanDate: h.scan_date,
        employers: [],
      })
    }
    competitorByDate.get(dateKey)!.employers.push({
      name: h.competitor_name,
      isTarget: h.is_target,
      compositeScore: parseFloat(h.composite_score) || 0,
      rankByComposite: h.rank_by_composite || 0,
    })
  }

  // Sort snapshots by date and employers within each snapshot by composite score
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

// Fetch HiringBrand report data
async function getHBReport(token: string): Promise<(HBReportData & { trends: HBTrendsData; navBrands: Array<{ domain: string; companyName: string | null; latestReportToken: string | null; latestScore: number | null; isScanning: boolean }> }) | null> {
  const supabase = createServiceClient()

  // Fetch report with HiringBrand-specific joins
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

  // Fetch site analysis for company metadata
  const { data: analysis } = await supabase
    .from('site_analyses')
    .select('business_name, business_type, location, services, key_phrases')
    .eq('run_id', run.id)
    .single()

  // Fetch AI responses with prompts, sentiment, researchability, and enhanced analysis
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
      prompt:scan_prompts(id, prompt_text, category)
    `
    )
    .eq('run_id', run.id)
    .order('platform')

  // Fetch prompts/questions
  const { data: promptsRaw } = await supabase
    .from('scan_prompts')
    .select('id, prompt_text, category')
    .eq('run_id', run.id)
    .order('category')

  // Transform responses
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
      // Sentiment (desirability)
      sentimentScore: r.sentiment_score,
      sentimentCategory: r.sentiment_category as HBResponse['sentimentCategory'],
      sentimentPositivePhrases: (r.sentiment_positive_phrases as string[]) || [],
      sentimentNegativePhrases: (r.sentiment_negative_phrases as string[]) || [],
      // Researchability
      specificityScore: r.specificity_score,
      confidenceScore: r.confidence_score,
      topicsCovered: (r.topics_covered as HBEmployerTopic[]) || [],
      // Enhanced analysis - key phrases
      positiveHighlights: (r.positive_highlights as string[]) || [],
      negativeHighlights: (r.negative_highlights as string[]) || [],
      redFlags: (r.red_flags as string[]) || [],
      greenFlags: (r.green_flags as string[]) || [],
      // Enhanced analysis - recommendation
      recommendationScore: r.recommendation_score,
      recommendationSummary: r.recommendation_summary,
      // Enhanced analysis - confidence indicators
      hedgingLevel: r.hedging_level as HBResponse['hedgingLevel'],
      sourceQuality: r.source_quality as HBResponse['sourceQuality'],
      responseRecency: r.response_recency as HBResponse['responseRecency'],
    }
  })

  // Calculate sentiment counts (4-tier system)
  const sentimentCounts = {
    strong: responses.filter((r) => r.sentimentCategory === 'strong').length,
    positive: responses.filter((r) => r.sentimentCategory === 'positive').length,
    mixed: responses.filter((r) => r.sentimentCategory === 'mixed').length,
    negative: responses.filter((r) => r.sentimentCategory === 'negative').length,
  }

  // Transform prompts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompts: HBPrompt[] = (promptsRaw || []).map((p: any) => ({
    id: p.id,
    promptText: p.prompt_text,
    category: p.category as HBQuestionCategory,
  }))

  // Fetch trends data if we have a monitored_domain_id
  let trends: HBTrendsData = { scoreHistory: [], competitorHistory: [], hasTrends: false }
  if (run.monitored_domain_id) {
    trends = await getTrendsData(supabase, run.monitored_domain_id)
  }

  // Fetch web mentions for this report
  const { data: mentionsRaw } = await supabase
    .from('hb_web_mentions')
    .select('id, url, title, snippet, published_date, source_type, sentiment, sentiment_score, relevance_score, domain_name')
    .eq('report_id', report.id)
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

  // Fetch all brands for this org (for the report switcher nav)
  let navBrands: Array<{ domain: string; companyName: string | null; latestReportToken: string | null; latestScore: number | null; isScanning: boolean }> = []
  const orgId = run.monitored_domain?.organization?.id
  if (orgId) {
    const { data: allDomains } = await supabase
      .from('monitored_domains')
      .select('domain, company_name')
      .eq('organization_id', orgId)
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
  }

  // Extract company info - prefer monitored_domain name (set from domain) over extracted business_name
  // (business_name can sometimes be a tagline extracted from the page)
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
  }
}

export default async function HiringBrandReportPage({ params }: PageProps) {
  const { token } = await params

  const reportData = await getHBReport(token)

  if (!reportData) {
    notFound()
  }

  // Optional auth — detect user role without breaking public access
  let userRole: 'owner' | 'admin' | 'viewer' | null = null
  try {
    const session = await getSession()
    if (session && reportData.organization) {
      const supabase = createServiceClient()
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('lead_id', session.lead_id)
        .eq('organization_id', reportData.organization.id)
        .single()
      if (membership) {
        userRole = membership.role as 'owner' | 'admin' | 'viewer'
      }
    }
  } catch {
    // Not logged in — userRole stays null
  }

  return <ReportClient data={reportData} userRole={userRole} />
}

// Metadata
export async function generateMetadata({ params }: PageProps) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: report } = await supabase
    .from('reports')
    .select('run:scan_runs(domain)')
    .eq('url_token', token)
    .eq('brand', 'hiringbrand')
    .single()

  const domain = (report?.run as { domain: string } | null)?.domain || 'Company'
  const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)

  return {
    title: `${companyName} - Employer Reputation Report | HiringBrand`,
    description: `AI employer reputation intelligence for ${companyName}. See how AI assistants describe your company to job seekers.`,
  }
}
