import { createServiceClient } from '@/lib/supabase/server'

export type Tier = 'free' | 'starter' | 'pro' | 'agency'

export interface FeatureFlags {
  isSubscriber: boolean
  tier: Tier
  isTrial: boolean  // True if user is on trial (read-only access to tier features)
  blurCompetitors: boolean
  showAllCompetitors: boolean
  editablePrompts: boolean
  customQuestionLimit: number  // Max total questions: 0 (free - can't edit), 10 (starter), 20 (pro/agency)
  showActionPlans: boolean     // Show full action plans (not teaser)
  showPrdTasks: boolean
  geoEnhancedPrompts: boolean
  unlimitedScans: boolean
  exportReports: boolean
  multiDomain: boolean  // Agency only - multiple domains
}

// Default flags for free tier
const DEFAULT_FLAGS: FeatureFlags = {
  isSubscriber: false,
  tier: 'free',
  isTrial: false,
  blurCompetitors: true,
  showAllCompetitors: false,
  editablePrompts: false,
  customQuestionLimit: 0,
  showActionPlans: false,
  showPrdTasks: false,
  geoEnhancedPrompts: true,
  unlimitedScans: false,
  exportReports: false,
  multiDomain: false,
}

// Map database flag names to TypeScript property names
const FLAG_NAME_MAP: Record<string, keyof FeatureFlags> = {
  'blur_competitors': 'blurCompetitors',
  'show_all_competitors': 'showAllCompetitors',
  'editable_prompts': 'editablePrompts',
  'show_prd_tasks': 'showPrdTasks',
  'geo_enhanced_prompts': 'geoEnhancedPrompts',
  'unlimited_scans': 'unlimitedScans',
  'export_reports': 'exportReports',
  'multi_domain': 'multiDomain',
}

/**
 * Get feature flags for a specific tier
 */
export async function getFeatureFlags(tier: Tier = 'free'): Promise<FeatureFlags> {
  return getFlagsForTier(tier)
}

/**
 * Get flags based on tier
 */
function getFlagsForTier(tier: Tier): FeatureFlags {
  switch (tier) {
    case 'starter':
      return {
        isSubscriber: true,
        tier: 'starter',
        isTrial: false,
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: true,
        customQuestionLimit: 10,
        showActionPlans: true,
        showPrdTasks: false,
        geoEnhancedPrompts: true,
        unlimitedScans: false,
        exportReports: false,
        multiDomain: false,
      }

    case 'pro':
      return {
        isSubscriber: true,
        tier: 'pro',
        isTrial: false,
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: true,
        customQuestionLimit: 20,
        showActionPlans: true,
        showPrdTasks: true,
        geoEnhancedPrompts: true,
        unlimitedScans: true,
        exportReports: true,
        multiDomain: false,
      }

    case 'agency':
      return {
        isSubscriber: true,
        tier: 'agency',
        isTrial: false,
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: true,
        customQuestionLimit: 20,
        showActionPlans: true,
        showPrdTasks: true,
        geoEnhancedPrompts: true,
        unlimitedScans: true,
        exportReports: true,
        multiDomain: true,
      }

    case 'free':
    default:
      return {
        isSubscriber: false,
        tier: 'free',
        isTrial: false,
        blurCompetitors: true,
        showAllCompetitors: false,
        editablePrompts: false,
        customQuestionLimit: 0,
        showActionPlans: false,
        showPrdTasks: false,
        geoEnhancedPrompts: true,
        unlimitedScans: false,
        exportReports: false,
        multiDomain: false,
      }
  }
}

/**
 * Get trial-specific flags (read-only access to Starter features)
 * Trial users can SEE data but can't EDIT (prompts, competitors)
 */
function getTrialFlags(): FeatureFlags {
  return {
    isSubscriber: false,  // Not a subscriber (shows expiry countdown)
    tier: 'starter',      // Starter-level visibility
    isTrial: true,        // Flag for UI to check
    blurCompetitors: false,
    showAllCompetitors: true,
    editablePrompts: false,      // CAN'T edit prompts
    customQuestionLimit: 0,      // CAN'T add questions
    showActionPlans: true,       // CAN see action plans
    showPrdTasks: false,         // No PRD (same as Starter)
    geoEnhancedPrompts: true,
    unlimitedScans: false,
    exportReports: false,
    multiDomain: false,
  }
}

// Boolean feature flags (excludes tier, isSubscriber, isTrial, and customQuestionLimit which is a number)
type BooleanFeatureFlag = keyof Omit<FeatureFlags, 'isSubscriber' | 'tier' | 'isTrial' | 'customQuestionLimit'>

