import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find valid reset token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, lead_id, email, expires_at, used_at')
      .eq('token', token)
      .single()

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    // Check if token is already used
    if (resetToken.used_at) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired' },
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update the lead's password
    const { data: lead, error: updateError } = await supabase
      .from('leads')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
      })
      .eq('id', resetToken.lead_id)
      .select('id, email, tier')
      .single()

    if (updateError || !lead) {
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id)

    // Create session and log user in
    const sessionToken = createSessionToken({
      lead_id: lead.id,
      email: lead.email,
      tier: lead.tier,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('outrankllm-session', sessionToken, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
