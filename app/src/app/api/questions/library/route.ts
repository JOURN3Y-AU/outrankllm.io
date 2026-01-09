import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

interface LibraryQuestion {
  id: string
  prompt_text: string
  category: string
  source: 'ai_generated' | 'user_created'
  is_active: boolean
  is_archived: boolean
  created_at: string
  source_run_id: string | null
}

interface SubscriberQuestionRow {
  id: string
  lead_id: string
  prompt_text: string
  category: string
  source: 'ai_generated' | 'user_created' | null
  is_active: boolean
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  original_prompt_id: string | null
  source_run_id: string | null
}

/**
 * GET /api/questions/library
 * Get the full question library for a user, grouped by category
 * Falls back to scan_prompts if subscriber_questions table doesn't exist or is empty
 */
export async function GET() {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.editablePrompts) {
      return NextResponse.json(
        { error: 'Upgrade to access question library' },
        { status: 403 }
      )
    }

    // Try to get subscriber questions first
    let questions: SubscriberQuestionRow[] = []
    let usesScanPrompts = false

    const result = await supabase
      .from('subscriber_questions')
      .select('*')
      .eq('lead_id', session.lead_id)
      .order('created_at', { ascending: false })

    // If subscriber_questions table exists and has data, use it
    if (!result.error && result.data && result.data.length > 0) {
      questions = result.data as SubscriberQuestionRow[]
    } else {
      // Fall back to scan_prompts from the user's latest run
      usesScanPrompts = true

      // Get the user's latest run
      const { data: latestRun } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('lead_id', session.lead_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestRun) {
        // Get prompts from that run
        const { data: scanPrompts } = await supabase
          .from('scan_prompts')
          .select('id, prompt_text, category, created_at')
          .eq('run_id', latestRun.id)
          .order('id', { ascending: true })

        if (scanPrompts) {
          // Convert scan_prompts to library format
          questions = scanPrompts.map((p: { id: string; prompt_text: string; category: string; created_at: string }, index: number) => ({
            id: p.id,
            lead_id: session.lead_id,
            prompt_text: p.prompt_text,
            category: p.category || 'other',
            source: 'ai_generated' as const,
            is_active: true,
            is_archived: false,
            sort_order: index,
            created_at: p.created_at,
            updated_at: p.created_at,
            original_prompt_id: p.id,
            source_run_id: latestRun.id,
          }))
        }
      }
    }

    // Group by category
    const grouped: Record<string, LibraryQuestion[]> = {}
    for (const q of questions) {
      const category = q.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push({
        id: q.id,
        prompt_text: q.prompt_text,
        category: q.category,
        source: q.source || 'ai_generated',
        is_active: q.is_active,
        is_archived: q.is_archived,
        created_at: q.created_at,
        source_run_id: q.source_run_id,
      })
    }

    // Get counts
    const totalCount = questions.length
    const activeCount = questions.filter(q => q.is_active && !q.is_archived).length
    const archivedCount = questions.filter(q => q.is_archived).length
    const aiGeneratedCount = questions.filter(q => q.source === 'ai_generated').length
    const userCreatedCount = questions.filter(q => q.source === 'user_created').length

    return NextResponse.json({
      questions: grouped,
      counts: {
        total: totalCount,
        active: activeCount,
        archived: archivedCount,
        aiGenerated: aiGeneratedCount,
        userCreated: userCreatedCount,
      },
      limit: flags.customQuestionLimit,
      usesScanPrompts, // Let the client know this is showing original prompts
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/questions/library:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/questions/library/seed
 * Seed initial questions from the user's current prompts
 * Called when a subscriber first accesses their questions
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.editablePrompts) {
      return NextResponse.json(
        { error: 'Upgrade to seed questions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { prompts, runId } = body

    if (!prompts || !Array.isArray(prompts)) {
      return NextResponse.json(
        { error: 'Prompts array is required' },
        { status: 400 }
      )
    }

    // Check if user already has questions seeded
    const { count: existingCount } = await supabase
      .from('subscriber_questions')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', session.lead_id)

    if (existingCount && existingCount > 0) {
      return NextResponse.json({
        seeded: false,
        message: 'Questions already seeded',
        count: existingCount,
      })
    }

    // Seed the questions
    const questionsToInsert = prompts.map((p: { id: string; prompt_text: string; category: string }, index: number) => ({
      lead_id: session.lead_id,
      prompt_text: p.prompt_text,
      category: p.category || 'other',
      source: 'ai_generated',
      is_active: true,
      is_archived: false,
      sort_order: index,
      original_prompt_id: p.id,
      source_run_id: runId || null,
    }))

    const { data: seededQuestions, error } = await supabase
      .from('subscriber_questions')
      .insert(questionsToInsert)
      .select()

    if (error) {
      console.error('Error seeding questions:', error)
      return NextResponse.json(
        { error: 'Failed to seed questions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      seeded: true,
      count: seededQuestions?.length || 0,
      questions: seededQuestions,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/questions/library:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
