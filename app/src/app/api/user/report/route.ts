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

    // Get the user's lead record with domain
    const { data: lead } = await supabase
      .from('leads')
      .select('id, domain, tier')
      .eq('id', session.lead_id)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Get latest completed scan run with its report (same pattern as dashboard)
    const { data: scanRun } = await supabase
      .from('scan_runs')
      .select(`
        id,
        reports (url_token)
      `)
      .eq('lead_id', lead.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!scanRun) {
      return NextResponse.json({
        domain: lead.domain,
        tier: lead.tier,
        reportToken: null
      })
    }

    // Handle both array and single object cases (Supabase can return either)
    const reportData = Array.isArray(scanRun.reports)
      ? scanRun.reports[0]
      : scanRun.reports as { url_token: string } | null

    return NextResponse.json({
      domain: lead.domain,
      tier: lead.tier,
      reportToken: reportData?.url_token || null
    })
  } catch (error) {
    console.error('Error fetching user report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
