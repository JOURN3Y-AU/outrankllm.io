import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

/**
 * Admin endpoint to trigger enrichment for a subscriber
 * POST /api/admin/enrich
 *
 * Body:
 *   - reportToken: Report URL token to find the scan
 *   OR
 *   - email: User email to find their latest scan
 *
 * Requires ADMIN_SECRET header for authentication
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
    const { reportToken, email, force = false } = body

    if (!reportToken && !email) {
      return NextResponse.json(
        { error: 'Must provide either reportToken or email' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    let leadId: string
    let scanRunId: string

    if (reportToken) {
      // Look up from report token
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select(`
          id,
          run_id,
          scan_runs (
            id,
            lead_id
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
        : report.scan_runs as { id: string; lead_id: string }

      if (!scanRun) {
        return NextResponse.json(
          { error: 'Scan run not found for report' },
          { status: 404 }
        )
      }

      leadId = scanRun.lead_id
      scanRunId = scanRun.id
    } else {
      // Look up by email - get their latest completed scan
      const normalizedEmail = email.toLowerCase().trim()

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id')
        .ilike('email', normalizedEmail)
        .single()

      if (leadError || !lead) {
        return NextResponse.json(
          { error: 'Lead not found for email' },
          { status: 404 }
        )
      }

      leadId = lead.id

      // Get their latest completed scan run
      const { data: latestScan, error: scanError } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('lead_id', leadId)
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (scanError || !latestScan) {
        return NextResponse.json(
          { error: 'No completed scan found for this user' },
          { status: 404 }
        )
      }

      scanRunId = latestScan.id
    }

    console.log('[Admin Enrich] Triggering enrichment:', {
      leadId,
      scanRunId,
      force,
    })

    // If force flag is set, clear existing data first
    if (force) {
      console.log('[Admin Enrich] Force mode: clearing existing data')

      // Reset enrichment status
      await supabase
        .from('scan_runs')
        .update({
          enrichment_status: 'pending',
          enrichment_started_at: null,
          enrichment_completed_at: null,
        })
        .eq('id', scanRunId)

      // Delete existing brand awareness results
      await supabase
        .from('brand_awareness_results')
        .delete()
        .eq('run_id', scanRunId)

      // Clear competitive summary
      await supabase
        .from('reports')
        .update({ competitive_summary: null })
        .eq('run_id', scanRunId)
    }

    // Trigger enrichment via Inngest
    await inngest.send({
      name: 'subscriber/enrich',
      data: {
        leadId,
        scanRunId,
      },
    })

    return NextResponse.json({
      success: true,
      leadId,
      scanRunId,
      force,
      message: force
        ? 'Existing data cleared. Enrichment triggered. Check Inngest dashboard for progress.'
        : 'Enrichment triggered. Check Inngest dashboard for progress.',
    })
  } catch (error) {
    console.error('Admin enrich error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
