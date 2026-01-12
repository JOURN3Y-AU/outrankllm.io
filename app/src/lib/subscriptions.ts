/**
 * Domain subscription management
 * Handles multi-domain subscriptions where each domain has its own subscription
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { SubscriptionTier } from './stripe-config'

// ============================================
// TYPES
// ============================================

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'

export interface DomainSubscription {
  id: string
  lead_id: string
  domain: string
  tier: SubscriptionTier
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  scan_schedule_day: number
  scan_schedule_hour: number
  scan_timezone: string
  created_at: string
  updated_at: string
}

export interface DomainSubscriptionWithReports extends DomainSubscription {
  latest_report?: {
    url_token: string
    visibility_score: number | null
    platform_scores: Record<string, number> | null
    created_at: string
  } | null
  report_count: number
}

export interface CreateDomainSubscriptionInput {
  lead_id: string
  domain: string
  tier: SubscriptionTier
  stripe_subscription_id?: string
  stripe_price_id?: string
  status?: SubscriptionStatus
  current_period_start?: string
  current_period_end?: string
}

export interface UpdateDomainSubscriptionInput {
  tier?: SubscriptionTier
  stripe_subscription_id?: string
  stripe_price_id?: string
  status?: SubscriptionStatus
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
  scan_schedule_day?: number
  scan_schedule_hour?: number
  scan_timezone?: string
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Get all domain subscriptions for a lead
 */
export async function getSubscriptionsForLead(leadId: string): Promise<DomainSubscription[]> {
  const supabase = createServiceClient()

  // Exclude incomplete subscriptions (checkout not completed)
  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('*')
    .eq('lead_id', leadId)
    .neq('status', 'incomplete')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching subscriptions:', error)
    return []
  }

  return data || []
}

/**
 * Get all domain subscriptions for a lead with latest report info
 */
export async function getSubscriptionsWithReports(leadId: string): Promise<DomainSubscriptionWithReports[]> {
  const supabase = createServiceClient()

  // Get subscriptions - exclude incomplete ones (checkout not completed)
  const { data: subscriptions, error } = await supabase
    .from('domain_subscriptions')
    .select('*')
    .eq('lead_id', leadId)
    .neq('status', 'incomplete')
    .order('created_at', { ascending: true })

  if (error || !subscriptions) {
    console.error('Error fetching subscriptions:', error)
    return []
  }

  // For each subscription, get latest report and count
  const results: DomainSubscriptionWithReports[] = []

  for (const sub of subscriptions) {
    // Get latest report for this subscription's domain
    const { data: latestRun } = await supabase
      .from('scan_runs')
      .select(`
        id,
        created_at,
        reports (
          url_token,
          visibility_score,
          platform_scores,
          created_at
        )
      `)
      .eq('domain_subscription_id', sub.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get total report count
    const { count } = await supabase
      .from('scan_runs')
      .select('id', { count: 'exact', head: true })
      .eq('domain_subscription_id', sub.id)
      .eq('status', 'complete')

    const reportData = latestRun?.reports
    const latestReport = Array.isArray(reportData) ? reportData[0] : reportData

    results.push({
      ...sub,
      latest_report: latestReport ? {
        url_token: latestReport.url_token,
        visibility_score: latestReport.visibility_score,
        platform_scores: latestReport.platform_scores,
        created_at: latestRun?.created_at || latestReport.created_at,
      } : null,
      report_count: count || 0,
    })
  }

  return results
}

/**
 * Get a single domain subscription by ID
 */
export async function getSubscriptionById(subscriptionId: string): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (error) {
    console.error('Error fetching subscription:', error)
    return null
  }

  return data
}

/**
 * Get a domain subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single()

  if (error) {
    console.error('Error fetching subscription by Stripe ID:', error)
    return null
  }

  return data
}

/**
 * Get a domain subscription by lead ID and domain
 */
export async function getSubscriptionByDomain(leadId: string, domain: string): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('*')
    .eq('lead_id', leadId)
    .eq('domain', domain)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is OK
      console.error('Error fetching subscription by domain:', error)
    }
    return null
  }

  return data
}

