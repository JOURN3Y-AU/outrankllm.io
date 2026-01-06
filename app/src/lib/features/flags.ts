import { createServiceClient } from '@/lib/supabase/server'

export type Tier = 'free' | 'pro' | 'enterprise'

export interface FeatureFlags {
  blurCompetitors: boolean
  showAllCompetitors: boolean
  editablePrompts: boolean
  showPrdTasks: boolean
  geoEnhancedPrompts: boolean
  unlimitedScans: boolean
  exportReports: boolean
}

// Default flags if database is unavailable
const DEFAULT_FLAGS: FeatureFlags = {
  blurCompetitors: true,
  showAllCompetitors: false,
  editablePrompts: false,
  showPrdTasks: false,
  geoEnhancedPrompts: true,
  unlimitedScans: false,
  exportReports: false,
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
}

// Cache feature flags for performance (5 minute TTL)
let flagsCache: { flags: FeatureFlags; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get feature flags for a specific tier
 */
export async function getFeatureFlags(tier: Tier = 'free'): Promise<FeatureFlags> {
  try {
    // Check cache first
    if (flagsCache && Date.now() - flagsCache.timestamp < CACHE_TTL) {
      return applyTierToFlags(flagsCache.flags, tier)
    }

    const supabase = createServiceClient()

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('name, enabled_for_tiers')

    if (error || !flags) {
      console.error('Failed to fetch feature flags:', error)
      return applyTierToFlags(DEFAULT_FLAGS, tier)
    }

    // Build flags object from database
    const dbFlags: Partial<Record<keyof FeatureFlags, string[]>> = {}

    for (const flag of flags) {
      const propName = FLAG_NAME_MAP[flag.name]
      if (propName) {
        dbFlags[propName] = flag.enabled_for_tiers || []
      }
    }

    // Cache the raw flags
    flagsCache = {
      flags: buildFlagsFromDb(dbFlags),
      timestamp: Date.now()
    }

    return applyTierToFlags(flagsCache.flags, tier)

  } catch (error) {
    console.error('Feature flags error:', error)
    return applyTierToFlags(DEFAULT_FLAGS, tier)
  }
}

/**
 * Build flags object from database data
 * This stores which tiers have access to each flag
 */
function buildFlagsFromDb(dbFlags: Partial<Record<keyof FeatureFlags, string[]>>): FeatureFlags {
  // Store tier arrays as serialized flags for later tier-specific resolution
  // For now, we'll store the actual boolean values for 'free' tier as default
  return {
    blurCompetitors: (dbFlags.blurCompetitors || ['free']).includes('free'),
    showAllCompetitors: (dbFlags.showAllCompetitors || []).includes('free'),
    editablePrompts: (dbFlags.editablePrompts || []).includes('free'),
    showPrdTasks: (dbFlags.showPrdTasks || []).includes('free'),
    geoEnhancedPrompts: (dbFlags.geoEnhancedPrompts || ['free']).includes('free'),
    unlimitedScans: (dbFlags.unlimitedScans || []).includes('free'),
    exportReports: (dbFlags.exportReports || []).includes('free'),
  }
}

/**
 * Apply tier-specific logic to flags
 */
function applyTierToFlags(baseFlags: FeatureFlags, tier: Tier): FeatureFlags {
  // Free tier gets default flags
  if (tier === 'free') {
    return {
      blurCompetitors: true,
      showAllCompetitors: false,
      editablePrompts: false,
      showPrdTasks: false,
      geoEnhancedPrompts: true,
      unlimitedScans: false,
      exportReports: false,
    }
  }

  // Pro tier
  if (tier === 'pro') {
    return {
      blurCompetitors: false,
      showAllCompetitors: true,
      editablePrompts: true,
      showPrdTasks: true,
      geoEnhancedPrompts: true,
      unlimitedScans: true,
      exportReports: true,
    }
  }

  // Enterprise tier (all features)
  if (tier === 'enterprise') {
    return {
      blurCompetitors: false,
      showAllCompetitors: true,
      editablePrompts: true,
      showPrdTasks: true,
      geoEnhancedPrompts: true,
      unlimitedScans: true,
      exportReports: true,
    }
  }

  return baseFlags
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  flags: FeatureFlags,
  feature: keyof FeatureFlags
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

/**
 * Clear the feature flags cache (useful for testing or admin updates)
 */
export function clearFlagsCache(): void {
  flagsCache = null
}
