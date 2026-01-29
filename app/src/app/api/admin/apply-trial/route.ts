import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

// Default trial duration: 7 days
const DEFAULT_TRIAL_DAYS = 7

/**
 * Admin endpoint to apply trial to a user
 * POST /api/admin/apply-trial
 *
 * Body:
 *   - email: User email to apply trial to
 *   - reportToken: (optional) Report URL token - if provided, uses this report
 *   - trialTier: (optional) Trial tier to apply - defaults to 'starter'
 *   - trialDays: (optional) Number of days for trial - defaults to 7
 *   - trialExpiresAt: (optional) Specific expiry timestamp - overrides trialDays
 *   - triggerEnrichment: (optional) Whether to trigger enrichment - defaults to true
 *
 * Requires ADMIN_SECRET header for authentication
 *
 * Safety: Will NOT apply trial to users with active paid subscriptions
 */
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
    const {
      email,
      reportToken,
      trialTier = 'starter',
      trialDays = DEFAULT_TRIAL_DAYS,
      trialExpiresAt,
      triggerEnrichment = true,
    } = body

    if (!email && !reportToken) {
      return NextResponse.json(
        { error: 'Must provide either email or reportToken' },
        { status: 400 }
      )
    }

    // Validate trial tier
    if (!['starter', 'pro', 'agency'].includes(trialTier)) {
      return NextResponse.json(
        { error: 'Invalid trialTier. Must be starter, pro, or agency' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    let leadId: string
    let scanRunId: string | null = null
    let userEmail: string

    if (reportToken) {
      // Look up from report token
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select(`
          id,
          run_id,
          scan_runs (
            id,
            lead_id,
            leads (
              id,
              email
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
        : report.scan_runs as { id: string; lead_id: string; leads: { id: string; email: string } }

      if (!scanRun) {
        return NextResponse.json(
          { error: 'Scan run not found for report' },
          { status: 404 }
        )
      }

      leadId = scanRun.lead_id
      scanRunId = scanRun.id
      userEmail = (scanRun.leads as { email: string }).email
    } else {
      // Look up by email
      const normalizedEmail = email.toLowerCase().trim()

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, email')
        .ilike('email', normalizedEmail)
        .single()

      if (leadError || !lead) {
        return NextResponse.json(
          { error: 'Lead not found for email' },
          { status: 404 }
        )
      }

      leadId = lead.id
      userEmail = lead.email

      // Get their latest completed scan run
      const { data: latestScan } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('lead_id', leadId)
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      scanRunId = latestScan?.id || null
    }

    // SAFETY: Check if user has active paid subscription
    const { data: activeSubs } = await supabase
      .from('domain_subscriptions')
      .select('id, tier')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .limit(1)

    if (activeSubs && activeSubs.length > 0) {
      return NextResponse.json(
        {
          error: 'User has an active paid subscription - trial not applied',
          isSubscriber: true,
          currentTier: activeSubs[0].tier,
        },
        { status: 400 }
      )
    }

    // Also check legacy subscriptions table
    const { data: legacySubs } = await supabase
      .from('subscriptions')
      .select('id, tier')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .limit(1)

    if (legacySubs && legacySubs.length > 0) {
      return NextResponse.json(
        {
          error: 'User has an active paid subscription (legacy) - trial not applied',
          isSubscriber: true,
          currentTier: legacySubs[0].tier,
        },
        { status: 400 }
      )
    }

    // Calculate trial expiry
    let expiryDate: string
    if (trialExpiresAt) {
      expiryDate = new Date(trialExpiresAt).toISOString()
    } else {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + trialDays)
      expiryDate = expiry.toISOString()
    }

    console.log('[Admin Apply Trial]', {
      leadId,
      email: userEmail,
      scanRunId,
      trialTier,
      expiryDate,
      triggerEnrichment,
    })

    // 1. Set trial fields on lead
    const { error: leadError } = await supabase
      .from('leads')
      .update({
        trial_tier: trialTier,
        trial_expires_at: expiryDate,
      })
      .eq('id', leadId)

    if (leadError) {
      return NextResponse.json(
        { error: `Failed to update lead: ${leadError.message}` },
        { status: 500 }
      )
    }

    // 2. Extend report expiry (if scan exists)
    if (scanRunId) {
      const { error: reportError } = await supabase
        .from('reports')
        .update({ expires_at: expiryDate })
        .eq('run_id', scanRunId)

      if (reportError) {
        console.warn('[Admin Apply Trial] Failed to update report expiry:', reportError.message)
      }
    }

    // 3. Trigger enrichment (if requested and scan exists)
    let enrichmentTriggered = false
    if (triggerEnrichment && scanRunId) {
      await inngest.send({
        name: 'subscriber/enrich',
        data: {
          leadId,
          scanRunId,
          // NOTE: No domainSubscriptionId for trial users
        },
      })
      enrichmentTriggered = true
    }

    return NextResponse.json({
      success: true,
      leadId,
      email: userEmail,
      scanRunId,
      trialTier,
      trialExpiresAt: expiryDate,
      enrichmentTriggered,
      message: enrichmentTriggered
        ? 'Trial applied. Enrichment triggered - check Inngest dashboard for progress.'
        : scanRunId
          ? 'Trial applied. Use triggerEnrichment=true to run enrichment.'
          : 'Trial applied. No completed scan found - enrichment not triggered.',
    })
  } catch (error) {
    console.error('Admin apply-trial error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
