import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, getTierFromPriceId } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

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

  // Create subscription record
  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      lead_id: leadId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: subscription.status,
      tier: resolvedTier,
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
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
  const { error: reportError } = await supabase
    .from('reports')
    .update({ expires_at: null, subscriber_only: true })
    .eq(
      'run_id',
      supabase.from('scan_runs').select('id').eq('lead_id', leadId)
    )

  // Alternative: Update via join query
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
  }

  console.log(`Subscription created for lead ${leadId}, tier: ${resolvedTier}`)
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

  // Update subscription record
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
  // Get lead ID before updating
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

  // Re-add expiry to reports (3 days from now)
  const { data: scanRuns } = await supabase
    .from('scan_runs')
    .select('id')
    .eq('lead_id', existingSub.lead_id)

  if (scanRuns && scanRuns.length > 0) {
    const runIds = scanRuns.map((r) => r.id)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 3)

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

  // Update subscription status to past_due
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
