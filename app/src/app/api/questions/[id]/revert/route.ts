import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

/**
 * POST /api/questions/[id]/revert
 * Revert a question to a previous version
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
        { error: 'Upgrade to revert questions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { version } = body

    if (typeof version !== 'number') {
      return NextResponse.json(
        { error: 'Version number is required' },
        { status: 400 }
      )
    }

    // Verify the question belongs to this user
    const { data: question, error: questionError } = await supabase
      .from('subscriber_questions')
      .select('*')
      .eq('id', id)
      .eq('lead_id', session.lead_id)
      .single()

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Get the history entry for the requested version
    const { data: historyEntry, error: historyError } = await supabase
      .from('question_history')
      .select('*')
      .eq('question_id', id)
      .eq('version', version)
      .single()

    if (historyError || !historyEntry) {
      return NextResponse.json(
        { error: 'Version not found in history' },
        { status: 404 }
      )
    }

    // Update the question to the historical version
    // This will trigger the history creation for the current version
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('subscriber_questions')
      .update({ prompt_text: historyEntry.prompt_text })
      .eq('id', id)
      .eq('lead_id', session.lead_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error reverting question:', updateError)
      return NextResponse.json(
        { error: 'Failed to revert question' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      question: updatedQuestion,
      revertedToVersion: version,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/questions/[id]/revert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
