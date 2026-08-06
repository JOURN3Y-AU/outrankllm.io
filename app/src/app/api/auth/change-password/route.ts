/**
 * Change Password API
 *
 * For users who are already signed in and want to pick a new password without
 * going through the emailed reset flow. Shared by outrankllm and HiringBrand —
 * both products authenticate against the same `leads` row.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, password_hash')
      .eq('id', session.lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // No password set means this account only ever signed in via a setup link.
    // Send them through the reset flow rather than letting them set one here
    // without proving ownership of the mailbox.
    if (!lead.password_hash) {
      return NextResponse.json(
        { error: 'No password is set on this account. Please use the forgot password link.' },
        { status: 400 }
      )
    }

    const valid = await bcrypt.compare(currentPassword, lead.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    if (updateError) {
      console.error('Change password error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
