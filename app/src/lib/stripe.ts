import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

// Price IDs from environment
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  agency: process.env.STRIPE_PRICE_AGENCY!,
} as const

export type SubscriptionTier = keyof typeof STRIPE_PRICES

// Map price IDs back to tier names
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  const entries = Object.entries(STRIPE_PRICES) as [SubscriptionTier, string][]
  const found = entries.find(([, id]) => id === priceId)
  return found ? found[0] : null
}

// Tier display names
export const TIER_NAMES: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

// Tier prices (AUD) - kept manually aligned with Stripe
export const TIER_PRICES: Record<SubscriptionTier, number> = {
  starter: 49,
  pro: 79,
  agency: 199,
}
