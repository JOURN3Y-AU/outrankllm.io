import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

/**
 * GET /api/questions/[id]
 * Get a single question by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()
    const { id } = await params

    // Parse query params for domain isolation
    const { searchParams } = new URL(request.url)
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Build query with domain isolation
    let query = supabase
      .from('subscriber_questions')
      .select('*')
      .eq('id', id)

    if (domainSubscriptionId) {
      query = query.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      query = query.eq('lead_id', session.lead_id)
    }

    const { data: question, error } = await query.single()

    if (error || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ question })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/questions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/questions/[id]
 * Update a question's text
 */
export async function PUT(
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
        { error: 'Upgrade to edit questions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { prompt_text, category, is_active, sort_order, domain_subscription_id } = body

    // Verify ownership with domain isolation
    let ownershipQuery = supabase
      .from('subscriber_questions')
      .select('*')
      .eq('id', id)

    if (domain_subscription_id) {
      ownershipQuery = ownershipQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      ownershipQuery = ownershipQuery.eq('lead_id', session.lead_id)
    }

    const { data: existing, error: fetchError } = await ownershipQuery.single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}

    if (prompt_text !== undefined) {
      if (typeof prompt_text !== 'string' || prompt_text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Question text cannot be empty' },
          { status: 400 }
        )
      }
      if (prompt_text.length > 500) {
        return NextResponse.json(
          { error: 'Question must be 500 characters or less' },
          { status: 400 }
        )
      }
      updates.prompt_text = prompt_text.trim()
    }

    if (category !== undefined) {
      updates.category = category
    }

    if (is_active !== undefined) {
      updates.is_active = is_active
    }

    if (sort_order !== undefined) {
      updates.sort_order = sort_order
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      )
    }

    // Update the question (history is auto-created by trigger if prompt_text changed)
    let updateQuery = supabase
      .from('subscriber_questions')
      .update(updates)
      .eq('id', id)

    if (domain_subscription_id) {
      updateQuery = updateQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      updateQuery = updateQuery.eq('lead_id', session.lead_id)
    }

    const { data: question, error: updateError } = await updateQuery.select().single()

    if (updateError) {
      console.error('Error updating question:', updateError)
      return NextResponse.json(
        { error: 'Failed to update question' },
        { status: 500 }
      )
    }

    return NextResponse.json({ question })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in PUT /api/questions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/questions/[id]
 * Archive a question (soft delete)
 */
export async function DELETE(
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

    // Parse query params for domain isolation
    const { searchParams } = new URL(request.url)
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Verify ownership with domain isolation
    let ownershipQuery = supabase
      .from('subscriber_questions')
      .select('id')
      .eq('id', id)

    if (domainSubscriptionId) {
      ownershipQuery = ownershipQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      ownershipQuery = ownershipQuery.eq('lead_id', session.lead_id)
    }

    const { data: existing, error: fetchError } = await ownershipQuery.single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Archive the question (soft delete)
    let archiveQuery = supabase
      .from('subscriber_questions')
      .update({ is_archived: true, is_active: false })
      .eq('id', id)

    if (domainSubscriptionId) {
      archiveQuery = archiveQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      archiveQuery = archiveQuery.eq('lead_id', session.lead_id)
    }

    const { error: archiveError } = await archiveQuery

    if (archiveError) {
      console.error('Error archiving question:', archiveError)
      return NextResponse.json(
        { error: 'Failed to archive question' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in DELETE /api/questions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
