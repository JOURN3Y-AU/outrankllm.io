import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

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
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showActionPlans) {
      return NextResponse.json(
        { error: 'Upgrade to access action plans' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')

    // Get the action plan with new fields
    let planQuery = supabase
      .from('action_plans')
      .select('*, page_edits, keyword_map, key_takeaways')
      .eq('lead_id', session.lead_id)

    if (runId) {
      planQuery = planQuery.eq('run_id', runId)
    } else {
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

    // Get completed action history
    const { data: history, error: historyError } = await supabase
      .from('action_items_history')
      .select('id, title, description, category, completed_at')
      .eq('lead_id', session.lead_id)
      .order('completed_at', { ascending: false })

    if (historyError) {
      console.error('Error fetching action history:', historyError)
      // Don't fail - history is supplementary
    }

    return NextResponse.json({
      plan: {
        ...plan,
        actions: actions || [],
      },
      hasActions: (actions?.length || 0) > 0,
      history: history || [],
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
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
