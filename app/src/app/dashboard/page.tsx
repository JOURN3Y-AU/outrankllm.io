import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { FileText, CreditCard, ExternalLink, Crown, Globe, Calendar, RefreshCw } from 'lucide-react'

interface Report {
  id: string
  url_token: string
  created_at: string
  domain: string
  visibility_score: number | null
  platform_scores: Record<string, number> | null
  status: string
}

const tierLabels: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

const tierColors: Record<string, string> = {
  free: 'var(--text-dim)',
  starter: 'var(--green)',
  pro: 'var(--gold)',
  agency: 'var(--gold)',
}

// Platform display config
const platformConfig: Record<string, { name: string; color: string }> = {
  chatgpt: { name: 'GPT', color: '#ef4444' },
  perplexity: { name: 'Perp', color: '#1FB8CD' },
  gemini: { name: 'Gem', color: '#3b82f6' },
  claude: { name: 'Claude', color: '#22c55e' },
}

// Number of questions per platform (standard scan)
const QUESTIONS_PER_PLATFORM = 5

async function getReports(leadId: string): Promise<Report[]> {
  const supabase = createServiceClient()

  // Reports are linked via scan_runs, not directly to leads
  // Join through scan_runs to get reports for this lead
  const { data: scanRuns, error } = await supabase
    .from('scan_runs')
    .select(`
      id,
      created_at,
      reports (
        id,
        url_token,
        visibility_score,
        platform_scores,
        created_at
      )
    `)
    .eq('lead_id', leadId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching reports:', error)
    return []
  }

  if (!scanRuns) return []

  // Get the lead's domain
  const { data: lead } = await supabase
    .from('leads')
    .select('domain')
    .eq('id', leadId)
    .single()

  // Flatten the results and add domain
  // Note: reports is a single object (one-to-one), not an array
  const reports: Report[] = []
  for (const run of scanRuns) {
    // Handle both array and single object cases
    const reportData = Array.isArray(run.reports)
      ? run.reports[0]
      : run.reports as { id: string; url_token: string; visibility_score: number | null; platform_scores: Record<string, number> | null; created_at: string } | null

    if (reportData && reportData.url_token) {
      reports.push({
        id: reportData.id,
        url_token: reportData.url_token,
        // Use the scan run's created_at as the report date (when the analysis was run)
        created_at: run.created_at,
        domain: lead?.domain || '',
        visibility_score: reportData.visibility_score,
        platform_scores: reportData.platform_scores,
        status: 'complete',
      })
    }
  }

  return reports
}

async function getSubscription(leadId: string) {
  const supabase = createServiceClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_start, current_period_end, cancel_at_period_end')
    .eq('lead_id', leadId)
    .eq('status', 'active')
    .single()

  return subscription
}

async function getLeadDomain(leadId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('domain')
    .eq('id', leadId)
    .single()

  return lead?.domain || null
}

