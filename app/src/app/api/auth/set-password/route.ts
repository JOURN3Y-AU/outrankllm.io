import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    const { sessionId, password } = await request.json()

    if (!sessionId || !password) {
      return NextResponse.json(
        { error: 'Session ID and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Verify the Stripe checkout session
    let session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch {
      return NextResponse.json(
        { error: 'Invalid checkout session' },
        { status: 400 }
      )
    }

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    const leadId = session.metadata?.lead_id
    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID not found in session' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email, tier, password_hash')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Check if password is already set
    if (lead.password_hash) {
      return NextResponse.json(
        { error: 'Password has already been set. Please login instead.' },
        { status: 400 }
      )
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Update the lead with password
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (updateError) {
      console.error('Error setting password:', updateError)
      return NextResponse.json(
        { error: 'Failed to set password' },
        { status: 500 }
      )
    }

    // Create session token and set cookie
    const token = createSessionToken({
      lead_id: lead.id,
      email: lead.email,
      tier: lead.tier,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('outrankllm-session', token, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error('Set password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
