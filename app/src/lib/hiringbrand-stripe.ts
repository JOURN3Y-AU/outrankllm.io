/**
 * HiringBrand.io Stripe configuration
 * Organization-based pricing with tiered domain limits
 */

import { stripe } from './stripe'
import type { OrganizationTier } from './organization'

// Re-export stripe client
export { stripe }

// Pricing regions (same as outrankllm)
export type PricingRegion = 'AU' | 'INTL'
export type BillingFrequency = 'monthly' | 'annual'

// Tier display names
export const HB_TIER_NAMES: Record<OrganizationTier, string> = {
  brand: 'Brand',
  agency_10: 'Agency 10',
  agency_20: 'Agency 20',
  enterprise: 'Enterprise',
}

// Tier prices by region (monthly)
export const HB_TIER_PRICES: Record<PricingRegion, Record<Exclude<OrganizationTier, 'enterprise'>, number>> = {
  AU: {
    brand: 99,
    agency_10: 449,
    agency_20: 899, // ~$899 AUD target
  },
  INTL: {
    brand: 79,
    agency_10: 349,
    agency_20: 599,
  },
}

// Annual pricing (10 months = 12 months, i.e. 2 months free)
export const HB_ANNUAL_MULTIPLIER = 10

// Currency symbols by region
export const HB_CURRENCY_SYMBOL: Record<PricingRegion, string> = {
  AU: 'A$',
  INTL: '$',
}

// Currency codes
export const HB_CURRENCY_CODE: Record<PricingRegion, string> = {
  AU: 'AUD',
  INTL: 'USD',
}

// Get annual price (monthly × 10)
export function getAnnualPrice(
  tier: Exclude<OrganizationTier, 'enterprise'>,
  region: PricingRegion
): number {
  return HB_TIER_PRICES[region][tier] * HB_ANNUAL_MULTIPLIER
}

// Environment variable names for Stripe price IDs
// Structure: STRIPE_HB_{TIER}_{FREQUENCY}_{REGION}
// Example: STRIPE_HB_BRAND_MONTHLY_AU, STRIPE_HB_AGENCY10_ANNUAL_USD
const getPriceEnvVar = (
  tier: Exclude<OrganizationTier, 'enterprise'>,
  frequency: BillingFrequency,
  region: PricingRegion
): string => {
  const tierKey = tier.replace('_', '').toUpperCase() // agency_10 -> AGENCY10
  return `STRIPE_HB_${tierKey}_${frequency.toUpperCase()}_${region}`
}

// Get Stripe price ID from environment
export function getHBPriceId(
  tier: Exclude<OrganizationTier, 'enterprise'>,
  frequency: BillingFrequency,
  region: PricingRegion
): string | undefined {
  const envVar = getPriceEnvVar(tier, frequency, region)
  return process.env[envVar]
}

// Price ID structure (will be populated from env vars)
export const HB_STRIPE_PRICES: Record<
  PricingRegion,
  Record<BillingFrequency, Partial<Record<Exclude<OrganizationTier, 'enterprise'>, string>>>
> = {
  AU: {
    monthly: {
      brand: process.env.STRIPE_HB_BRAND_MONTHLY_AU,
      agency_10: process.env.STRIPE_HB_AGENCY10_MONTHLY_AU,
      agency_20: process.env.STRIPE_HB_AGENCY20_MONTHLY_AU,
    },
    annual: {
      brand: process.env.STRIPE_HB_BRAND_ANNUAL_AU,
      agency_10: process.env.STRIPE_HB_AGENCY10_ANNUAL_AU,
      agency_20: process.env.STRIPE_HB_AGENCY20_ANNUAL_AU,
    },
  },
  INTL: {
    monthly: {
      brand: process.env.STRIPE_HB_BRAND_MONTHLY_USD,
      agency_10: process.env.STRIPE_HB_AGENCY10_MONTHLY_USD,
      agency_20: process.env.STRIPE_HB_AGENCY20_MONTHLY_USD,
    },
    annual: {
      brand: process.env.STRIPE_HB_BRAND_ANNUAL_USD,
      agency_10: process.env.STRIPE_HB_AGENCY10_ANNUAL_USD,
      agency_20: process.env.STRIPE_HB_AGENCY20_ANNUAL_USD,
    },
  },
}

// Get tier from price ID
export function getHBTierFromPriceId(priceId: string): OrganizationTier | null {
  for (const region of ['AU', 'INTL'] as PricingRegion[]) {
    for (const frequency of ['monthly', 'annual'] as BillingFrequency[]) {
      const prices = HB_STRIPE_PRICES[region][frequency]
      for (const [tier, id] of Object.entries(prices)) {
        if (id === priceId) {
          return tier as OrganizationTier
        }
      }
    }
  }
  return null
}

// Check if a price ID is a HiringBrand price
export function isHiringBrandPrice(priceId: string): boolean {
  return getHBTierFromPriceId(priceId) !== null
}

// Domain limits per tier
export const HB_DOMAIN_LIMITS: Record<OrganizationTier, number> = {
  brand: 1,
  agency_10: 10,
  agency_20: 20,
  enterprise: 100,
}

// Feature flags per tier
export interface HBFeatureFlags {
  unlimitedCompetitors: boolean
  unlimitedUsers: boolean
  fullReports: boolean
  weeklyScans: boolean
  teamManagement: boolean
  domainLimit: number
}

export function getHBFeatureFlags(tier: OrganizationTier): HBFeatureFlags {
  // All tiers get the same features, just different domain limits
  return {
    unlimitedCompetitors: true,
    unlimitedUsers: true,
    fullReports: true,
    weeklyScans: true,
    teamManagement: tier !== 'brand', // Brand has 1 domain so teams less relevant
    domainLimit: HB_DOMAIN_LIMITS[tier],
  }
}
