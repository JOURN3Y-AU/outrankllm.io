import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface SubscriberCompetitor {
  id: string
  lead_id: string
  name: string
  source: 'detected' | 'user_added'
  is_active: boolean
  created_at: string
  updated_at: string
}

const MAX_COMPETITORS = 5 // Cost control: limit tracked competitors

/**
 * GET /api/competitors
 * List all competitors for the current user
 */
export async function GET() {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Get competitors for this lead
    const { data: competitors, error } = await supabase
      .from('subscriber_competitors')
      .select('*')
      .eq('lead_id', session.lead_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching competitors:', error)
      return NextResponse.json(
        { error: 'Failed to fetch competitors' },
        { status: 500 }
      )
    }

    // Get feature flags for this user
    const flags = await getFeatureFlags(session.tier)

    // Count only active competitors toward limit
    const activeCount = competitors?.filter((c: { is_active: boolean }) => c.is_active).length || 0

    return NextResponse.json({
      competitors: competitors || [],
      maxCompetitors: MAX_COMPETITORS,
      competitorCount: activeCount,
      canManage: flags.isSubscriber,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/competitors:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/competitors
 * Add a new competitor to track
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Get feature flags
    const flags = await getFeatureFlags(session.tier)

    if (!flags.isSubscriber) {
      return NextResponse.json(
        { error: 'Upgrade to add competitors' },
        { status: 403 }
      )
    }

    // Check current active competitor count (only count active ones toward limit)
    const { count, error: countError } = await supabase
      .from('subscriber_competitors')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', session.lead_id)
      .eq('is_active', true)

    if (countError) {
      console.error('Error counting competitors:', countError)
      return NextResponse.json(
        { error: 'Failed to check competitor limit' },
        { status: 500 }
      )
    }

    if ((count || 0) >= MAX_COMPETITORS) {
      return NextResponse.json(
        {
          error: `Competitor limit reached (${MAX_COMPETITORS} max)`,
          limit: MAX_COMPETITORS,
          current: count,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, source = 'user_added' } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Competitor name is required' },
        { status: 400 }
      )
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Competitor name must be 200 characters or less' },
        { status: 400 }
      )
    }

    // Create the competitor
    const { data: competitor, error: insertError } = await supabase
      .from('subscriber_competitors')
      .insert({
        lead_id: session.lead_id,
        name: name.trim(),
        source: source === 'detected' ? 'detected' : 'user_added',
      })
      .select()
      .single()

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This competitor is already in your list' },
          { status: 409 }
        )
      }
      console.error('Error creating competitor:', insertError)
      return NextResponse.json(
        { error: 'Failed to add competitor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      competitor,
      competitorCount: (count || 0) + 1,
      maxCompetitors: MAX_COMPETITORS,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/competitors:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
