import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PRICES, type SubscriptionTier } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, leadId, reportToken } = body as {
      tier: SubscriptionTier
      leadId: string
      reportToken?: string
    }

    // Validate tier
    if (!tier || !STRIPE_PRICES[tier]) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      )
    }

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    // Get lead info from database (use service client to bypass RLS)
    const supabase = createServiceClient()
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email, stripe_customer_id')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Get or create Stripe customer
    let customerId = lead.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: lead.email,
        metadata: {
          lead_id: lead.id,
        },
      })
      customerId = customer.id

      // Store customer ID in database
      await supabase
        .from('leads')
        .update({ stripe_customer_id: customerId })
        .eq('id', lead.id)
    }

    // Build success/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = reportToken
      ? `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&report=${reportToken}`
      : `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = reportToken
      ? `${baseUrl}/pricing?from=report&cancelled=true`
      : `${baseUrl}/pricing?cancelled=true`

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICES[tier],
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        lead_id: lead.id,
        tier: tier,
        report_token: reportToken || '',
      },
      subscription_data: {
        metadata: {
          lead_id: lead.id,
          tier: tier,
        },
      },
      // Enable automatic tax calculation if needed in future
      // automatic_tax: { enabled: true },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
