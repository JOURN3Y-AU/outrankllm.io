import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

/**
 * PATCH /api/competitors/[id]
 * Update a competitor (toggle active status)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()
    const { id } = await params

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.isSubscriber) {
      return NextResponse.json(
        { error: 'Upgrade to manage competitors' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { is_active, domain_subscription_id } = body

    // Verify ownership with domain isolation
    let ownershipQuery = supabase
      .from('subscriber_competitors')
      .select('*')
      .eq('id', id)

    if (domain_subscription_id) {
      ownershipQuery = ownershipQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      ownershipQuery = ownershipQuery.eq('lead_id', session.lead_id)
    }

    const { data: existing, error: fetchError } = await ownershipQuery.single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}

    if (is_active !== undefined) {
      updates.is_active = is_active
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      )
    }

    // Update the competitor with domain isolation
    let updateQuery = supabase
      .from('subscriber_competitors')
      .update(updates)
      .eq('id', id)

    if (domain_subscription_id) {
      updateQuery = updateQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      updateQuery = updateQuery.eq('lead_id', session.lead_id)
    }

    const { data: competitor, error: updateError } = await updateQuery.select().single()

    if (updateError) {
      console.error('Error updating competitor:', updateError)
      return NextResponse.json(
        { error: 'Failed to update competitor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ competitor })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in PATCH /api/competitors/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/competitors/[id]
 * Remove a competitor (only user_added can be deleted)
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
    if (!flags.isSubscriber) {
      return NextResponse.json(
        { error: 'Upgrade to manage competitors' },
        { status: 403 }
      )
    }

    // Parse query params for domain isolation
    const { searchParams } = new URL(request.url)
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Verify ownership and check source with domain isolation
    let ownershipQuery = supabase
      .from('subscriber_competitors')
      .select('id, source')
      .eq('id', id)

    if (domainSubscriptionId) {
      ownershipQuery = ownershipQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      ownershipQuery = ownershipQuery.eq('lead_id', session.lead_id)
    }

    const { data: existing, error: fetchError } = await ownershipQuery.single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    // Only allow deleting user-added competitors
    // Detected competitors should be toggled inactive instead
    if (existing.source === 'detected') {
      return NextResponse.json(
        { error: 'Cannot delete detected competitors. Toggle them inactive instead.' },
        { status: 400 }
      )
    }

    // Delete the competitor with domain isolation
    let deleteQuery = supabase
      .from('subscriber_competitors')
      .delete()
      .eq('id', id)

    if (domainSubscriptionId) {
      deleteQuery = deleteQuery.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      deleteQuery = deleteQuery.eq('lead_id', session.lead_id)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting competitor:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete competitor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in DELETE /api/competitors/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
