import { NextResponse } from 'next/server'

// PRD generation uses extended thinking which can take 4-6 minutes
// Vercel Pro with Fluid Compute supports up to 800s max
export const maxDuration = 600

import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'
import {
  generatePrd,
  type ActionPlanContext,
  type SiteContext,
} from '@/lib/ai/generate-prd'

export interface PrdTask {
  id: string
  title: string
  description: string
  acceptance_criteria: string[] | null
  section: 'quick_wins' | 'strategic' | 'backlog'
  category: string | null
  priority: number
  estimated_hours: number | null
  file_paths: string[] | null
  code_snippets: Record<string, string> | null
  prompt_context: string | null
  implementation_notes: string | null
  sort_order: number
  status: 'pending' | 'completed' | 'dismissed'
  completed_at: string | null
}

export interface PrdDocument {
  id: string
  run_id: string
  title: string
  overview: string | null
  goals: string[] | null
  tech_stack: string[] | null
  target_platforms: string[] | null
  generated_at: string
  tasks: PrdTask[]
}

/**
 * GET /api/prd
 * Get PRD document for the current user's latest run
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - PRD requires Pro or Agency
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to access PRD generation' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Get the PRD document
    // Use domain_subscription_id if provided for multi-domain isolation
    let prdQuery = supabase
      .from('prd_documents')
      .select('*')

    if (domainSubscriptionId) {
      prdQuery = prdQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      // Legacy fallback
      prdQuery = prdQuery.eq('lead_id', session.lead_id)
    }

    if (runId) {
      prdQuery = prdQuery.eq('run_id', runId)
    } else {
      prdQuery = prdQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: prd, error: prdError } = await prdQuery.single()

    if (prdError || !prd) {
      return NextResponse.json({
        prd: null,
        hasPrd: false,
      })
    }

    // Get tasks for this PRD
    const { data: tasks, error: tasksError } = await supabase
      .from('prd_tasks')
      .select('*')
      .eq('prd_id', prd.id)
      .order('section', { ascending: true })
      .order('sort_order', { ascending: true })

    if (tasksError) {
      console.error('Error fetching PRD tasks:', tasksError)
      return NextResponse.json(
        { error: 'Failed to fetch PRD tasks' },
        { status: 500 }
      )
    }

    // Get completed task history from history table
    // For multi-domain: Include history matching EITHER the domain_subscription_id
    // OR history with NULL domain_subscription_id for this lead (legacy records before multi-domain)
    // This ensures we don't lose completed task history when transitioning to multi-domain
    const prdDomainSubId = prd.domain_subscription_id
    let historyFromTable: { id: string; original_task_id: string | null; title: string; description: string; section: string; category: string | null; completed_at: string | null }[] | null = null
    let historyError: Error | null = null

    if (prdDomainSubId) {
      // Query for both: matching domain_subscription_id OR legacy NULL records for this lead
      const { data, error } = await supabase
        .from('prd_tasks_history')
        .select('id, original_task_id, title, description, section, category, completed_at')
        .eq('lead_id', session.lead_id)
        .or(`domain_subscription_id.eq.${prdDomainSubId},domain_subscription_id.is.null`)
        .order('completed_at', { ascending: false })
      historyFromTable = data
      historyError = error
    } else {
      // Fallback to lead_id for legacy PRDs without domain_subscription_id
      const { data, error } = await supabase
        .from('prd_tasks_history')
        .select('id, original_task_id, title, description, section, category, completed_at')
        .eq('lead_id', session.lead_id)
        .order('completed_at', { ascending: false })
      historyFromTable = data
      historyError = error
    }

    if (historyError) {
      console.error('Error fetching PRD task history:', historyError)
      // Don't fail - history is supplementary
    }

    // Also include any tasks from current PRD that are marked completed but not in history
    // This handles edge cases where history insert failed or data was migrated
    const completedTasks = (tasks || [])
      .filter((t: { status?: string }) => t.status === 'completed')
      .map((t: { id: string; title: string; description: string; section: string; category: string | null; completed_at: string | null }) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        section: t.section,
        category: t.category,
        completed_at: t.completed_at,
      }))

    // Merge: history table + completed tasks not already in history
    // Use original_task_id to match against current task IDs
    const historyOriginalIds = new Set((historyFromTable || []).map((h: { original_task_id: string | null }) => h.original_task_id).filter(Boolean))
    const historyTitles = new Set((historyFromTable || []).map((h: { title: string }) => h.title))

    const additionalFromTasks = completedTasks.filter(
      (t: { id: string; title: string }) => !historyOriginalIds.has(t.id) && !historyTitles.has(t.title)
    )

    const history = [...(historyFromTable || []), ...additionalFromTasks]
      .sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return dateB - dateA // Most recent first
      })

    return NextResponse.json({
      prd: {
        ...prd,
        tasks: tasks || [],
      },
      hasPrd: true,
      history: history || [],
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/prd:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prd
 * Generate PRD document for a specific run using AI
 *
 * Note: PRDs are now automatically generated during the enrichment pipeline
 * for Pro/Agency subscribers. This endpoint is for manual regeneration.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - PRD requires Pro or Agency
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to generate PRDs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { run_id, force_regenerate = false, domain_subscription_id } = body

    // Get run_id if not provided
    let targetRunId = run_id
    let targetDomainSubscriptionId = domain_subscription_id
    if (!targetRunId) {
      // Build query with domain isolation
      let latestRunQuery = supabase
        .from('scan_runs')
        .select('id, domain_subscription_id')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)

      if (domain_subscription_id) {
        latestRunQuery = latestRunQuery.eq('domain_subscription_id', domain_subscription_id)
      } else {
        latestRunQuery = latestRunQuery.eq('lead_id', session.lead_id)
      }

      const { data: latestRun } = await latestRunQuery.single()

      if (!latestRun) {
        return NextResponse.json(
          { error: 'No completed scans found' },
          { status: 404 }
        )
      }
      targetRunId = latestRun.id
      targetDomainSubscriptionId = latestRun.domain_subscription_id
    }

    // Check if PRD already exists
    const { data: existingPrd } = await supabase
      .from('prd_documents')
      .select('id')
      .eq('run_id', targetRunId)
      .single()

    if (existingPrd && !force_regenerate) {
      return NextResponse.json({
        generated: false,
        message: 'PRD already exists for this run. Set force_regenerate=true to regenerate.',
        prd_id: existingPrd.id,
      })
    }

    // If force regenerating, delete existing PRD
    if (existingPrd && force_regenerate) {
      await supabase.from('prd_documents').delete().eq('id', existingPrd.id)
    }

    // Get action plan (required for AI generation)
    const { data: actionPlan } = await supabase
      .from('action_plans')
      .select('id, executive_summary, page_edits, keyword_map')
      .eq('run_id', targetRunId)
      .single()

    if (!actionPlan) {
      return NextResponse.json(
        { error: 'No action plan found. PRDs are generated from action plans. Ensure your scan has completed enrichment.' },
        { status: 400 }
      )
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('plan_id', actionPlan.id)
      .order('sort_order', { ascending: true })

    if (!actionItems || actionItems.length === 0) {
      return NextResponse.json(
        { error: 'No action items found in the action plan' },
        { status: 400 }
      )
    }

    // Get site analysis for context
    const { data: analysis } = await supabase
      .from('site_analyses')
      .select('business_name, business_type, services')
      .eq('run_id', targetRunId)
      .single()

    // CRITICAL: Get domain from the correct source for multi-domain support
    // Priority: 1) domain_subscription 2) scan_run 3) lead.domain (legacy fallback)
    let resolvedDomain: string | null = null

    // Try 1: Get from domain_subscription
    if (targetDomainSubscriptionId) {
      const { data: domainSub } = await supabase
        .from('domain_subscriptions')
        .select('domain')
        .eq('id', targetDomainSubscriptionId)
        .single()
      if (domainSub) {
        resolvedDomain = domainSub.domain
      }
    }

    // Try 2: Get from scan_run
    if (!resolvedDomain) {
      const { data: scanRun } = await supabase
        .from('scan_runs')
        .select('domain')
        .eq('id', targetRunId)
        .single()
      if (scanRun?.domain) {
        resolvedDomain = scanRun.domain
      }
    }

    // Try 3: Fallback to lead.domain (legacy)
    if (!resolvedDomain) {
      const { data: lead } = await supabase
        .from('leads')
        .select('domain')
        .eq('id', session.lead_id)
        .single()
      if (lead?.domain) {
        resolvedDomain = lead.domain
      }
    }

    // Build action plan context for PRD generation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionPlanContext: ActionPlanContext = {
      executiveSummary: actionPlan.executive_summary,
      actions: actionItems.map((item: {
        id: string
        title: string
        description: string
        rationale: string | null
        source_insight: string | null
        priority: 'quick_win' | 'strategic' | 'backlog'
        category: string | null
        estimated_impact: string | null
        estimated_effort: string | null
        target_page: string | null
        target_keywords: string[] | null
        consensus: string[] | null
        implementation_steps: string[] | null
        expected_outcome: string | null
      }) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        rationale: item.rationale,
        sourceInsight: item.source_insight,
        priority: item.priority,
        category: item.category,
        estimatedImpact: item.estimated_impact,
        estimatedEffort: item.estimated_effort,
        targetPage: item.target_page,
        targetKeywords: item.target_keywords,
        consensus: item.consensus,
        implementationSteps: item.implementation_steps,
        expectedOutcome: item.expected_outcome,
      })),
      pageEdits: actionPlan.page_edits,
      keywordMap: actionPlan.keyword_map,
    }

    const siteContext: SiteContext = {
      domain: resolvedDomain || 'unknown',
      businessName: analysis?.business_name || null,
      businessType: analysis?.business_type || null,
      techStack: ['Next.js', 'React', 'TypeScript'],
      services: analysis?.services || null,
    }

    // Generate PRD using AI
    const generatedPrd = await generatePrd(actionPlanContext, siteContext, targetRunId)

    // Save PRD document with domain isolation
    const { data: prd, error: prdError } = await supabase
      .from('prd_documents')
      .insert({
        lead_id: session.lead_id,
        domain_subscription_id: targetDomainSubscriptionId,
        run_id: targetRunId,
        title: generatedPrd.title,
        overview: generatedPrd.overview,
        goals: generatedPrd.goals,
        tech_stack: generatedPrd.techStack,
        target_platforms: generatedPrd.targetPlatforms,
      })
      .select()
      .single()

    if (prdError || !prd) {
      console.error('Error creating PRD:', prdError)
      return NextResponse.json(
        { error: 'Failed to create PRD' },
        { status: 500 }
      )
    }

    // Insert tasks
    const tasksToInsert = generatedPrd.tasks.map((task, index) => ({
      prd_id: prd.id,
      title: task.title,
      description: task.description,
      acceptance_criteria: task.acceptanceCriteria,
      section: task.section,
      category: task.category,
      priority: task.priority,
      estimated_hours: task.estimatedHours,
      file_paths: task.filePaths,
      code_snippets: task.codeSnippets,
      prompt_context: task.promptContext,
      implementation_notes: task.implementationNotes,
      requires_content: task.requiresContent,
      content_prompts: task.contentPrompts,
      sort_order: index,
    }))

    const { error: tasksError } = await supabase
      .from('prd_tasks')
      .insert(tasksToInsert)

    if (tasksError) {
      console.error('Error inserting PRD tasks:', tasksError)
    }

    return NextResponse.json({
      generated: true,
      prd_id: prd.id,
      tasks_count: generatedPrd.tasks.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/prd:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/prd
 * Bulk update PRD task statuses (e.g., mark all as complete)
 */
