/**
 * HiringBrand.io Verify Organization API
 * Returns organization details for the success page
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationById, getMonitoredDomains } from '@/lib/organization'

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get('org')

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      )
    }

    // Get organization
    const org = await getOrganizationById(orgId)

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get monitored domains
    const domains = await getMonitoredDomains(orgId)
    const primaryDomain = domains.find((d) => d.is_primary)

    return NextResponse.json({
      name: org.name,
      tier: org.tier,
      status: org.status,
      domain: primaryDomain?.domain || null,
      domainCount: domains.filter((d) => d.is_primary).length,
    })
  } catch (error) {
    console.error('Verify org error:', error)
    return NextResponse.json(
      { error: 'Failed to verify organization' },
      { status: 500 }
    )
  }
}
