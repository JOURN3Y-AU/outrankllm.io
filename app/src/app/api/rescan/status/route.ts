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
        hasChanges: false,
        scanId: activeScan.id,
        scanStatus: activeScan.status,
        scanProgress: activeScan.progress,
      })
    }

    // Get last completed scan time to detect changes
    // Use enrichment_completed_at (if enrichment ran) or completed_at as the baseline,
    // since the scan/enrichment process itself creates questions and competitors
    const { data: lastCompletedScan } = await supabase
      .from('scan_runs')
      .select('created_at, completed_at, enrichment_completed_at')
      .eq('domain_subscription_id', domainSubscriptionId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Check if questions or competitors were modified since last scan finished
    let hasChanges = false
    if (lastCompletedScan) {
      const lastScanAt = lastCompletedScan.enrichment_completed_at
        || lastCompletedScan.completed_at
        || lastCompletedScan.created_at

      const [{ data: recentQuestion }, { data: recentCompetitor }] = await Promise.all([
        supabase
          .from('subscriber_questions')
          .select('updated_at')
          .eq('domain_subscription_id', domainSubscriptionId)
          .gt('updated_at', lastScanAt)
          .limit(1)
          .single(),
        supabase
          .from('subscriber_competitors')
          .select('updated_at')
          .eq('domain_subscription_id', domainSubscriptionId)
          .gt('updated_at', lastScanAt)
          .limit(1)
          .single(),
      ])

      hasChanges = !!(recentQuestion || recentCompetitor)
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
          hasChanges,
          cooldownEndsAt: new Date(lastScanTime + cooldownMs).toISOString(),
          lastManualScanAt: lastManualScan.created_at,
        })
      }
    }

    return NextResponse.json({
      canRescan: true,
      scanInProgress: false,
      hasChanges,
    })
  } catch (error) {
    console.error('Error in /api/rescan/status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
