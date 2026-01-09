import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface CompetitorSnapshot {
  run_id: string
  recorded_at: string
  domain_mentions: number
  competitors: { name: string; count: number }[]
}

export interface CompetitorTrendData {
  snapshots: CompetitorSnapshot[]
  hasHistory: boolean
  domain: string
  // Top competitors across all snapshots (for filtering)
  topCompetitors: string[]
}

/**
 * GET /api/trends/competitors
 * Get competitor mention history for the current user (subscribers only)
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - trends require subscriber status
    const flags = await getFeatureFlags(session.tier)
    if (!flags.isSubscriber) {
      return NextResponse.json(
        { error: 'Upgrade to view competitor trends' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 12

    // Get lead's domain
    const { data: lead } = await supabase
      .from('leads')
      .select('domain')
      .eq('id', session.lead_id)
      .single()

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Fetch reports with competitor data for this lead
    // Join through scan_runs to get historical data
    const { data: reports, error } = await supabase
      .from('scan_runs')
      .select(`
        id,
        created_at,
        reports (
          top_competitors,
          visibility_score
        )
      `)
      .eq('lead_id', session.lead_id)
      .eq('status', 'complete')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching competitor history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch competitor trends' },
        { status: 500 }
      )
    }

    // Also get total domain mentions from score_history for each run
    const { data: scoreHistory } = await supabase
      .from('score_history')
      .select('run_id, total_mentions')
      .eq('lead_id', session.lead_id)

    const mentionsByRun = new Map<string, number | null>(
      (scoreHistory || []).map((s: { run_id: string; total_mentions: number | null }) => [s.run_id, s.total_mentions])
    )

    // Transform data into snapshots
    const snapshots: CompetitorSnapshot[] = []
    const competitorCounts = new Map<string, number>()

    for (const run of reports || []) {
      // Handle both array and single object cases
      const reportData = Array.isArray(run.reports)
        ? run.reports[0]
        : run.reports as { top_competitors: { name: string; count: number }[] | null } | null

      if (!reportData) continue

      const competitors = (reportData.top_competitors || []) as { name: string; count: number }[]

      // Track total counts for determining top competitors
      for (const comp of competitors) {
        competitorCounts.set(
          comp.name,
          (competitorCounts.get(comp.name) || 0) + comp.count
        )
      }

      snapshots.push({
        run_id: run.id,
        recorded_at: run.created_at,
        domain_mentions: mentionsByRun.get(run.id) ?? 0,
        competitors,
      })
    }

    // Get top 5 competitors by total mentions across all snapshots
    const topCompetitors = Array.from(competitorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    return NextResponse.json({
      snapshots,
      hasHistory: snapshots.length > 0,
      domain: lead.domain,
      topCompetitors,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/trends/competitors:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
