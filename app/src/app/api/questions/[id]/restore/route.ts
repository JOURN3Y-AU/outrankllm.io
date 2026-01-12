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

    // Parse body for domain isolation
    const body = await request.json().catch(() => ({}))
    const { domain_subscription_id } = body

    // Check if restoring would exceed the limit with domain isolation
    let countQuery = supabase
      .from('subscriber_questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false)

    if (domain_subscription_id) {
      countQuery = countQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      countQuery = countQuery.eq('lead_id', session.lead_id)
    }

    const { count, error: countError } = await countQuery

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

    // Verify the question exists and belongs to this user with domain isolation
    let ownershipQuery = supabase
      .from('subscriber_questions')
      .select('*')
      .eq('id', id)
      .eq('is_archived', true)

    if (domain_subscription_id) {
      ownershipQuery = ownershipQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      ownershipQuery = ownershipQuery.eq('lead_id', session.lead_id)
    }

    const { data: existing, error: fetchError } = await ownershipQuery.single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Archived question not found' },
        { status: 404 }
      )
    }

    // Restore the question with domain isolation
    let restoreQuery = supabase
      .from('subscriber_questions')
      .update({ is_archived: false, is_active: true })
      .eq('id', id)

    if (domain_subscription_id) {
      restoreQuery = restoreQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      restoreQuery = restoreQuery.eq('lead_id', session.lead_id)
    }

    const { data: question, error: restoreError } = await restoreQuery.select().single()

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