/**
 * Check if a specific boolean feature is enabled
 */
export function isFeatureEnabled(
  flags: FeatureFlags,
  feature: BooleanFeatureFlag
): boolean {
  return flags[feature] ?? false
}

/**
 * Check if user has an active trial
 */
export async function getUserTrialStatus(leadId: string): Promise<{
  isOnTrial: boolean
  trialTier: Tier | null
  trialExpiresAt: Date | null
}> {
  try {
    const supabase = createServiceClient()
    const { data: lead } = await supabase
      .from('leads')
      .select('trial_tier, trial_expires_at')
      .eq('id', leadId)
      .single()

    if (lead?.trial_tier && lead?.trial_expires_at) {
      const trialExpiry = new Date(lead.trial_expires_at)
      if (trialExpiry > new Date()) {
        return {
          isOnTrial: true,
          trialTier: lead.trial_tier as Tier,
          trialExpiresAt: trialExpiry,
        }
      }
    }
    return { isOnTrial: false, trialTier: null, trialExpiresAt: null }
  } catch {
    return { isOnTrial: false, trialTier: null, trialExpiresAt: null }
  }
}

/**
 * Get paid subscription tier (checks domain_subscriptions and legacy subscriptions)
 * Returns 'free' if no active paid subscription
 */
async function getPaidTier(leadId: string): Promise<Tier> {
  try {
    const supabase = createServiceClient()

    // Check domain_subscriptions FIRST (new multi-domain flow)
    // This is critical for second+ domain subscriptions
    const { data: domainSubs } = await supabase
      .from('domain_subscriptions')
      .select('tier')
      .eq('lead_id', leadId)
      .eq('status', 'active')

    if (domainSubs && domainSubs.length > 0) {
      // Return highest tier among active domain subscriptions
      const tiers = domainSubs.map((d: { tier: string }) => d.tier)
      if (tiers.includes('agency')) return 'agency'
      if (tiers.includes('pro')) return 'pro'
      if (tiers.includes('starter')) return 'starter'
    }

    // Legacy: Check old subscriptions table for backward compatibility
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .single()

    if (subscription?.tier) {
      return subscription.tier as Tier
    }

    return 'free'
  } catch {
    return 'free'
  }
}

/**
 * Get user tier from lead ID (checks for active subscription, then trial)
 *
 * Priority order (PAID ALWAYS WINS):
 * 1. domain_subscriptions (new multi-domain flow)
 * 2. legacy subscriptions table
 * 3. active trial (trial_tier + trial_expires_at)
 * 4. leads.tier field (fallback)
 */
export async function getUserTier(leadId: string): Promise<Tier> {
  try {
    const supabase = createServiceClient()

    // Check domain_subscriptions FIRST (new multi-domain flow)
    // This is critical for second+ domain subscriptions
    const { data: domainSubs } = await supabase
      .from('domain_subscriptions')
      .select('tier')
      .eq('lead_id', leadId)
      .eq('status', 'active')

    if (domainSubs && domainSubs.length > 0) {
      // Return highest tier among active domain subscriptions
      const tiers = domainSubs.map((d: { tier: string }) => d.tier)
      if (tiers.includes('agency')) return 'agency'
      if (tiers.includes('pro')) return 'pro'
      if (tiers.includes('starter')) return 'starter'
    }

    // Legacy: Check old subscriptions table for backward compatibility
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .single()

    if (subscription?.tier) {
      return subscription.tier as Tier
    }

    // Check for active trial (only if no paid subscription)
    const trialStatus = await getUserTrialStatus(leadId)
    if (trialStatus.isOnTrial && trialStatus.trialTier) {
      return trialStatus.trialTier
    }

    // Final fallback to lead's tier field
    const { data: lead } = await supabase
      .from('leads')
      .select('tier')
      .eq('id', leadId)
      .single()

    return (lead?.tier as Tier) || 'free'

  } catch {
    return 'free'
  }
}

/**
 * Get feature flags for a specific lead
 *
 * Handles trial users specially - they get read-only access to Starter features
 * (can see data but can't edit prompts/competitors)
 */
export async function getFeatureFlagsForLead(leadId: string): Promise<FeatureFlags> {
  // Check paid subscriptions first - PAID ALWAYS WINS
  const paidTier = await getPaidTier(leadId)
  if (paidTier !== 'free') {
    return getFlagsForTier(paidTier)
  }

  // Check trial - trial users get read-only Starter access
  const trialStatus = await getUserTrialStatus(leadId)
  if (trialStatus.isOnTrial) {
    return getTrialFlags()
  }

  // Free user
  return getFlagsForTier('free')
}
