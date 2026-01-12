import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { stripe, getPriceId, type SubscriptionTier, type PricingRegion } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getSubscriptionsWithReports,
  createDomainSubscription,
  getSubscriptionByDomain,
} from '@/lib/subscriptions'

/**
 * GET /api/subscriptions
 * List all domain subscriptions for the current user
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscriptions = await getSubscriptionsWithReports(session.lead_id)

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Validation schema for creating a subscription
const CreateSubscriptionSchema = z.object({
  domain: z.string().min(1).max(255),
  tier: z.enum(['starter', 'pro']),
  region: z.enum(['AU', 'INTL']).optional().default('INTL'),
  leadId: z.string().uuid().optional(), // For first-time subscribers (no account yet)
})

/**
 * POST /api/subscriptions
 * Create a new domain subscription (initiates Stripe checkout)
 *
 * Supports two flows:
 * 1. Authenticated user: Uses session.lead_id
 * 2. First-time subscriber: Uses leadId from body (no account yet, will set password after checkout)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const body = await request.json()
    const result = CreateSubscriptionSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { domain, tier, region, leadId: bodyLeadId } = result.data

    // Determine lead_id: prefer session (authenticated), fallback to body (first-time subscriber)
    const leadId = session?.lead_id || bodyLeadId
    if (!leadId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in or provide a valid lead ID' },
        { status: 401 }
      )
    }

    // Normalize domain (remove protocol, trailing slashes, etc.)
    const normalizedDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .split('/')[0]

    const supabase = createServiceClient()

    // Check if user already has a subscription for this domain
    const existingSubscription = await getSubscriptionByDomain(leadId, normalizedDomain)
    if (existingSubscription) {
      // If there's an incomplete subscription (from a cancelled checkout), delete it and allow retry
      if (existingSubscription.status === 'incomplete') {
        await supabase
          .from('domain_subscriptions')
          .delete()
          .eq('id', existingSubscription.id)
      } else {
        // Active, past_due, trialing, or canceled subscription exists
        return NextResponse.json(
          { error: 'You already have a subscription for this domain' },
          { status: 400 }
        )
      }
    }

    // Get or create Stripe customer
    const { data: lead } = await supabase
      .from('leads')
      .select('stripe_customer_id, email')
      .eq('id', leadId)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    let customerId = lead.stripe_customer_id
    let effectiveRegion = region as PricingRegion

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: lead.email,
        metadata: {
          lead_id: leadId,
        },
      })
      customerId = customer.id

      await supabase
        .from('leads')
        .update({ stripe_customer_id: customerId })
        .eq('id', leadId)
    } else {
      // Customer exists - check if they have existing subscriptions
      // Stripe requires all subscriptions for a customer to be in the same currency
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      })

      if (existingSubscriptions.data.length > 0) {
        const existingCurrency = existingSubscriptions.data[0].currency
        // Map currency to region (aud = AU, usd = INTL)
        effectiveRegion = existingCurrency === 'aud' ? 'AU' : 'INTL'
      }
    }

    // Pre-create domain subscription with 'incomplete' status
    const domainSubscription = await createDomainSubscription({
      lead_id: leadId,
      domain: normalizedDomain,
      tier: tier as SubscriptionTier,
      status: 'incomplete',
    })

    if (!domainSubscription) {
      return NextResponse.json(
        { error: 'Failed to create subscription record' },
        { status: 500 }
      )
    }

    // Build success/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&domain_subscription_id=${domainSubscription.id}`
    const cancelUrl = `${baseUrl}/dashboard?checkout_cancelled=true`

    // Get the correct price ID for this tier and region
    // Use effectiveRegion to ensure currency consistency with existing subscriptions
    const priceId = getPriceId(tier as SubscriptionTier, effectiveRegion)

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        lead_id: leadId,
        domain_subscription_id: domainSubscription.id,
        domain: normalizedDomain,
        tier: tier,
        region: effectiveRegion,
      },
      subscription_data: {
        metadata: {
          lead_id: leadId,
          domain_subscription_id: domainSubscription.id,
          domain: normalizedDomain,
          tier: tier,
          region: effectiveRegion,
        },
      },
    })

    return NextResponse.json({
      url: checkoutSession.url,
      domain_subscription_id: domainSubscription.id,
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
