import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://outrankllm.io'

export async function POST() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/login', APP_URL))
    }

    const supabase = createServiceClient()

    // Get the lead's Stripe customer ID
    const { data: lead, error } = await supabase
      .from('leads')
      .select('stripe_customer_id')
      .eq('id', session.lead_id)
      .single()

    if (error || !lead?.stripe_customer_id) {
      // No Stripe customer - redirect to pricing
      return NextResponse.redirect(new URL('/pricing', APP_URL))
    }

    // Create a portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: lead.stripe_customer_id,
      return_url: `${APP_URL}/dashboard`,
    })

    return NextResponse.redirect(portalSession.url)
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=portal', APP_URL))
  }
}
