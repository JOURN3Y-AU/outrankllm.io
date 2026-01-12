import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface SubscriberQuestion {
  id: string
  lead_id: string
  prompt_text: string
  category: string
  source: 'ai_generated' | 'user_created'
  is_active: boolean
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  original_prompt_id: string | null
  source_run_id: string | null
}

/**
 * GET /api/questions
 * List all questions for the current user (both custom and original scan prompts)
 * Pass domain_subscription_id query param for multi-domain isolation
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Parse domain_subscription_id from query params
    const { searchParams } = new URL(request.url)
    const domainSubscriptionId = searchParams.get('domain_subscription_id')

    // Get custom questions - use domain_subscription_id if provided for multi-domain isolation
    let query = supabase
      .from('subscriber_questions')
      .select('*')
      .eq('is_archived', false)

    if (domainSubscriptionId) {
      query = query.eq('domain_subscription_id', domainSubscriptionId)
    } else {
      // Legacy fallback
      query = query.eq('lead_id', session.lead_id)
    }

    const { data: customQuestions, error: customError } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (customError) {
      console.error('Error fetching custom questions:', customError)
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    // Get feature flags for this user
    const flags = await getFeatureFlags(session.tier)

    return NextResponse.json({
      questions: customQuestions || [],
      customQuestionLimit: flags.customQuestionLimit,
      customQuestionCount: customQuestions?.length || 0,
      canEdit: flags.editablePrompts,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/questions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/questions
 * Create a new custom question
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Get feature flags
    const flags = await getFeatureFlags(session.tier)

    if (!flags.editablePrompts) {
      return NextResponse.json(
        { error: 'Upgrade to add custom questions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { prompt_text, category = 'custom', domain_subscription_id } = body

    // Check current question count
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
          error: `Question limit reached (${flags.customQuestionLimit} max)`,
          limit: flags.customQuestionLimit,
          current: count,
        },
        { status: 403 }
      )
    }

    if (!prompt_text || typeof prompt_text !== 'string' || prompt_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      )
    }

    if (prompt_text.length > 500) {
      return NextResponse.json(
        { error: 'Question must be 500 characters or less' },
        { status: 400 }
      )
    }

    // Get the highest sort_order for this domain subscription or lead
    let sortQuery = supabase
      .from('subscriber_questions')
      .select('sort_order')

    if (domain_subscription_id) {
      sortQuery = sortQuery.eq('domain_subscription_id', domain_subscription_id)
    } else {
      sortQuery = sortQuery.eq('lead_id', session.lead_id)
    }

    const { data: maxOrderData } = await sortQuery
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxOrderData?.sort_order || 0) + 1

    // Create the question (user-created) with domain_subscription_id for multi-domain isolation
    const { data: question, error: insertError } = await supabase
      .from('subscriber_questions')
      .insert({
        lead_id: session.lead_id,
        domain_subscription_id: domain_subscription_id || null,
        prompt_text: prompt_text.trim(),
        category,
        source: 'user_created',
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating question:', insertError)
      return NextResponse.json(
        { error: 'Failed to create question' },
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
    console.error('Error in POST /api/questions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
