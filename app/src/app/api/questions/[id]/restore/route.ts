import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

/**
 * POST /api/questions/[id]/restore
 * Restore an archived question
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()
    const { id } = await params

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.editablePrompts) {
      return NextResponse.json(
        { error: 'Upgrade to manage questions' },
        { status: 403 }
      )
    }

    // Check if restoring would exceed the limit
    const { count, error: countError } = await supabase
      .from('subscriber_questions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', session.lead_id)
      .eq('is_archived', false)

    if (countError) {
      console.error('Error counting questions:', countError)
      return NextResponse.json(
        { error: 'Failed to check question limit' },
        { status: 500 }
      )
    }

    if ((count || 0) >= flags.customQuestionLimit) {
      return NextResponse.json(
        {
          error: `Cannot restore: question limit reached (${flags.customQuestionLimit} max)`,
          limit: flags.customQuestionLimit,
          current: count,
        },
        { status: 403 }
      )
    }

    // Verify the question exists and belongs to this user
    const { data: existing, error: fetchError } = await supabase
      .from('subscriber_questions')
      .select('*')
      .eq('id', id)
      .eq('lead_id', session.lead_id)
      .eq('is_archived', true)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Archived question not found' },
        { status: 404 }
      )
    }

    // Restore the question
    const { data: question, error: restoreError } = await supabase
      .from('subscriber_questions')
      .update({ is_archived: false, is_active: true })
      .eq('id', id)
      .eq('lead_id', session.lead_id)
      .select()
      .single()

    if (restoreError) {
      console.error('Error restoring question:', restoreError)
      return NextResponse.json(
        { error: 'Failed to restore question' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      question,
      customQuestionCount: (count || 0) + 1,
      customQuestionLimit: flags.customQuestionLimit,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/questions/[id]/restore:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
