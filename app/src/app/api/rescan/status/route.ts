import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const COOLDOWN_HOURS = 24

/**
 * GET /api/rescan/status?domain_subscription_id=...
 *
 * Check rescan availability for a domain subscription.
 * Returns whether user can rescan, cooldown info, and in-progress scan status.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const domainSubscriptionId = request.nextUrl.searchParams.get('domain_subscription_id')
    if (!domainSubscriptionId) {
      return NextResponse.json({ error: 'domain_subscription_id is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify ownership
    const { data: subscription } = await supabase
      .from('domain_subscriptions')
      .select('id, lead_id, status')
      .eq('id', domainSubscriptionId)
      .single()

    if (!subscription || subscription.lead_id !== session.lead_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (subscription.status !== 'active') {
      return NextResponse.json({
        canRescan: false,
        scanInProgress: false,
        reason: 'Subscription is not active',
      })
    }

    // Check for in-progress scan
    const { data: activeScan } = await supabase
      .from('scan_runs')
      .select('id, status, progress')
      .eq('domain_subscription_id', domainSubscriptionId)
      .not('status', 'in', '("complete","failed")')
      .limit(1)
      .single()

    if (activeScan) {
      return NextResponse.json({
        canRescan: false,
        scanInProgress: true,
        scanId: activeScan.id,
        scanStatus: activeScan.status,
        scanProgress: activeScan.progress,
      })
    }

    // Check cooldown
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
        return NextResponse.json({
          canRescan: false,
          scanInProgress: false,
          cooldownEndsAt: new Date(lastScanTime + cooldownMs).toISOString(),
          lastManualScanAt: lastManualScan.created_at,
        })
      }
    }

    return NextResponse.json({
      canRescan: true,
      scanInProgress: false,
    })
  } catch (error) {
    console.error('Error in /api/rescan/status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
