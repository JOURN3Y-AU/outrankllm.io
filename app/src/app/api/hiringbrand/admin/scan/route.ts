/**
 * HiringBrand Super-Admin Force Refresh
 * POST — Triggers a scan for any monitored domain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireHBSuperAdmin } from '@/lib/hiringbrand-auth'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  try {
    await requireHBSuperAdmin()

    const { domain, organizationId, monitoredDomainId } = await request.json()

    if (!domain || !organizationId || !monitoredDomainId) {
      return NextResponse.json(
        { error: 'domain, organizationId, and monitoredDomainId are required' },
        { status: 400 }
      )
    }

    // Verify the monitored domain exists
    const supabase = createServiceClient()
    const { data: md } = await supabase
      .from('monitored_domains')
      .select('id')
      .eq('id', monitoredDomainId)
      .single()

    if (!md) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    // Trigger the scan via Inngest
    await inngest.send({
      name: 'hiringbrand/scan',
      data: {
        domain,
        organizationId,
        monitoredDomainId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Super admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Admin scan error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
