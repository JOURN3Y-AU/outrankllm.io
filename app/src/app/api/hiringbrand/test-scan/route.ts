/**
 * HiringBrand Test Scan API
 * Manual endpoint to trigger a scan without going through Stripe
 *
 * Usage: POST /api/hiringbrand/test-scan
 * Body: { domain: "atlassian.com" }
 *
 * This creates a test organization and triggers the scan flow.
 * For development/testing only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'

// Only allow in development
const isDev = process.env.NODE_ENV === 'development'

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  // Block in production
  if (!isDev) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { domain, organizationName } = body

    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Create a test organization
    const orgName = organizationName || `Test Org - ${domain}`
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        brand: 'hiringbrand',
        tier: 'agency_20',
        domain_limit: 20,
        status: 'active',
      })
      .select('id')
      .single()

    if (orgError) {
      // Check if it's a duplicate - try to find existing
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', orgName)
        .single()

      if (existingOrg) {
        // Use existing org
        const { data: existingDomain } = await supabase
          .from('monitored_domains')
          .select('id')
          .eq('organization_id', existingOrg.id)
          .eq('domain', domain)
          .single()

        if (existingDomain) {
          // Trigger scan for existing domain
          await inngest.send({
            name: 'hiringbrand/scan',
            data: {
              domain,
              organizationId: existingOrg.id,
              monitoredDomainId: existingDomain.id,
            },
          })

          return NextResponse.json({
            success: true,
            message: 'Scan triggered for existing org/domain',
            organizationId: existingOrg.id,
            monitoredDomainId: existingDomain.id,
            domain,
          })
        }
      }

      throw new Error(`Failed to create organization: ${orgError.message}`)
    }

    // Add the domain as a monitored domain
    const { data: monitoredDomain, error: domainError } = await supabase
      .from('monitored_domains')
      .insert({
        organization_id: org.id,
        domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        company_name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        is_primary: true,
      })
      .select('id')
      .single()

    if (domainError) {
      throw new Error(`Failed to create monitored domain: ${domainError.message}`)
    }

    // Trigger the scan
    await inngest.send({
      name: 'hiringbrand/scan',
      data: {
        domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        organizationId: org.id,
        monitoredDomainId: monitoredDomain.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Test scan triggered',
      organizationId: org.id,
      organizationName: orgName,
      monitoredDomainId: monitoredDomain.id,
      domain,
      inngestDashboard: 'http://localhost:8288',
    })
  } catch (error) {
    console.error('Test scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger test scan' },
      { status: 500 }
    )
  }
}