/**
 * Create a new domain subscription
 */
export async function createDomainSubscription(input: CreateDomainSubscriptionInput): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .insert({
      lead_id: input.lead_id,
      domain: input.domain,
      tier: input.tier,
      stripe_subscription_id: input.stripe_subscription_id,
      stripe_price_id: input.stripe_price_id,
      status: input.status || 'incomplete',
      current_period_start: input.current_period_start,
      current_period_end: input.current_period_end,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating subscription:', error)
    return null
  }

  return data
}

/**
 * Update a domain subscription
 */
export async function updateDomainSubscription(
  subscriptionId: string,
  input: UpdateDomainSubscriptionInput
): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .update(input)
    .eq('id', subscriptionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating subscription:', error)
    return null
  }

  return data
}

/**
 * Update a domain subscription by Stripe subscription ID
 */
export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  input: UpdateDomainSubscriptionInput
): Promise<DomainSubscription | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .update(input)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating subscription by Stripe ID:', error)
    return null
  }

  return data
}

/**
 * Get active subscriptions count for a lead
 */
export async function getActiveSubscriptionCount(leadId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('domain_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('status', 'active')

  if (error) {
    console.error('Error counting subscriptions:', error)
    return 0
  }

  return count || 0
}

/**
 * Get the highest tier among active subscriptions for a lead
 * Used for account-level feature flags
 */
export async function getHighestTierForLead(leadId: string): Promise<SubscriptionTier | 'free'> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('tier')
    .eq('lead_id', leadId)
    .eq('status', 'active')

  if (error || !data || data.length === 0) {
    return 'free'
  }

  // pro > starter
  const tiers = data.map((d: { tier: string }) => d.tier as SubscriptionTier)
  if (tiers.includes('pro')) return 'pro'
  if (tiers.includes('starter')) return 'starter'
  return 'free'
}

// ============================================
// REPORT QUERIES
// ============================================

export interface SubscriptionReport {
  id: string
  url_token: string
  visibility_score: number | null
  platform_scores: Record<string, number> | null
  created_at: string
}

/**
 * Get all reports for a domain subscription
 */
export async function getReportsForSubscription(subscriptionId: string): Promise<SubscriptionReport[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('scan_runs')
    .select(`
      id,
      created_at,
      reports (
        id,
        url_token,
        visibility_score,
        platform_scores
      )
    `)
    .eq('domain_subscription_id', subscriptionId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reports:', error)
    return []
  }

  const reports: SubscriptionReport[] = []
  for (const run of data || []) {
    const reportData = Array.isArray(run.reports) ? run.reports[0] : run.reports
    if (reportData?.url_token) {
      reports.push({
        id: reportData.id,
        url_token: reportData.url_token,
        visibility_score: reportData.visibility_score,
        platform_scores: reportData.platform_scores,
        created_at: run.created_at,
      })
    }
  }

  return reports
}

// ============================================
// SCHEDULE HELPERS
// ============================================

/**
 * Get all active subscriptions due for scanning
 * Used by the hourly scan dispatcher
 */
export async function getSubscriptionsDueForScan(
  dayOfWeek: number,
  hourOfDay: number,
  timezone: string
): Promise<Array<Pick<DomainSubscription, 'id' | 'lead_id' | 'domain'>>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('id, lead_id, domain')
    .eq('status', 'active')
    .eq('scan_schedule_day', dayOfWeek)
    .eq('scan_schedule_hour', hourOfDay)
    .eq('scan_timezone', timezone)

  if (error) {
    console.error('Error fetching subscriptions for scan:', error)
    return []
  }

  return data || []
}

/**
 * Get all unique timezones with active subscriptions for a given day/hour
 * Used by the hourly scan dispatcher to know which timezones to check
 */
export async function getActiveScheduleTimezones(): Promise<string[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('scan_timezone')
    .eq('status', 'active')

  if (error) {
    console.error('Error fetching timezones:', error)
    return []
  }

  // Deduplicate timezones
  const timezones = new Set<string>(data?.map((d: { scan_timezone: string }) => d.scan_timezone) || [])
  return Array.from(timezones)
}
