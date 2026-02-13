/**
 * HiringBrand Run Scan API
 * Triggers a scan for an existing monitored domain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireHBSession } from '@/lib/hiringbrand-auth'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  try {
    const { org } = await requireHBSession()

    const { domain, monitoredDomainId } = await request.json()

    if (!domain || !monitoredDomainId) {
      return NextResponse.json(
        { error: 'domain and monitoredDomainId are required' },
        { status: 400 }
      )
    }

    // Verify the monitored domain belongs to this org
    const supabase = createServiceClient()
    const { data: md } = await supabase
      .from('monitored_domains')
      .select('id, organization_id')
      .eq('id', monitoredDomainId)
      .single()

    if (!md || md.organization_id !== org.id) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    // Trigger the scan
    await inngest.send({
      name: 'hiringbrand/scan',
      data: {
        domain,
        organizationId: org.id,
        monitoredDomainId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Run scan error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
