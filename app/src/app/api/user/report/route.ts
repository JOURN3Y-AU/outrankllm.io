import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/user/report
 * Get the current user's latest report token and domain
 */
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get the user's lead record
    const { data: lead } = await supabase
      .from('leads')
      .select('id, domain, tier')
      .eq('id', session.lead_id)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Get latest completed scan run with its report and domain
    // CRITICAL: Include domain from scan_run for multi-domain support
    const { data: scanRun } = await supabase
      .from('scan_runs')
      .select(`
        id,
        domain,
        reports (url_token)
      `)
      .eq('lead_id', lead.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!scanRun) {
      return NextResponse.json({
        domain: lead.domain,  // Fallback to lead.domain if no scans
        tier: lead.tier,
        reportToken: null
      })
    }

    // Handle both array and single object cases (Supabase can return either)
    const reportData = Array.isArray(scanRun.reports)
      ? scanRun.reports[0]
      : scanRun.reports as { url_token: string } | null

    // CRITICAL: Return domain from scan_run, not lead.domain
    // This ensures the correct domain is shown for multi-domain users
    return NextResponse.json({
      domain: scanRun.domain || lead.domain,  // Prefer scan domain, fallback to lead
      tier: lead.tier,
      reportToken: reportData?.url_token || null
    })
  } catch (error) {
    console.error('Error fetching user report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
