import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlagsForLead, type FeatureFlags } from '@/lib/features/flags'
import { getSession } from '@/lib/auth'
import { ReportClient } from './ReportClient'

interface ReportPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<{ locked?: string }>
}

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

interface ReportData {
  report: {
    id: string
    url_token: string
    visibility_score: number
    platform_scores: Record<string, number>
    top_competitors: { name: string; count: number }[]
    summary: string
    run_id: string
    created_at: string
    requires_verification: boolean
    expires_at: string | null
    subscriber_only: boolean
    enrichment_status: EnrichmentStatus
  }
  analysis: {
    business_type: string
    business_name: string | null
    services: string[]
    location: string | null
    target_audience?: string | null
    key_phrases?: string[]
    industry?: string
  } | null
  crawlData: {
    hasSitemap: boolean
    hasRobotsTxt: boolean
    pagesCrawled: number
    schemaTypes: string[]
    hasMetaDescriptions: boolean
  } | null
  responses: {
    platform: string
    response_text: string
    domain_mentioned: boolean
    prompt: { prompt_text: string } | null
  }[] | null
  prompts: {
    id: string
    prompt_text: string
    category: string
  }[] | null
  subscriberQuestions: {
    id: string
    prompt_text: string
    category: string
    source: 'ai_generated' | 'user_created'
  }[] | null
  brandAwareness: {
    platform: string
    query_type: string
    tested_entity: string
    tested_attribute: string | null
    entity_recognized: boolean
    attribute_mentioned: boolean
    response_text: string
    confidence_score: number
    compared_to: string | null
    positioning: string | null
  }[] | null
  competitiveSummary: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    overallPosition: string
  } | null
  email: string
  domain: string
  leadId: string
  runId: string
  isVerified: boolean
  featureFlags: FeatureFlags
  sitemapUsed: boolean
}

