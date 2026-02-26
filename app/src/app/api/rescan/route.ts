import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

const COOLDOWN_HOURS = 24

const RescanSchema = z.object({
  domainSubscriptionId: z.string().uuid(),
})

/**
 * POST /api/rescan
 *
 * User-facing endpoint to trigger a manual rescan for a subscribed domain.
 * Enforces ownership, active subscription, and 24-hour cooldown per domain.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = RescanSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { domainSubscriptionId } = result.data
    const supabase = createServiceClient()

    // Verify ownership and active status
    const { data: subscription, error: subError } = await supabase
      .from('domain_subscriptions')
      .select('id, lead_id, domain, status, tier')
      .eq('id', domainSubscriptionId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (subscription.lead_id !== session.lead_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription is not active' },
        { status: 403 }
      )
    }

    // Check for in-progress scan
    const { data: activeScan } = await supabase
      .from('scan_runs')
      .select('id, status')
      .eq('domain_subscription_id', domainSubscriptionId)
      .not('status', 'in', '("complete","failed")')
      .limit(1)
      .single()

    if (activeScan) {
      return NextResponse.json(
        { error: 'A scan is already in progress for this domain', scanId: activeScan.id },
        { status: 409 }
      )
    }

    // Check 24-hour cooldown (only counts manual scans)
    const { data: lastManualScan } = await supabase
      .from('scan_runs')
      .select('created_at')
      .eq('domain_subscription_id', domainSubscriptionId)
      .eq('trigger_type', 'manual')
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastManualScan) {
      const lastScanTime = new Date(lastManualScan.created_at).getTime()
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000
      const elapsed = Date.now() - lastScanTime

      if (elapsed < cooldownMs) {
        const retryAfter = Math.ceil((cooldownMs - elapsed) / 1000)
        return NextResponse.json(
          {
            error: 'Please wait before triggering another rescan',
            retryAfter,
            cooldownEndsAt: new Date(lastScanTime + cooldownMs).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    // Create scan_run with manual trigger type
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        lead_id: session.lead_id,
        domain: subscription.domain,
        domain_subscription_id: domainSubscriptionId,
        status: 'pending',
        progress: 0,
        trigger_type: 'manual',
      })
      .select('id')
      .single()

    if (scanError || !scanRun) {
      console.error('Error creating scan run:', scanError)
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500 }
      )
    }

    // Trigger scan via Inngest (skipEmail not set — subscriber gets completion email)
    await inngest.send({
      name: 'scan/process',
      data: {
        scanId: scanRun.id,
        domain: subscription.domain,
        email: session.email,
        leadId: session.lead_id,
        domainSubscriptionId,
      },
    })

    return NextResponse.json({
      success: true,
      scanId: scanRun.id,
      message: 'Rescan initiated. You will receive an email when it completes.',
    })
  } catch (error) {
    console.error('Error in /api/rescan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
