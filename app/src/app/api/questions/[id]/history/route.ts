import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/questions/[id]/history
 * Get the version history for a question
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()
    const { id } = await params

    // First verify the question belongs to this user
    const { data: question, error: questionError } = await supabase
      .from('subscriber_questions')
      .select('id, prompt_text, created_at')
      .eq('id', id)
      .eq('lead_id', session.lead_id)
      .single()

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Get the history entries
    const { data: history, error: historyError } = await supabase
      .from('question_history')
      .select('*')
      .eq('question_id', id)
      .order('version', { ascending: false })

    if (historyError) {
      console.error('Error fetching history:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      )
    }

    // Include the current version as version 0 (or the latest)
    const currentVersion = {
      id: 'current',
      question_id: id,
      prompt_text: question.prompt_text,
      version: (history?.[0]?.version || 0) + 1,
      created_at: question.created_at,
      is_current: true,
    }

    return NextResponse.json({
      current: currentVersion,
      history: history || [],
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/questions/[id]/history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
