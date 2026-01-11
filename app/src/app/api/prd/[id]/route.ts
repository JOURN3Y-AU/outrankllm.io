import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

/**
 * PATCH /api/prd/[id]
 * Update a PRD task's status (complete/dismiss/reopen)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()
    const { id: taskId } = await params

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to access PRD features' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status } = body

    if (!status || !['pending', 'completed', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, completed, or dismissed.' },
        { status: 400 }
      )
    }

    // Get the task and verify ownership
    const { data: task, error: taskError } = await supabase
      .from('prd_tasks')
      .select(`
        id,
        title,
        description,
        section,
        category,
        prd_id,
        prd_documents!inner(lead_id, run_id)
      `)
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Verify the task belongs to this user
    const prdDoc = task.prd_documents as { lead_id: string; run_id: string }
    if (prdDoc.lead_id !== session.lead_id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Update the task status
    const updateData: { status: string; completed_at: string | null } = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }

    const { error: updateError } = await supabase
      .from('prd_tasks')
      .update(updateData)
      .eq('id', taskId)

    if (updateError) {
      console.error('Error updating PRD task:', updateError)
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      )
    }

    // If completing, also add to history for preservation across regenerations
    // Use upsert to prevent duplicate entries if task was already in history
    if (status === 'completed') {
      await supabase
        .from('prd_tasks_history')
        .upsert(
          {
            lead_id: session.lead_id,
            original_task_id: taskId,
            title: task.title,
            description: task.description,
            section: task.section,
            category: task.category,
            scan_run_id: prdDoc.run_id,
          },
          { onConflict: 'lead_id,original_task_id', ignoreDuplicates: true }
        )
    }

    return NextResponse.json({
      success: true,
      task_id: taskId,
      status,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in PATCH /api/prd/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
