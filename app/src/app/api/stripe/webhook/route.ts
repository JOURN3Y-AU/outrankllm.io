import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, getTierFromPriceId } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import {
  getSubscriptionByStripeId,
  updateSubscriptionByStripeId,
  updateDomainSubscription,
  getHighestTierForLead,
} from '@/lib/subscriptions'

// Use service role client for webhook operations (no user session)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session
) {
  const leadId = session.metadata?.lead_id
  const tier = session.metadata?.tier
  const domain = session.metadata?.domain
  const domainSubscriptionId = session.metadata?.domain_subscription_id
  const subscriptionId = session.subscription as string

  if (!leadId || !subscriptionId) {
    console.error('Missing lead_id or subscription in checkout session')
    return
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription
  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id
  const resolvedTier = tier || getTierFromPriceId(priceId) || 'pro'

  // Get period dates from subscription item
  const currentPeriodStart = subscriptionItem?.current_period_start
  const currentPeriodEnd = subscriptionItem?.current_period_end

  // Check if this is a domain subscription (new flow) or legacy subscription
  if (domainSubscriptionId) {
    // New domain subscription flow
    await handleDomainSubscriptionCheckout(
      supabase,
      domainSubscriptionId,
      subscriptionId,
      priceId,
      resolvedTier,
      subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
      subscription.cancel_at_period_end,
      leadId,
      domain
    )
  } else {
    // Legacy flow - update old subscriptions table
    await handleLegacyCheckout(
      supabase,
      leadId,
      subscriptionId,
      priceId,
      resolvedTier,
      subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
      subscription.cancel_at_period_end
    )
  }

  console.log(`Subscription created for lead ${leadId}, tier: ${resolvedTier}`)
}

async function handleDomainSubscriptionCheckout(
  supabase: ReturnType<typeof createServiceClient>,
  domainSubscriptionId: string,
  stripeSubscriptionId: string,
  priceId: string | undefined,
  tier: string,
  status: string,
  currentPeriodStart: number | undefined,
  currentPeriodEnd: number | undefined,
  cancelAtPeriodEnd: boolean,
  leadId: string,
  domain: string | undefined
) {
  // Update domain_subscription record
  const updated = await updateDomainSubscription(domainSubscriptionId, {
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: priceId,
    tier: tier as 'starter' | 'pro',
    status: status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete',
    current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : undefined,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : undefined,
    cancel_at_period_end: cancelAtPeriodEnd,
  })

  if (!updated) {
    console.error('Failed to update domain subscription:', domainSubscriptionId)
    throw new Error('Failed to update domain subscription')
  }

  // Update lead tier to highest active tier
  const highestTier = await getHighestTierForLead(leadId)
  await supabase
    .from('leads')
    .update({ tier: highestTier })
    .eq('id', leadId)

  // Find existing scans for THIS SPECIFIC DOMAIN - they may not have domain_subscription_id yet
  // because the free scan was created before the subscription
  // CRITICAL: Only link scans matching this domain, not all scans for the lead
  let scanRuns: { id: string }[] | null = null

  if (domain) {
    // Find scans by lead_id AND domain (covers free scans that predate subscription)
    const { data: domainScans } = await supabase
      .from('scan_runs')
      .select('id')
      .eq('lead_id', leadId)
      .eq('domain', domain)  // CRITICAL: Only match scans for THIS domain
      .eq('status', 'complete')
      .order('created_at', { ascending: false })

    if (domainScans && domainScans.length > 0) {
      scanRuns = domainScans

      // Link only these domain-matching scans to the new domain subscription
      const scanIds = domainScans.map((s) => s.id)
      await supabase
        .from('scan_runs')
        .update({ domain_subscription_id: domainSubscriptionId })
        .in('id', scanIds)

      console.log(`Linked ${scanIds.length} scans for ${domain} to domain subscription ${domainSubscriptionId}`)
    }
  }

  // Fall back to scans already linked to this domain_subscription_id
  if (!scanRuns || scanRuns.length === 0) {
    const { data: linkedScans } = await supabase
      .from('scan_runs')
      .select('id')
      .eq('domain_subscription_id', domainSubscriptionId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)

    scanRuns = linkedScans
  }

  if (scanRuns && scanRuns.length > 0) {
    const latestScanId = scanRuns[0].id

    // Remove expiry and mark as subscriber
    await supabase
      .from('reports')
      .update({ expires_at: null, subscriber_only: true })
      .eq('run_id', latestScanId)

    // Mark the scan as pending enrichment
    await supabase
      .from('scan_runs')
      .update({ enrichment_status: 'pending' })
      .eq('id', latestScanId)

    // Dispatch enrichment job via Inngest
    await inngest.send({
      name: 'subscriber/enrich',
      data: {
        leadId,
        scanRunId: latestScanId,
        domainSubscriptionId,
      },
    })

    console.log(`Enrichment triggered for scan ${latestScanId}`)
  } else if (domain) {
    // No existing scan for this domain - trigger a new scan
    // Get lead email for the scan
    const { data: lead } = await supabase
      .from('leads')
      .select('email')
      .eq('id', leadId)
      .single()

    if (lead?.email) {
      await inngest.send({
        name: 'scan/process',
        data: {
          scanId: null, // Will be created in first step
          domain,
          email: lead.email,
          leadId,
          domainSubscriptionId,
          skipEmail: false, // Send scan complete email
        },
      })

      console.log(`New scan triggered for domain ${domain}`)
    } else {
      console.error(`Could not find email for lead ${leadId} to trigger scan`)
    }
  }
}

async function handleLegacyCheckout(
  supabase: ReturnType<typeof createServiceClient>,
  leadId: string,
  subscriptionId: string,
  priceId: string | undefined,
  resolvedTier: string,
  status: string,
  currentPeriodStart: number | undefined,
  currentPeriodEnd: number | undefined,
  cancelAtPeriodEnd: boolean
) {
  // Create subscription record (legacy table)
  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      lead_id: leadId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: status,
      tier: resolvedTier,
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelAtPeriodEnd,
    },
    { onConflict: 'stripe_subscription_id' }
  )

  if (subError) {
    console.error('Error creating subscription:', subError)
    throw subError
  }

  // Update lead tier
  const { error: leadError } = await supabase
    .from('leads')
    .update({ tier: resolvedTier })
    .eq('id', leadId)

  if (leadError) {
    console.error('Error updating lead tier:', leadError)
    throw leadError
  }

  // Remove expiry from any reports for this lead (they're now a subscriber)
  const { data: scanRuns } = await supabase
    .from('scan_runs')
    .select('id')
    .eq('lead_id', leadId)

  if (scanRuns && scanRuns.length > 0) {
    const runIds = scanRuns.map((r) => r.id)
    await supabase
      .from('reports')
      .update({ expires_at: null, subscriber_only: true })
      .in('run_id', runIds)

    // Trigger enrichment for the latest scan (brand awareness, action plans)
    const latestScanId = scanRuns[0].id

    // Mark the scan as pending enrichment
    await supabase
      .from('scan_runs')
      .update({ enrichment_status: 'pending' })
      .eq('id', latestScanId)

    // Dispatch enrichment job via Inngest
    await inngest.send({
      name: 'subscriber/enrich',
      data: {
        leadId,
        scanRunId: latestScanId,
      },
    })

    console.log(`Enrichment triggered for scan ${latestScanId}`)
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id
  const tier = getTierFromPriceId(priceId) || 'pro'

  // Get period dates from subscription item
  const currentPeriodStart = subscriptionItem?.current_period_start
  const currentPeriodEnd = subscriptionItem?.current_period_end

  // Try to find in domain_subscriptions first (new flow)
  const domainSub = await getSubscriptionByStripeId(subscription.id)

  if (domainSub) {
    // Update domain_subscriptions
    await updateSubscriptionByStripeId(subscription.id, {
      stripe_price_id: priceId,
      status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete',
      tier: tier as 'starter' | 'pro',
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : undefined,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : undefined,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })

    // Update lead tier to highest active
    if (subscription.status === 'active') {
      const highestTier = await getHighestTierForLead(domainSub.lead_id)
      await supabase
        .from('leads')
        .update({ tier: highestTier })
        .eq('id', domainSub.lead_id)
    }

    console.log(`Domain subscription updated: ${subscription.id}, status: ${subscription.status}`)
    return
  }

  // Fall back to legacy subscriptions table
  const { data: existingSub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('lead_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (fetchError || !existingSub) {
    console.error('Subscription not found for update:', subscription.id)
    return
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      stripe_price_id: priceId,
      status: subscription.status,
      tier: tier,
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (updateError) {
    console.error('Error updating subscription:', updateError)
    throw updateError
  }

  // Update lead tier if subscription is active
  if (subscription.status === 'active') {
    await supabase
      .from('leads')
      .update({ tier: tier })
      .eq('id', existingSub.lead_id)
  }

  console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  // Try to find in domain_subscriptions first (new flow)
  const domainSub = await getSubscriptionByStripeId(subscription.id)

  if (domainSub) {
    // Update domain_subscription status
    await updateSubscriptionByStripeId(subscription.id, {
      status: 'canceled',
    })

    // Update lead tier to highest remaining active subscription (or free)
    const highestTier = await getHighestTierForLead(domainSub.lead_id)
    await supabase
      .from('leads')
      .update({ tier: highestTier })
      .eq('id', domainSub.lead_id)

    // Re-add expiry to reports for this domain subscription only
    const { data: scanRuns } = await supabase
      .from('scan_runs')
      .select('id')
      .eq('domain_subscription_id', domainSub.id)

    if (scanRuns && scanRuns.length > 0) {
      const runIds = scanRuns.map((r) => r.id)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      await supabase
        .from('reports')
        .update({ expires_at: expiresAt.toISOString(), subscriber_only: false })
        .in('run_id', runIds)
    }

    console.log(`Domain subscription canceled: ${domainSub.id} for lead ${domainSub.lead_id}`)
    return
  }

  // Fall back to legacy subscriptions table
  const { data: existingSub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('lead_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (fetchError || !existingSub) {
    console.error('Subscription not found for deletion:', subscription.id)
    return
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (updateError) {
    console.error('Error updating canceled subscription:', updateError)
  }

  // Revert lead to free tier
  await supabase.from('leads').update({ tier: 'free' }).eq('id', existingSub.lead_id)

  // Re-add expiry to reports (7 days from now)
  const { data: scanRuns } = await supabase
    .from('scan_runs')
    .select('id')
    .eq('lead_id', existingSub.lead_id)

  if (scanRuns && scanRuns.length > 0) {
    const runIds = scanRuns.map((r) => r.id)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase
      .from('reports')
      .update({ expires_at: expiresAt.toISOString(), subscriber_only: false })
      .in('run_id', runIds)
  }

  console.log(`Subscription canceled for lead ${existingSub.lead_id}`)
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice
) {
  // Get subscription ID from invoice parent (new Stripe API structure)
  const subscriptionDetails = invoice.parent?.subscription_details
  const subscription = subscriptionDetails?.subscription
  const subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id
  if (!subscriptionId) return

  // Try to update in domain_subscriptions first
  const domainSub = await getSubscriptionByStripeId(subscriptionId)

  if (domainSub) {
    await updateSubscriptionByStripeId(subscriptionId, {
      status: 'past_due',
    })
    console.log(`Payment failed for domain subscription: ${subscriptionId}`)
    return
  }

  // Fall back to legacy subscriptions table
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('Error updating subscription to past_due:', error)
  }

  console.log(`Payment failed for subscription: ${subscriptionId}`)
}
