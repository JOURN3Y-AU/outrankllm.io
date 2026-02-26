import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe, getPriceId, type SubscriptionTier, type PricingRegion } from '@/lib/stripe'
import {
  createDomainSubscription,
  getSubscriptionByDomain,
} from '@/lib/subscriptions'

const StartRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  domain: z.string().min(3, 'Domain must be at least 3 characters'),
  tier: z.enum(['starter', 'pro']),
  region: z.enum(['AU', 'INTL']).optional().default('INTL'),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the Terms & Conditions',
  }),
})

/**
 * POST /api/start
 *
 * Combined endpoint for the /start page:
 * 1. Creates/upserts lead
 * 2. Creates domain subscription (incomplete)
 * 3. Creates Stripe checkout session
 *
 * Scan is NOT started here — the Stripe webhook (checkout.session.completed)
 * triggers the scan after payment succeeds.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const body = await request.json()
    const result = StartRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, domain, tier, region, agreedToTerms } = result.data

    // Normalize email and domain
    const normalizedEmail = email.toLowerCase().trim()
    const cleanDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .split('/')[0]

    const supabase = createServiceClient()

    // Capture geo headers from Vercel
    const ipCountry = request.headers.get('x-vercel-ip-country')
    const ipCity = request.headers.get('x-vercel-ip-city')
    const ipRegion = request.headers.get('x-vercel-ip-country-region')
    const ipTimezone = request.headers.get('x-vercel-ip-timezone')
    const referralUrl = request.cookies.get('referral_url')?.value || null

    // Step 1: Get or create lead
    let leadId: string

    if (session?.lead_id) {
      // Logged-in user — use existing lead
      leadId = session.lead_id
    } else {
      // New or returning user — upsert lead by email+domain
      const upsertData: Record<string, unknown> = {
        email: normalizedEmail,
        domain: cleanDomain,
        terms_accepted_at: agreedToTerms ? new Date().toISOString() : null,
      }
      if (ipCountry) upsertData.ip_country = ipCountry
      if (ipCity) upsertData.ip_city = ipCity
      if (ipRegion) upsertData.ip_region = ipRegion
      if (ipTimezone) upsertData.ip_timezone = ipTimezone
      if (referralUrl) upsertData.referral_url = referralUrl

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .upsert(upsertData, { onConflict: 'email,domain', ignoreDuplicates: false })
        .select('id')
        .single()

      if (leadError || !lead) {
        console.error('Error creating lead:', leadError)
        return NextResponse.json(
          { error: 'Failed to create account. Please try again.' },
          { status: 500 }
        )
      }

      leadId = lead.id
    }

    // Step 2: Handle existing domain subscriptions
    const existingSubscription = await getSubscriptionByDomain(leadId, cleanDomain)
    if (existingSubscription) {
      if (existingSubscription.status === 'incomplete' || existingSubscription.status === 'canceled') {
        // Delete stale records and allow fresh checkout
        await supabase
          .from('domain_subscriptions')
          .delete()
          .eq('id', existingSubscription.id)
      } else {
        // Active, past_due, or trialing — already subscribed
        return NextResponse.json(
          { error: 'You already have an active subscription for this domain.' },
          { status: 400 }
        )
      }
    }

    // Step 3: Get or create Stripe customer
    const { data: leadData } = await supabase
      .from('leads')
      .select('stripe_customer_id, email')
      .eq('id', leadId)
      .single()

    if (!leadData) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    let customerId = leadData.stripe_customer_id
    let effectiveRegion = region as PricingRegion

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: leadData.email,
        metadata: { lead_id: leadId },
      })
      customerId = customer.id

      await supabase
        .from('leads')
        .update({ stripe_customer_id: customerId })
        .eq('id', leadId)
    } else {
      // Existing customer — enforce currency consistency
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      })

      if (existingSubscriptions.data.length > 0) {
        const existingCurrency = existingSubscriptions.data[0].currency
        effectiveRegion = existingCurrency === 'aud' ? 'AU' : 'INTL'
      }
    }

    // Step 4: Create domain subscription with 'incomplete' status
    const domainSubscription = await createDomainSubscription({
      lead_id: leadId,
      domain: cleanDomain,
      tier: tier as SubscriptionTier,
      status: 'incomplete',
    })

    if (!domainSubscription) {
      return NextResponse.json(
        { error: 'Failed to create subscription record' },
        { status: 500 }
      )
    }

    // Step 5: Create Stripe Checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&domain_subscription_id=${domainSubscription.id}`
    const cancelUrl = `${baseUrl}/start?checkout_cancelled=true&tier=${tier}`

    const priceId = getPriceId(tier as SubscriptionTier, effectiveRegion)

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
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
        domain: cleanDomain,
        tier: tier,
        region: effectiveRegion,
      },
      subscription_data: {
        metadata: {
          lead_id: leadId,
          domain_subscription_id: domainSubscription.id,
          domain: cleanDomain,
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
    console.error('Error in /api/start:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
