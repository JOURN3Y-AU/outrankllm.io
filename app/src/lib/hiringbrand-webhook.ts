/**
 * HiringBrand.io Stripe webhook handlers
 * Handles organization-based subscriptions
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getHBTierFromPriceId, HB_DOMAIN_LIMITS } from './hiringbrand-stripe'
import {
  getOrganizationByStripeId,
  getMonitoredDomains,
  updateOrganization,
  updateOrganizationByStripeId,
  type OrganizationTier,
} from './organization'
import { inngest } from '@/inngest/client'

// Service client for webhook operations
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Handle checkout.session.completed for HiringBrand organizations
 */
export async function handleHBCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
) {
  const organizationId = session.metadata?.organization_id
  const subscriptionId = session.subscription as string

  if (!organizationId || !subscriptionId) {
    console.error('[HB Webhook] Missing organization_id or subscription in checkout session')
    return
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id

  // Get tier from price ID
  const tier = getHBTierFromPriceId(priceId) || 'brand'
  const domainLimit = HB_DOMAIN_LIMITS[tier as OrganizationTier]

  // Get period dates
  const currentPeriodStart = subscriptionItem?.current_period_start
  const currentPeriodEnd = subscriptionItem?.current_period_end

  // Update organization
  const updated = await updateOrganization(organizationId, {
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    tier: tier as OrganizationTier,
    domain_limit: domainLimit,
    status: subscription.status as 'active' | 'past_due' | 'canceled' | 'incomplete',
    current_period_start: currentPeriodStart
      ? new Date(currentPeriodStart * 1000).toISOString()
      : undefined,
    current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : undefined,
    cancel_at_period_end: subscription.cancel_at_period_end,
  })

  if (!updated) {
    console.error('[HB Webhook] Failed to update organization:', organizationId)
    throw new Error('Failed to update organization')
  }

  console.log(`[HB Webhook] Organization ${organizationId} activated with tier: ${tier}`)

  // Trigger first scan for the organization's primary domains
  const domains = await getMonitoredDomains(organizationId)
  const primaryDomains = domains.filter((d) => d.is_primary)

  for (const domain of primaryDomains) {
    await inngest.send({
      name: 'hiringbrand/scan',
      data: {
        domain: domain.domain,
        organizationId,
        monitoredDomainId: domain.id,
      },
    })
    console.log(`[HB Webhook] Triggered scan for ${domain.domain}`)
  }
}

/**
 * Handle customer.subscription.updated for HiringBrand organizations
 */
export async function handleHBSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id

  // Get tier from price ID
  const tier = getHBTierFromPriceId(priceId)
  if (!tier) {
    console.log('[HB Webhook] Not a HiringBrand price, skipping')
    return false // Not a HiringBrand subscription
  }

  const domainLimit = HB_DOMAIN_LIMITS[tier]
  const currentPeriodStart = subscriptionItem?.current_period_start
  const currentPeriodEnd = subscriptionItem?.current_period_end

  // Update organization
  const updated = await updateOrganizationByStripeId(subscription.id, {
    stripe_price_id: priceId,
    tier,
    domain_limit: domainLimit,
    status: subscription.status as 'active' | 'past_due' | 'canceled' | 'incomplete',
    current_period_start: currentPeriodStart
      ? new Date(currentPeriodStart * 1000).toISOString()
      : undefined,
    current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : undefined,
    cancel_at_period_end: subscription.cancel_at_period_end,
  })

  if (!updated) {
    console.error('[HB Webhook] Organization not found for subscription:', subscription.id)
    return false
  }

  console.log(`[HB Webhook] Organization subscription updated: ${subscription.id}, status: ${subscription.status}`)
  return true
}

/**
 * Handle customer.subscription.deleted for HiringBrand organizations
 */
export async function handleHBSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient()

  // Find organization by Stripe subscription ID
  const org = await getOrganizationByStripeId(subscription.id)
  if (!org) {
    console.log('[HB Webhook] Organization not found for deleted subscription:', subscription.id)
    return false
  }

  // Update organization status to canceled
  await updateOrganization(org.id, {
    status: 'canceled',
  })

  // Add expiry to all reports for this organization's domains
  const { data: domains } = await supabase
    .from('monitored_domains')
    .select('domain')
    .eq('organization_id', org.id)

  if (domains && domains.length > 0) {
    const domainList = domains.map((d) => d.domain)

    // Find all scan_runs for these domains
    // Note: This assumes scan_runs will have organization_id once we connect scans
    // For now, we skip report expiry handling - will be added in Phase 3

    console.log(`[HB Webhook] Organization ${org.id} canceled. Domains affected: ${domainList.join(', ')}`)
  }

  console.log(`[HB Webhook] Organization subscription canceled: ${org.id}`)
  return true
}

/**
 * Handle invoice.payment_failed for HiringBrand organizations
 */
export async function handleHBPaymentFailed(invoice: Stripe.Invoice) {
  // Get subscription ID from invoice
  const subscriptionDetails = invoice.parent?.subscription_details
  const subscription = subscriptionDetails?.subscription
  const subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id

  if (!subscriptionId) {
    return false
  }

  // Try to update organization status
  const updated = await updateOrganizationByStripeId(subscriptionId, {
    status: 'past_due',
  })

  if (!updated) {
    return false // Not a HiringBrand subscription
  }

  console.log(`[HB Webhook] Payment failed for organization subscription: ${subscriptionId}`)
  return true
}

/**
 * Check if a Stripe event is for HiringBrand
 * Uses metadata or price ID to determine
 */
export function isHiringBrandEvent(event: Stripe.Event): boolean {
  const obj = event.data.object as unknown as Record<string, unknown>

  // Check metadata for organization_id (indicates HiringBrand checkout)
  if (obj.metadata && typeof obj.metadata === 'object') {
    const metadata = obj.metadata as Record<string, string>
    if (metadata.organization_id) {
      return true
    }
  }

  // Check if it's a subscription with HiringBrand price
  if (event.type.includes('subscription')) {
    const subscription = event.data.object as Stripe.Subscription
    const priceId = subscription.items?.data?.[0]?.price?.id
    if (priceId && getHBTierFromPriceId(priceId)) {
      return true
    }
  }

  return false
}