export async function PUT(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to access PRD features' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { prd_id, task_ids, status } = body

    if (!prd_id || !status || !['pending', 'completed', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'prd_id and valid status required' },
        { status: 400 }
      )
    }

    // Verify PRD ownership (include domain_subscription_id for history)
    const { data: prd, error: prdError } = await supabase
      .from('prd_documents')
      .select('id, lead_id, run_id, domain_subscription_id')
      .eq('id', prd_id)
      .single()

    if (prdError || !prd) {
      return NextResponse.json(
        { error: 'PRD not found' },
        { status: 404 }
      )
    }

    if (prd.lead_id !== session.lead_id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Build query - either specific task_ids or all tasks in the PRD
    let query = supabase
      .from('prd_tasks')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('prd_id', prd_id)

    if (task_ids && Array.isArray(task_ids) && task_ids.length > 0) {
      query = query.in('id', task_ids)
    }

    const { error: updateError } = await query

    if (updateError) {
      console.error('Error bulk updating PRD tasks:', updateError)
      return NextResponse.json(
        { error: 'Failed to update tasks' },
        { status: 500 }
      )
    }

    // If marking as complete, add all to history
    if (status === 'completed') {
      // Get the tasks that were updated
      let tasksQuery = supabase
        .from('prd_tasks')
        .select('id, title, description, section, category')
        .eq('prd_id', prd_id)

      if (task_ids && Array.isArray(task_ids) && task_ids.length > 0) {
        tasksQuery = tasksQuery.in('id', task_ids)
      }

      const { data: tasks } = await tasksQuery

      if (tasks && tasks.length > 0) {
        // Get existing history entries to avoid duplicates
        const taskIds = tasks.map((t: { id: string }) => t.id)
        const { data: existingHistory } = await supabase
          .from('prd_tasks_history')
          .select('original_task_id')
          .eq('lead_id', session.lead_id)
          .in('original_task_id', taskIds)

        const existingTaskIds = new Set((existingHistory || []).map((h: { original_task_id: string }) => h.original_task_id))

        // Filter out tasks already in history
        const newTasks = tasks.filter((t: { id: string }) => !existingTaskIds.has(t.id))

        if (newTasks.length > 0) {
          const historyEntries = newTasks.map((task: { id: string; title: string; description: string; section: string; category: string | null }) => ({
            lead_id: session.lead_id,
            domain_subscription_id: prd.domain_subscription_id,
            original_task_id: task.id,
            title: task.title,
            description: task.description,
            section: task.section,
            category: task.category,
            scan_run_id: prd.run_id,
          }))

          const { error: historyError } = await supabase
            .from('prd_tasks_history')
            .insert(historyEntries)

          if (historyError) {
            console.error('Error adding PRD tasks to history:', historyError)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      prd_id,
      status,
      updated_count: task_ids?.length || 'all',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in PUT /api/prd:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
