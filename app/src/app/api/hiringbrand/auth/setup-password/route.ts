/**
 * HiringBrand Setup Password API
 * Sets password for new account owners after Stripe checkout.
 * Verifies org ownership instead of requiring a Stripe session ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'
import { isOrganizationOwner } from '@/lib/organization'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    const { orgId, email, password } = await request.json()

    if (!orgId || !email || !password) {
      return NextResponse.json(
        { error: 'orgId, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find the lead by email
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email, tier, password_hash')
      .eq('email', email.toLowerCase().trim())
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

    // Verify this user is the owner of the specified organization
    const isOwner = await isOrganizationOwner(lead.id, orgId)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Not authorized for this organization' },
        { status: 403 }
      )
    }

    // Hash and set the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

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
    console.error('Setup password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
