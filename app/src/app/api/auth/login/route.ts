import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find lead with password
    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, email, password_hash, tier')
      .eq('email', email.toLowerCase().trim())
      .not('password_hash', 'is', null)
      .single()

    if (error || !lead) {
      // Generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const valid = await bcrypt.compare(password, lead.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login timestamp
    await supabase
      .from('leads')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', lead.id)

    // Create JWT session token
    const token = createSessionToken({
      lead_id: lead.id,
      email: lead.email,
      tier: lead.tier,
    })

    // Set session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('outrankllm-session', token, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
