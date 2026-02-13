/**
 * HiringBrand Invite Info API
 * Returns invite details for the invite acceptance page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInviteByToken, getOrganizationById } from '@/lib/organization'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token parameter is required' },
        { status: 400 }
      )
    }

    const invite = await getInviteByToken(token)
    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite link' },
        { status: 404 }
      )
    }

    const org = await getOrganizationById(invite.organization_id)

    return NextResponse.json({
      email: invite.email,
      organizationName: org?.name || 'Unknown Organization',
      role: invite.role || 'viewer',
      expired: new Date(invite.expires_at) < new Date(),
      alreadyAccepted: !!invite.accepted_at,
    })
  } catch (error) {
    console.error('Invite info error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
