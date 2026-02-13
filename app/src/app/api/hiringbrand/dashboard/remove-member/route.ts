/**
 * HiringBrand Remove Member API
 * Removes a team member from the organization (owner or admin).
 * Admin can only remove viewers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { removeOrganizationMember } from '@/lib/organization'

export async function DELETE(request: NextRequest) {
  try {
    const { org, role: callerRole } = await requireHBAdmin()

    const { leadId } = await request.json()

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const removed = await removeOrganizationMember(org.id, leadId, callerRole)
    if (!removed) {
      return NextResponse.json(
        { error: 'Failed to remove member. You may not have permission to remove this user.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Remove member error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
