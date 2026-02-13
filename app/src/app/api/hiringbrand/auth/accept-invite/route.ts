/**
 * HiringBrand Accept Invite API
 * Creates an account (or uses existing) for invited team members.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'
import { getInviteByToken, acceptInvite } from '@/lib/organization'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    const { token, name, password } = await request.json()

    if (!token || !name || !password) {
      return NextResponse.json(
        { error: 'token, name, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Look up the invite
    const invite = await getInviteByToken(token)
    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite link' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired. Please ask your admin to send a new one.' },
        { status: 400 }
      )
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invite has already been used. Please login instead.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const email = invite.email

    // Find or create the lead
    let leadId: string
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, email, tier, password_hash')
      .eq('email', email)
      .single()

    if (existingLead) {
      leadId = existingLead.id

      // If they don't have a password yet, set it
      if (!existingLead.password_hash) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
        await supabase
          .from('leads')
          .update({
            name,
            password_hash: passwordHash,
            password_set_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          })
          .eq('id', leadId)
      } else {
        // Just update name and last login
        await supabase
          .from('leads')
          .update({
            name,
            last_login_at: new Date().toISOString(),
          })
          .eq('id', leadId)
      }
    } else {
      // Create new lead
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          email,
          name,
          tier: 'free',
          password_hash: passwordHash,
          password_set_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        })
        .select('id, email, tier')
        .single()

      if (leadError || !newLead) {
        console.error('Error creating lead for invite:', leadError)
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        )
      }

      leadId = newLead.id
    }

    // Accept the invite (adds member to org, marks invite accepted)
    const accepted = await acceptInvite(token, leadId)
    if (!accepted) {
      return NextResponse.json(
        { error: 'Failed to accept invite. You may already belong to an organization.' },
        { status: 400 }
      )
    }

    // Get lead for session creation
    const { data: lead } = await supabase
      .from('leads')
      .select('id, email, tier')
      .eq('id', leadId)
      .single()

    if (!lead) {
      return NextResponse.json(
        { error: 'Account error' },
        { status: 500 }
      )
    }

    // Create session
    const sessionToken = createSessionToken({
      lead_id: lead.id,
      email: lead.email,
      tier: lead.tier,
    })

    const response = NextResponse.json({
      success: true,
      organizationId: invite.organization_id,
    })
    response.cookies.set('outrankllm-session', sessionToken, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
