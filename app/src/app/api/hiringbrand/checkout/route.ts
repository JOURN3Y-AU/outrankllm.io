/**
 * HiringBrand.io Checkout API
 * Creates Stripe checkout sessions for organization subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createOrganization,
  getOrganizationForUser,
  addMonitoredDomain,
} from '@/lib/organization'
import {
  getHBPriceId,
  type PricingRegion,
  type BillingFrequency,
} from '@/lib/hiringbrand-stripe'
import type { OrganizationTier } from '@/lib/organization'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      organizationName,
      domain, // First employer domain to monitor
      tier = 'agency_20',
      frequency = 'monthly',
      region = 'AU',
    } = body as {
      email: string
      organizationName: string
      domain: string
      tier?: OrganizationTier
      frequency?: BillingFrequency
      region?: PricingRegion
    }

    // Validate required fields
    if (!email || !organizationName || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: email, organizationName, domain' },
        { status: 400 }
      )
    }

    // Get price ID
    if (tier === 'enterprise') {
      return NextResponse.json(
        { error: 'Enterprise tier requires custom pricing. Contact us.' },
        { status: 400 }
      )
    }

    const priceId = getHBPriceId(tier, frequency, region)
    if (!priceId) {
      return NextResponse.json(
        { error: `Price not configured for ${tier} ${frequency} ${region}` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find or create lead
    let leadId: string
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingLead) {
      leadId = existingLead.id

      // Check if user already has an organization
      const existingOrg = await getOrganizationForUser(leadId)
      if (existingOrg) {
        return NextResponse.json(
          { error: 'User already belongs to an organization' },
          { status: 400 }
        )
      }
    } else {
      // Create new lead
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          email: email.toLowerCase(),
          tier: 'free',
        })
        .select('id')
        .single()

      if (leadError || !newLead) {
        console.error('Error creating lead:', leadError)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }

      leadId = newLead.id
    }

    // Create organization (status: incomplete until payment)
    const org = await createOrganization(
      { name: organizationName, tier },
      leadId
    )

    if (!org) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    // Add first monitored domain
    await addMonitoredDomain(org.id, domain, {
      isPrimary: true,
      addedBy: leadId,
    })

    // Get or create Stripe customer
    let stripeCustomerId: string

    const { data: leadWithStripe } = await supabase
      .from('leads')
      .select('stripe_customer_id')
      .eq('id', leadId)
      .single()

    if (leadWithStripe?.stripe_customer_id) {
      stripeCustomerId = leadWithStripe.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: {
          lead_id: leadId,
          organization_id: org.id,
          brand: 'hiringbrand',
        },
      })
      stripeCustomerId = customer.id

      // Save to lead
      await supabase
        .from('leads')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', leadId)
    }

    // Update organization with Stripe customer ID
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', org.id)

    // Create Stripe checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        organization_id: org.id,
        lead_id: leadId,
        tier,
        domain,
        brand: 'hiringbrand',
      },
      subscription_data: {
        metadata: {
          organization_id: org.id,
          lead_id: leadId,
          tier,
          brand: 'hiringbrand',
        },
      },
      success_url: `${appUrl}/hiringbrand/success?org=${org.id}`,
      cancel_url: `${appUrl}/hiringbrand/signup?canceled=true`,
    })

    return NextResponse.json({
      checkoutUrl: session.url,
      organizationId: org.id,
    })
  } catch (error) {
    console.error('HiringBrand checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
