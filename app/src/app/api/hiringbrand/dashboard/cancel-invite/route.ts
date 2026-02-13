/**
 * HiringBrand Cancel Invite API
 * Cancels a pending invite (owner only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { cancelInvite } from '@/lib/organization'

export async function DELETE(request: NextRequest) {
  try {
    await requireHBAdmin()

    const { inviteId } = await request.json()

    if (!inviteId) {
      return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })
    }

    const canceled = await cancelInvite(inviteId)
    if (!canceled) {
      return NextResponse.json({ error: 'Failed to cancel invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Cancel invite error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
