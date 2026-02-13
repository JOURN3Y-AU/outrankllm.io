/**
 * HiringBrand Remove Domain API
 * Removes a monitored domain (owner only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { removeMonitoredDomain } from '@/lib/organization'

export async function DELETE(request: NextRequest) {
  try {
    const { org } = await requireHBAdmin()

    const { domainId } = await request.json()

    if (!domainId) {
      return NextResponse.json({ error: 'domainId is required' }, { status: 400 })
    }

    // Verify domain belongs to this org
    const supabase = createServiceClient()
    const { data: domain } = await supabase
      .from('monitored_domains')
      .select('id, organization_id')
      .eq('id', domainId)
      .single()

    if (!domain || domain.organization_id !== org.id) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    const removed = await removeMonitoredDomain(domainId)
    if (!removed) {
      return NextResponse.json({ error: 'Failed to remove domain' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Remove domain error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
