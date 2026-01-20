import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

// Admin endpoint to force a rescan
// Requires ADMIN_SECRET header for authentication
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const adminSecret = request.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reportToken, email, domain, skipEmail = false, domainSubscriptionId } = body

    if (!reportToken && !email) {
      return NextResponse.json(
        { error: 'Must provide either reportToken or email' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    let leadId: string
    let targetDomain: string
    let targetEmail: string
    let targetDomainSubscriptionId: string | null = domainSubscriptionId || null

    if (reportToken) {
      // Look up lead from report token
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select(`
          id,
          scan_runs (
            id,
            lead_id,
            domain_subscription_id,
            domain,
            leads (
              id,
              email,
              domain
            )
          )
        `)
        .eq('url_token', reportToken)
        .single()

      if (reportError || !report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        )
      }

      const scanRun = Array.isArray(report.scan_runs)
        ? report.scan_runs[0]
        : report.scan_runs as { id: string; lead_id: string; domain_subscription_id: string | null; domain: string | null; leads: { id: string; email: string; domain: string } }

      if (!scanRun?.leads) {
        return NextResponse.json(
          { error: 'Lead not found for report' },
          { status: 404 }
        )
      }

      const lead = Array.isArray(scanRun.leads) ? scanRun.leads[0] : scanRun.leads
      leadId = lead.id
      targetDomain = domain || scanRun.domain || lead.domain
      targetEmail = lead.email
      // Inherit domain_subscription_id from original scan if not provided
      if (!targetDomainSubscriptionId && scanRun.domain_subscription_id) {
        targetDomainSubscriptionId = scanRun.domain_subscription_id
      }
    } else {
      // Look up by email
      const normalizedEmail = email.toLowerCase().trim()

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, email, domain')
        .ilike('email', normalizedEmail)
        .single()

      if (leadError || !lead) {
        return NextResponse.json(
          { error: 'Lead not found for email' },
          { status: 404 }
        )
      }

      leadId = lead.id
      targetDomain = domain || lead.domain
      targetEmail = lead.email

      // Look up domain subscription for this lead/domain if not provided
      if (!targetDomainSubscriptionId && targetDomain) {
        const { data: subscription } = await supabase
          .from('domain_subscriptions')
          .select('id')
          .eq('lead_id', leadId)
          .eq('domain', targetDomain)
          .eq('status', 'active')
          .single()

        if (subscription) {
          targetDomainSubscriptionId = subscription.id
        }
      }
    }

    // Create new scan run (bypassing all tier limits)
    // CRITICAL: Store domain for multi-domain isolation
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        lead_id: leadId,
        domain: targetDomain,  // CRITICAL: Store domain for multi-domain isolation
        domain_subscription_id: targetDomainSubscriptionId,
        status: 'pending',
        progress: 0,
      })
      .select('id')
      .single()

    if (scanError) {
      console.error('Error creating scan run:', scanError)
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500 }
      )
    }

    // Trigger background processing via Inngest

    await inngest.send({
      name: 'scan/process',
      data: {
        scanId: scanRun.id,
        domain: targetDomain,
        email: targetEmail,
        leadId: leadId,
        domainSubscriptionId: targetDomainSubscriptionId || undefined,
        skipEmail, // Optionally skip email (defaults to false - subscribers get scan complete emails)
      },
    })

    return NextResponse.json({
      success: true,
      scanId: scanRun.id,
      leadId,
      domain: targetDomain,
      email: targetEmail,
      message: 'Rescan initiated. Check /api/scan/status for progress.',
    })
  } catch (error) {
    console.error('Admin rescan error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
