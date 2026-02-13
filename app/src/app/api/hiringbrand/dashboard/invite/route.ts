/**
 * HiringBrand Invite API
 * Sends a team invite email (owner or admin).
 * Admin can only invite as viewer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { createInvite } from '@/lib/organization'
import type { MemberRole } from '@/lib/organization'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { session, org, role: callerRole } = await requireHBAdmin()

    const { email, role: inviteRole = 'viewer' } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // Validate the invite role
    if (inviteRole !== 'admin' && inviteRole !== 'viewer') {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 })
    }

    // Admin can only invite as viewer
    if (callerRole === 'admin' && inviteRole !== 'viewer') {
      return NextResponse.json(
        { error: 'You can only invite viewers. Contact the account owner to invite admins.' },
        { status: 403 }
      )
    }

    // Create invite record with role
    const invite = await createInvite(org.id, email, session.lead_id, inviteRole as MemberRole)
    if (!invite) {
      return NextResponse.json(
        { error: 'Failed to create invite. The user may already be invited.' },
        { status: 400 }
      )
    }

    // Send invite email — use HB-specific URL so links point to hiringbrand.io
    const appUrl = process.env.HB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/hiringbrand/invite?token=${invite.token}`

    try {
      await resend.emails.send({
        from: 'HiringBrand <noreply@hiringbrand.io>',
        to: email.toLowerCase(),
        subject: `You've been invited to ${org.name} on HiringBrand`,
        html: buildInviteEmailHtml(org.name, session.email, inviteUrl, inviteRole),
      })
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request — invite is created, email just didn't send
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Invite error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildInviteEmailHtml(orgName: string, inviterEmail: string, inviteUrl: string, role: string): string {
  const roleLabel = role === 'admin' ? 'an admin' : 'a viewer'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Source Sans 3',system-ui,sans-serif;background:#F1F5F9;">
  <div style="max-width:520px;margin:40px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <div style="background:#4ABDAC;padding:24px;text-align:center;">
      <span style="font-family:'Outfit',system-ui,sans-serif;font-size:24px;font-weight:700;color:white;">
        hiring<span style="font-weight:800;">brand</span><span style="color:#F7B733;">.io</span>
      </span>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h1 style="font-family:'Outfit',system-ui,sans-serif;font-size:22px;font-weight:700;color:#1E293B;margin:0 0 16px;">
        You've been invited!
      </h1>
      <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 8px;">
        <strong>${inviterEmail}</strong> has invited you to join <strong>${orgName}</strong> as ${roleLabel} on HiringBrand.
      </p>
      <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 28px;">
        HiringBrand monitors how AI platforms describe your company to job seekers. Accept the invite to see your employer brand reports.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:#FC4A1A;color:white;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;font-family:'Outfit',system-ui,sans-serif;">
          Accept Invite
        </a>
      </div>

      <p style="font-size:13px;color:#94A3B8;margin:0;">
        This invite expires in 7 days. If you didn't expect this, you can safely ignore it.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F1F5F9;padding:16px;text-align:center;">
      <p style="font-size:12px;color:#94A3B8;margin:0;">
        &copy; ${new Date().getFullYear()} HiringBrand.io &bull; AI Employer Reputation Intelligence
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
