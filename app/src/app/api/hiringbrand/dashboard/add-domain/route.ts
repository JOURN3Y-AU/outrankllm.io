/**
 * HiringBrand Add Domain API
 * Adds a new monitored domain and triggers an initial scan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { canAddPrimaryDomain, addMonitoredDomain } from '@/lib/organization'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  try {
    const { session, org } = await requireHBAdmin()

    const { domain, companyName } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    // Clean domain
    const cleanDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')

    // Check domain limit
    const canAdd = await canAddPrimaryDomain(org.id)
    if (!canAdd) {
      return NextResponse.json(
        { error: 'You have reached your domain limit. Upgrade your plan to add more brands.' },
        { status: 403 }
      )
    }

    // Add the domain
    const monitoredDomain = await addMonitoredDomain(org.id, cleanDomain, {
      companyName: companyName || undefined,
      isPrimary: true,
      addedBy: session.lead_id,
    })

    if (!monitoredDomain) {
      return NextResponse.json(
        { error: 'Failed to add domain. It may already exist.' },
        { status: 400 }
      )
    }

    // Trigger initial scan
    await inngest.send({
      name: 'hiringbrand/scan',
      data: {
        domain: cleanDomain,
        organizationId: org.id,
        monitoredDomainId: monitoredDomain.id,
      },
    })

    return NextResponse.json({
      success: true,
      monitoredDomainId: monitoredDomain.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Add domain error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
