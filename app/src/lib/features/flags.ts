import { createServiceClient } from '@/lib/supabase/server'

export type Tier = 'free' | 'starter' | 'pro' | 'agency'

export interface FeatureFlags {
  isSubscriber: boolean
  tier: Tier
  blurCompetitors: boolean
  showAllCompetitors: boolean
  editablePrompts: boolean
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
  blurCompetitors: true,
  showAllCompetitors: false,
  editablePrompts: false,
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
  const isSubscriber = tier !== 'free'

  switch (tier) {
    case 'starter':
      return {
        isSubscriber: true,
        tier: 'starter',
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: false,
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
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: true,
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
        blurCompetitors: false,
        showAllCompetitors: true,
        editablePrompts: true,
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
        blurCompetitors: true,
        showAllCompetitors: false,
        editablePrompts: false,
        showPrdTasks: false,
        geoEnhancedPrompts: true,
        unlimitedScans: false,
        exportReports: false,
        multiDomain: false,
      }
  }
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  flags: FeatureFlags,
  feature: keyof Omit<FeatureFlags, 'isSubscriber' | 'tier'>
): boolean {
  return flags[feature] ?? false
}

/**
 * Get user tier from lead ID (checks for active subscription)
 */
export async function getUserTier(leadId: string): Promise<Tier> {
  try {
    const supabase = createServiceClient()

    // Check for active subscription first
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .single()

    if (subscription?.tier) {
      return subscription.tier as Tier
    }

    // Fall back to lead's tier field
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
 */
export async function getFeatureFlagsForLead(leadId: string): Promise<FeatureFlags> {
  const tier = await getUserTier(leadId)
  return getFeatureFlags(tier)
}
