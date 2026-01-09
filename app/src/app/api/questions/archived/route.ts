import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/questions/archived
 * List all archived questions for the current user
 */
export async function GET() {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    const { data: archivedQuestions, error } = await supabase
      .from('subscriber_questions')
      .select('*')
      .eq('lead_id', session.lead_id)
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching archived questions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch archived questions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      questions: archivedQuestions || [],
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/questions/archived:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
