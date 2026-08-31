import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface ScoreSnapshot {
  id: string
  run_id: string
  visibility_score: number
  chatgpt_score: number | null
  claude_score: number | null
  gemini_score: number | null
  perplexity_score: number | null
  query_coverage: number | null
  total_queries: number | null
  total_mentions: number | null
  readiness_score: number | null
  recorded_at: string
}

/**
 * A scan that ran but produced no score, so the trend line has no point for
 * that week. Returned alongside the snapshots so a hole in the chart reads as
 * a missed measurement rather than as a flat stretch.
 */
export interface TrendGap {
  run_id: string
  attempted_at: string
  reason: string | null
}

export interface TrendData {
  snapshots: ScoreSnapshot[]
  gaps: TrendGap[]
  hasHistory: boolean
  periodStart: string | null
  periodEnd: string | null
}

/**
 * GET /api/trends
 * Get score history for the current user (subscribers only)
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - trends require subscriber status
    const flags = await getFeatureFlags(session.tier)
    if (!flags.isSubscriber) {
      return NextResponse.json(
        { error: 'Upgrade to view trend data' },
        { status: 403 }
      )
    }

    // Parse query params for date range
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 12 // Default to last 12 scans
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Fetch score history - use domain_subscription_id if provided for multi-domain isolation
    let query = supabase
      .from('score_history')
      .select('*')

    if (domainSubscriptionId) {
      // Multi-domain: filter by specific domain subscription
      query = query.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      // Legacy fallback: filter by lead_id
      query = query.eq('lead_id', session.lead_id)
    }

    // Take the most recent `limit` scans, then flip to chronological order for
    // the chart. Ordering ascending before the limit returns the OLDEST scans
    // instead, which on a long-running account renders a trend that stops
    // months back and never includes the report the reader is looking at.
    const { data: recent, error } = await query
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching score history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trend data' },
        { status: 500 }
      )
    }

    const snapshots = (recent || []).slice().reverse()
    const hasHistory = snapshots.length > 0
    const periodStart = hasHistory ? snapshots[0].recorded_at : null
    const periodEnd = hasHistory ? snapshots[snapshots.length - 1].recorded_at : null

    // Scans that ran inside the charted window but produced no score. Without
    // these the chart draws a straight line across a month of failed scans, so
    // a measurement outage reads as a plateau.
    let gaps: TrendGap[] = []
    if (periodStart) {
      let runsQuery = supabase
        .from('scan_runs')
        .select('id, created_at, error_message')
        .eq('status', 'failed')
        .gte('created_at', periodStart)
        .order('created_at', { ascending: true })

      runsQuery = domainSubscriptionId
        ? runsQuery.eq('domain_subscription_id', domainSubscriptionId)
        : runsQuery.eq('lead_id', session.lead_id)

      const { data: failedRuns } = await runsQuery

      gaps = (failedRuns || []).map(
        (run: { id: string; created_at: string; error_message: string | null }) => ({
          run_id: run.id,
          attempted_at: run.created_at,
          reason: run.error_message ?? null,
        })
      )
    }

    return NextResponse.json({
      snapshots,
      gaps,
      hasHistory,
      periodStart,
      periodEnd,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/trends:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/trends/record
 * Record a score snapshot (called after scan completion)
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    const body = await request.json()
    const {
      run_id,
      visibility_score,
      chatgpt_score,
      claude_score,
      gemini_score,
      perplexity_score,
      query_coverage,
      total_queries,
      total_mentions,
      readiness_score,
    } = body

    if (!run_id || visibility_score === undefined) {
      return NextResponse.json(
        { error: 'run_id and visibility_score are required' },
        { status: 400 }
      )
    }

    // Verify the run belongs to this user and get domain_subscription_id
    const { data: run, error: runError } = await supabase
      .from('scan_runs')
      .select('lead_id, domain_subscription_id')
      .eq('id', run_id)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Scan run not found' },
        { status: 404 }
      )
    }

    if (run.lead_id !== session.lead_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Insert or update score snapshot with domain_subscription_id for multi-domain isolation
    const { data: snapshot, error: insertError } = await supabase
      .from('score_history')
      .upsert({
        lead_id: session.lead_id,
        domain_subscription_id: run.domain_subscription_id,
        run_id,
        visibility_score,
        chatgpt_score: chatgpt_score ?? null,
        claude_score: claude_score ?? null,
        gemini_score: gemini_score ?? null,
        perplexity_score: perplexity_score ?? null,
        query_coverage: query_coverage ?? null,
        total_queries: total_queries ?? null,
        total_mentions: total_mentions ?? null,
        readiness_score: readiness_score ?? null,
        recorded_at: new Date().toISOString(),
      }, {
        onConflict: 'run_id',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error recording score snapshot:', insertError)
      return NextResponse.json(
        { error: 'Failed to record score' },
        { status: 500 }
      )
    }

    return NextResponse.json({ snapshot })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/trends:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
