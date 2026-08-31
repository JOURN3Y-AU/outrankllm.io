import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin'
import { sendScanCompleteEmail } from '@/lib/email/resend'
import { getPreviousScoreForDomain } from '@/lib/score-history'

/**
 * Admin endpoint to manually send scan_complete email
 * Used when the Inngest function times out before reaching the email step
 *
 * POST /api/admin/send-email
 *
 * Body:
 *   - scanRunId: The scan run ID to send email for
 *   OR
 *   - email: User email (will use their latest completed scan)
 *
 * Auth: x-admin-secret header OR admin session cookie
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication - try header first, then session
    const adminSecret = request.headers.get('x-admin-secret')
    const hasValidSecret = adminSecret && adminSecret === process.env.ADMIN_SECRET
    const adminSession = await getAdminSession()

    if (!hasValidSecret && !adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { scanRunId, email } = body

    if (!scanRunId && !email) {
      return NextResponse.json(
        { error: 'Must provide either scanRunId or email' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    let targetScanRunId: string
    let targetEmail: string
    let targetDomain: string
    let leadId: string

    if (scanRunId) {
      // Look up scan run directly
      const { data: scanRun, error: scanError } = await supabase
        .from('scan_runs')
        .select(`
          id,
          domain,
          lead_id,
          status,
          leads (id, email)
        `)
        .eq('id', scanRunId)
        .single()

      if (scanError || !scanRun) {
        return NextResponse.json(
          { error: 'Scan run not found' },
          { status: 404 }
        )
      }

      if (scanRun.status !== 'complete') {
        return NextResponse.json(
          { error: `Scan is not complete (status: ${scanRun.status})` },
          { status: 400 }
        )
      }

      const lead = Array.isArray(scanRun.leads) ? scanRun.leads[0] : scanRun.leads as { id: string; email: string }
      targetScanRunId = scanRun.id
      targetEmail = lead.email
      targetDomain = scanRun.domain
      leadId = lead.id
    } else {
      // Look up by email - get their latest completed scan
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

      const { data: latestScan, error: scanError } = await supabase
        .from('scan_runs')
        .select('id, domain')
        .eq('lead_id', lead.id)
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

      targetScanRunId = latestScan.id
      targetEmail = lead.email
      targetDomain = latestScan.domain
      leadId = lead.id
    }

    // Get report token
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('url_token, visibility_score')
      .eq('run_id', targetScanRunId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found for this scan run' },
        { status: 404 }
      )
    }

    // Compare against this domain's own previous scan, not the account's
    const previousScore = await getPreviousScoreForDomain(
      supabase,
      leadId,
      targetDomain,
      targetScanRunId
    )

    const score = report.visibility_score ?? 0

    console.log('[Admin Send Email] Sending scan_complete email:', {
      email: targetEmail,
      domain: targetDomain,
      scanRunId: targetScanRunId,
      score,
      previousScore,
    })

    // Send the email
    const emailResult = await sendScanCompleteEmail(
      targetEmail,
      report.url_token,
      targetDomain,
      score,
      previousScore
    )

    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      )
    }

    // Log the email
    await supabase.from('email_logs').insert({
      lead_id: leadId,
      run_id: targetScanRunId,
      email_type: 'scan_complete',
      recipient: targetEmail,
      resend_id: emailResult.messageId,
      status: 'sent',
    })

    return NextResponse.json({
      success: true,
      email: targetEmail,
      domain: targetDomain,
      scanRunId: targetScanRunId,
      score,
      previousScore,
      messageId: emailResult.messageId,
      message: 'Scan complete email sent successfully.',
    })
  } catch (error) {
    console.error('Admin send-email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