// Calculate next weekly analysis date (Mondays at 9am UTC)
function getNextAnalysisDate(): Date {
  const now = new Date()
  const nextMonday = new Date(now)
  nextMonday.setUTCHours(9, 0, 0, 0)

  // Find next Monday
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)

  return nextMonday
}

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const [reports, subscription, leadDomain] = await Promise.all([
    getReports(session.lead_id),
    getSubscription(session.lead_id),
    getLeadDomain(session.lead_id),
  ])

  const isPaid = session.tier !== 'free'
  const isAgency = session.tier === 'agency'
  const trackedDomain = leadDomain || (reports.length > 0 ? reports[0].domain : null)
  const nextAnalysis = getNextAnalysisDate()

  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '960px', marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          {/* Header */}
          <div style={{ marginBottom: '48px' }}>
            <div className="flex items-center gap-3" style={{ marginBottom: '8px' }}>
              <h1 className="text-3xl font-medium">Dashboard</h1>
              <span
                className="font-mono text-xs uppercase tracking-wider px-2 py-1"
                style={{
                  background: `${tierColors[session.tier]}20`,
                  color: tierColors[session.tier],
                  border: `1px solid ${tierColors[session.tier]}40`,
                }}
              >
                {tierLabels[session.tier]}
              </span>
            </div>
            <p className="text-[var(--text-mid)]">{session.email}</p>
          </div>

          {/* Tracked Domain Card - for paid users */}
          {isPaid && trackedDomain && (
            <div
              className="border border-[var(--green)]/30 bg-[var(--green)]/5"
              style={{ padding: '24px', marginBottom: '32px' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[var(--green)]/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6 text-[var(--green)]" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '4px' }}>
                    Tracked Domain
                  </div>
                  <a
                    href={`https://${trackedDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl font-medium text-[var(--text)] hover:text-[var(--green)] transition-colors inline-flex items-center gap-2"
                  >
                    {trackedDomain}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <div className="flex items-center gap-4 text-sm text-[var(--text-dim)]" style={{ marginTop: '12px' }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Next analysis: {nextAnalysis.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>Weekly updates</span>
                    </div>
                  </div>
                </div>
                {reports.length > 0 && (
                  <Link
                    href={`/report/${reports[0].url_token}`}
                    className="flex-shrink-0 font-mono text-sm text-[var(--green)] hover:underline"
                  >
                    View Latest Report →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions - different for paid vs free */}
          <div className={`grid gap-4 ${isPaid ? 'md:grid-cols-2' : 'md:grid-cols-2'}`} style={{ marginBottom: '48px' }}>
            {/* New Report - only for free users or agency tier */}
            {(!isPaid || isAgency) && (
              <Link
                href="/"
                className="flex items-center gap-4 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--green)] transition-colors"
                style={{ padding: '20px' }}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[var(--green)]" />
                </div>
                <div>
                  <div className="font-medium" style={{ marginBottom: '2px' }}>
                    {isAgency ? 'Add Domain' : 'New Report'}
                  </div>
                  <div className="text-sm text-[var(--text-dim)]">
                    {isAgency ? 'Track another domain' : 'Run a new AI visibility scan'}
                  </div>
                </div>
              </Link>
            )}

            {/* Manage Billing - for paid users */}
            {isPaid && (
              <form action="/api/stripe/portal" method="POST">
                <button
                  type="submit"
                  className="w-full flex items-center gap-4 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--green)] transition-colors text-left"
                  style={{ padding: '20px' }}
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--gold)]/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-[var(--gold)]" />
                  </div>
                  <div>
                    <div className="font-medium" style={{ marginBottom: '2px' }}>Manage Billing</div>
                    <div className="text-sm text-[var(--text-dim)]">Update payment & invoices</div>
                  </div>
                </button>
              </form>
            )}
          </div>

          {/* Subscription Status */}
          {subscription && (
            <div
              className="border border-[var(--border)] bg-[var(--surface)]"
              style={{ padding: '24px', marginBottom: '48px' }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h2 className="font-mono text-sm text-[var(--text-dim)] uppercase tracking-wider">
                  Subscription
                </h2>
                <span className="font-mono text-xs text-[var(--green)] uppercase">Active</span>
              </div>

              <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                <Crown className="w-5 h-5 text-[var(--gold)]" />
                <span className="text-lg font-medium">{tierLabels[session.tier]} Plan</span>
              </div>

              <p className="text-sm text-[var(--text-dim)]">
                {subscription.cancel_at_period_end ? (
                  <>Cancels on {new Date(subscription.current_period_end).toLocaleDateString()}</>
                ) : (
                  <>Renews on {new Date(subscription.current_period_end).toLocaleDateString()}</>
                )}
              </p>
            </div>
          )}

          {/* Upgrade Banner (for free users) */}
          {!isPaid && (
            <div
              className="border border-[var(--gold)]/30 bg-[var(--gold)]/5"
              style={{ padding: '24px', marginBottom: '48px' }}
            >
              <div className="flex items-start gap-4">
                <Crown className="w-6 h-6 text-[var(--gold)] flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium" style={{ marginBottom: '8px' }}>
                    Upgrade to unlock premium features
                  </h3>
                  <p className="text-sm text-[var(--text-mid)]" style={{ marginBottom: '16px' }}>
                    Get full competitor analysis, personalized action plans, and weekly monitoring.
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 bg-[var(--gold)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all"
                    style={{ padding: '10px 20px' }}
                  >
                    View Plans
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Reports */}
          <div>
            <h2 className="font-mono text-sm text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '16px' }}>
              Your Reports
            </h2>

            {reports.length === 0 ? (
              <div
                className="border border-[var(--border)] bg-[var(--surface)] text-center"
                style={{ padding: '48px 24px' }}
              >
                <FileText className="w-12 h-12 text-[var(--text-dim)]" style={{ margin: '0 auto 16px' }} />
                <p className="text-[var(--text-mid)]" style={{ marginBottom: '16px' }}>
                  You haven&apos;t run any reports yet.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-[var(--green)] font-mono text-sm hover:underline"
                >
                  Run your first scan →
                </Link>
              </div>
            ) : (
              <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/report/${report.url_token}`}
                    className="flex items-center justify-between bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
                    style={{ padding: '16px 20px' }}
                  >
                    <div>
                      <div className="font-medium" style={{ marginBottom: '4px' }}>
                        {report.domain}
                      </div>
                      <div className="text-sm text-[var(--text-dim)]">
                        {new Date(report.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Platform mention scores */}
                      {report.platform_scores && (
                        <div className="flex items-center gap-3">
                          {Object.entries(platformConfig).map(([platform, config]) => {
                            const score = report.platform_scores?.[platform]
                            if (score === undefined) return null
                            // Score is a percentage (0-100), convert to mentions out of 5
                            const mentions = Math.round((score / 100) * QUESTIONS_PER_PLATFORM)
                            return (
                              <div
                                key={platform}
                                className="flex items-center gap-1 font-mono text-xs"
                                title={`${config.name}: ${mentions}/${QUESTIONS_PER_PLATFORM} mentions`}
                              >
                                <span style={{ color: config.color }}>{config.name}</span>
                                <span className="text-[var(--text-dim)]">{mentions}/{QUESTIONS_PER_PLATFORM}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <ExternalLink className="w-4 h-4 text-[var(--text-dim)]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
