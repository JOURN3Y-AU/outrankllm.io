import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find lead with a password (has an account)
    const { data: lead } = await supabase
      .from('leads')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .not('password_hash', 'is', null)
      .single()

    // Always return success to prevent user enumeration
    // But only send email if lead exists
    if (lead) {
      // Generate a secure token
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Store the reset token
      await supabase.from('password_reset_tokens').insert({
        lead_id: lead.id,
        token,
        email: lead.email,
        expires_at: expiresAt.toISOString(),
      })

      // Send the reset email
      await sendPasswordResetEmail(lead.email, token)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
