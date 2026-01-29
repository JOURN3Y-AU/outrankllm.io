import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags, getFeatureFlagsForLead } from '@/lib/features/flags'

export interface ActionItem {
  id: string
  title: string
  description: string
  rationale: string | null
  priority: 'quick_win' | 'strategic' | 'backlog'
  category: string | null
  estimated_impact: string | null
  estimated_effort: string | null
  target_page: string | null
  target_element: string | null
  target_keywords: string[] | null
  consensus: string[] | null
  implementation_steps: string[] | null
  expected_outcome: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed'
  completed_at: string | null
  sort_order: number
}

export interface PageEdit {
  page: string
  metaTitle: string | null
  metaDescription: string | null
  h1Change: string
  contentToAdd: string | null
}

export interface KeywordEntry {
  keyword: string
  bestPage: string
  whereToAdd: string
  priority: string
}

export interface ActionPlan {
  id: string
  run_id: string
  executive_summary: string | null
  total_actions: number
  quick_wins_count: number
  strategic_count: number
  backlog_count: number
  generated_at: string
  actions: ActionItem[]
  page_edits: PageEdit[] | null
  keyword_map: KeywordEntry[] | null
  key_takeaways: string[] | null
}

/**
 * GET /api/actions
 * Get action plan for the current user's latest run
 *
 * Action plans are now generated automatically during the enrichment pipeline
 * (enrich-subscriber.ts) using AI-powered analysis with Claude's extended thinking.
 *
 * Supports both authenticated (session) and unauthenticated (run_id) access:
 * - Authenticated: Uses session to verify user and get their latest plan
 * - Unauthenticated: Uses run_id to look up lead and verify feature flags (for trial users)
 */
export async function GET(request: Request) {
  try {
    const supabase = createServiceClient()

    // Parse query params first
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Try to get session (may be null for unauthenticated users)
    const session = await getSession()

    let leadId: string
    let flags: Awaited<ReturnType<typeof getFeatureFlags>>

    if (runId) {
      // When run_id is provided, always derive lead_id from scan_runs
      // This allows viewing action plans for any report you have access to
      // (same logic as report pages - anyone with the token/run_id can view)
      const { data: scanRun, error: scanError } = await supabase
        .from('scan_runs')
        .select('lead_id')
        .eq('id', runId)
        .single()

      if (scanError || !scanRun) {
        return NextResponse.json(
          { error: 'Invalid run_id' },
          { status: 400 }
        )
      }

      leadId = scanRun.lead_id
      // Get feature flags for the report owner (handles trial status)
      flags = await getFeatureFlagsForLead(leadId)
    } else if (session) {
      // No run_id but has session - get latest plan for logged-in user
      leadId = session.lead_id
      flags = await getFeatureFlags(session.tier)
    } else {
      // No session and no run_id - unauthorized
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check feature flags
    if (!flags.showActionPlans) {
      return NextResponse.json(
        { error: 'Upgrade to access action plans' },
        { status: 403 }
      )
    }

    // Get the action plan with new fields
    // When run_id is provided, lead_id is derived from scan_runs (validated above)
    // Otherwise, lead_id comes from session
    let planQuery = supabase
      .from('action_plans')
      .select('*, page_edits, keyword_map, key_takeaways')

    if (runId) {
      // Specific run requested - lead_id already validated via scan_runs lookup
      planQuery = planQuery.eq('run_id', runId)
    } else if (domainSubscriptionId) {
      // Multi-domain isolation - get latest for this domain
      planQuery = planQuery.eq('domain_subscription_id', domainSubscriptionId)
      planQuery = planQuery.order('created_at', { ascending: false }).limit(1)
    } else {
      // No specific run - get latest for this lead
      planQuery = planQuery.eq('lead_id', leadId)
      planQuery = planQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: plan, error: planError } = await planQuery.single()

    if (planError || !plan) {
      // No plan exists yet - may still be generating via enrichment
      return NextResponse.json({
        plan: null,
        hasActions: false,
      })
    }

    // Get action items for this plan with new fields
    const { data: actions, error: actionsError } = await supabase
      .from('action_items')
      .select('*, consensus, implementation_steps, expected_outcome, source_insight')
      .eq('plan_id', plan.id)
      .order('priority', { ascending: true })
      .order('sort_order', { ascending: true })

    if (actionsError) {
      console.error('Error fetching action items:', actionsError)
      return NextResponse.json(
        { error: 'Failed to fetch action items' },
        { status: 500 }
      )
    }

    // Get completed action history from history table
    // For multi-domain: Include history matching EITHER the domain_subscription_id
    // OR history with NULL domain_subscription_id for this lead (legacy records before multi-domain)
    // This ensures we don't lose completed task history when transitioning to multi-domain
    let historyFromTable: { id: string; original_action_id: string | null; title: string; description: string; category: string | null; completed_at: string | null }[] | null = null
    let historyError: Error | null = null

    if (domainSubscriptionId) {
      // Query for both: matching domain_subscription_id OR legacy NULL records for this lead
      const { data, error } = await supabase
        .from('action_items_history')
        .select('id, original_action_id, title, description, category, completed_at')
        .eq('lead_id', leadId)
        .or(`domain_subscription_id.eq.${domainSubscriptionId},domain_subscription_id.is.null`)
        .order('completed_at', { ascending: false })
      historyFromTable = data
      historyError = error
    } else {
      const { data, error } = await supabase
        .from('action_items_history')
        .select('id, original_action_id, title, description, category, completed_at')
        .eq('lead_id', leadId)
        .order('completed_at', { ascending: false })
      historyFromTable = data
      historyError = error
    }

    if (historyError) {
      console.error('Error fetching action history:', historyError)
      // Don't fail - history is supplementary
    }

    // Also include any actions from current plan that are marked completed but not in history
    // This handles edge cases where history insert failed or data was migrated
    const completedActions = (actions || [])
      .filter((a: { status?: string }) => a.status === 'completed')
      .map((a: { id: string; title: string; description: string; category: string | null; completed_at: string | null }) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
        completed_at: a.completed_at,
      }))

    // Merge: history table + completed actions not already in history
    // Use original_action_id to match against current action IDs
    const historyOriginalIds = new Set((historyFromTable || []).map((h: { original_action_id: string | null }) => h.original_action_id).filter(Boolean))
    const historyTitles = new Set((historyFromTable || []).map((h: { title: string }) => h.title))

    const additionalFromActions = completedActions.filter(
      (a: { id: string; title: string }) => !historyOriginalIds.has(a.id) && !historyTitles.has(a.title)
    )

    const history = [...(historyFromTable || []), ...additionalFromActions]
      .sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return dateB - dateA // Most recent first
      })

    return NextResponse.json({
      plan: {
        ...plan,
        actions: actions || [],
      },
      hasActions: (actions?.length || 0) > 0,
      history,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/actions
 * Trigger regeneration of action plan (manual refresh)
 *
 * Note: Action plans are automatically generated during enrichment.
 * This endpoint can be used for manual regeneration if needed.
 * Requires authentication (session).
 */
export async function POST() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showActionPlans) {
      return NextResponse.json(
        { error: 'Upgrade to generate action plans' },
        { status: 403 }
      )
    }

    // Action plans are now generated automatically via the enrichment pipeline
    // This endpoint returns a message directing users to wait for enrichment
    return NextResponse.json({
      generated: false,
      message: 'Action plans are generated automatically during scan enrichment. If your plan is missing, please wait for enrichment to complete or contact support.',
    })
  } catch (error) {
    console.error('Error in POST /api/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
