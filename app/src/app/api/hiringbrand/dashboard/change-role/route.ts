/**
 * HiringBrand Change Role API
 * Changes a team member's role (owner only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBOwner } from '@/lib/hiringbrand-auth'
import { updateMemberRole } from '@/lib/organization'
import type { MemberRole } from '@/lib/organization'

export async function POST(request: NextRequest) {
  try {
    const { org } = await requireHBOwner()

    const { leadId, role } = await request.json()

    if (!leadId || !role) {
      return NextResponse.json({ error: 'leadId and role are required' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'viewer') {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 })
    }

    const updated = await updateMemberRole(org.id, leadId, role as MemberRole)
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to change role. Cannot change the owner role.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Owner access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Change role error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
