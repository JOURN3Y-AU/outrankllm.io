import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * /report - Redirects to the user's most recent report
 * If not logged in, redirects to login
 * If no reports, redirects to home
 */
export default async function ReportPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login?redirect=/report')
  }

  const supabase = createServiceClient()

  // Get the most recent completed report for this user
  const { data: scanRun } = await supabase
    .from('scan_runs')
    .select(`
      id,
      reports (url_token)
    `)
    .eq('lead_id', session.lead_id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!scanRun?.reports) {
    // No reports yet, redirect to home to create one
    redirect('/')
  }

  // Handle both array and single object cases
  const reportData = Array.isArray(scanRun.reports)
    ? scanRun.reports[0]
    : scanRun.reports as { url_token: string }

  if (!reportData?.url_token) {
    redirect('/')
  }

  // Redirect to the most recent report
  redirect(`/report/${reportData.url_token}`)
}