// Fetch report data server-side
async function getReport(token: string): Promise<ReportData | null> {
  const supabase = createServiceClient()
  const cookieStore = await cookies()

  // Fetch report by token
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select(`
      *,
      competitive_summary,
      run:scan_runs(
        id,
        created_at,
        enrichment_status,
        lead:leads(id, email, domain, email_verified, tier)
      )
    `)
    .eq('url_token', token)
    .single()

  if (reportError || !report) {
    return null
  }

  const lead = report.run?.lead as { id: string; email: string; domain: string; email_verified: boolean; tier: string } | null
  const runId = report.run?.id as string
  const runCreatedAt = report.run?.created_at as string
  const enrichmentStatus = (report.run?.enrichment_status as EnrichmentStatus) || 'not_applicable'

  if (!lead) {
    return null
  }

  // Check verification status
  // 1. Check if email is verified in database
  // 2. Check for verification cookie
  const emailHash = Buffer.from(lead.email).toString('base64').slice(0, 8)
  const verificationCookie = cookieStore.get(`outrankllm-verified-${emailHash}`)
  const isVerified = lead.email_verified || !!verificationCookie?.value

  // Get feature flags for this user's tier
  const featureFlags = await getFeatureFlagsForLead(lead.id)

  // Fetch site analysis for business info (including crawl data for AI Readiness)
  const { data: analysis } = await supabase
    .from('site_analyses')
    .select(`
      business_type, business_name, services, location, target_audience, key_phrases, industry,
      pages_crawled, has_sitemap, has_robots_txt, schema_types, has_meta_descriptions,
      locations, products
    `)
    .eq('run_id', runId)
    .single()

  // Fetch prompts for this scan (used for free users and as fallback)
  const { data: prompts } = await supabase
    .from('scan_prompts')
    .select('id, prompt_text, category')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  // For subscribers: fetch their editable subscriber_questions
  let subscriberQuestions: { id: string; prompt_text: string; category: string; source: 'ai_generated' | 'user_created' }[] | null = null
  if (featureFlags.isSubscriber) {
    const { data } = await supabase
      .from('subscriber_questions')
      .select('id, prompt_text, category, source')
      .eq('lead_id', lead.id)
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    subscriberQuestions = data as typeof subscriberQuestions
  }

  // Fetch all LLM responses for the AI Responses tab
  const { data: responses } = await supabase
    .from('llm_responses')
    .select(`
      platform,
      response_text,
      domain_mentioned,
      prompt:scan_prompts(prompt_text)
    `)
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  // Fetch brand awareness results
  const { data: brandAwareness } = await supabase
    .from('brand_awareness_results')
    .select(`
      platform,
      query_type,
      tested_entity,
      tested_attribute,
      entity_recognized,
      attribute_mentioned,
      response_text,
      confidence_score,
      compared_to,
      positioning
    `)
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  // Check if sitemap was used
  const sitemapUsed = analysis?.has_sitemap ?? (analysis?.pages_crawled || 0) > 5

  // Check if user is a subscriber (no expiry for subscribers)
  const isSubscriber = lead.tier !== 'free'

  return {
    report: {
      id: report.id,
      url_token: report.url_token,
      visibility_score: report.visibility_score,
      platform_scores: report.platform_scores || {},
      top_competitors: report.top_competitors || [],
      summary: report.summary || '',
      run_id: runId,
      created_at: runCreatedAt,
      requires_verification: report.requires_verification ?? true,
      expires_at: isSubscriber ? null : (report.expires_at || null),
      subscriber_only: report.subscriber_only ?? false,
      enrichment_status: enrichmentStatus,
    },
    analysis: analysis ? {
      business_type: analysis.business_type,
      business_name: analysis.business_name,
      services: analysis.services || [],
      location: analysis.location,
      target_audience: analysis.target_audience,
      key_phrases: analysis.key_phrases || [],
      industry: analysis.industry,
    } : null,
    crawlData: analysis ? {
      hasSitemap: analysis.has_sitemap ?? false,
      hasRobotsTxt: analysis.has_robots_txt ?? false,
      pagesCrawled: analysis.pages_crawled ?? 0,
      schemaTypes: analysis.schema_types ?? [],
      hasMetaDescriptions: analysis.has_meta_descriptions ?? false,
    } : null,
    responses: responses as ReportData['responses'],
    prompts: prompts as ReportData['prompts'],
    subscriberQuestions,
    brandAwareness: brandAwareness as ReportData['brandAwareness'],
    competitiveSummary: report.competitive_summary as ReportData['competitiveSummary'],
    email: lead.email,
    domain: lead.domain,
    leadId: lead.id,
    runId,
    isVerified,
    featureFlags,
    sitemapUsed,
  }
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const { token } = await params
  const { locked } = await searchParams
  const data = await getReport(token)

  if (!data) {
    notFound()
  }

  // If report owner is a subscriber, require login to view
  // This protects paid reports from being accessed by anyone with the link
  if (data.featureFlags.isSubscriber) {
    const session = await getSession()

    // Not logged in - redirect to login
    if (!session) {
      redirect(`/login?redirect=/report/${token}`)
    }

    // Logged in but not the report owner - show not found
    // (prevents other users from accessing someone else's report)
    if (session.lead_id !== data.leadId) {
      notFound()
    }
  }

  // Show locked modal if user tried to request another free report
  const showLockedModal = locked === 'true' && !data.featureFlags.isSubscriber

  return <ReportClient data={data} showLockedModal={showLockedModal} />
}

// Metadata
export async function generateMetadata({ params }: ReportPageProps) {
  const { token } = await params
  const data = await getReport(token)

  if (!data) {
    return {
      title: 'Report Not Found | outrankllm.io',
    }
  }

  return {
    title: `AI Visibility Report for ${data.domain} | outrankllm.io`,
    description: `Your site has a ${data.report.visibility_score}% AI visibility score. See how ChatGPT, Claude, and Gemini recommend your business.`,
  }
}
