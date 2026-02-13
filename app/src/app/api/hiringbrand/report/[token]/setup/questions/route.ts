/**
 * HiringBrand Setup Questions API
 * PUT: Bulk-save frozen questions for a brand
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ token: string }>
}

interface QuestionInput {
  id?: string
  promptText: string
  category: string
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const { org } = await requireHBAdmin()

    const supabase = createServiceClient()

    // Look up report context
    const { data: report } = await supabase
      .from('reports')
      .select('run:scan_runs(organization_id, monitored_domain_id)')
      .eq('url_token', token)
      .eq('brand', 'hiringbrand')
      .single()

    if (!report?.run) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const run = report.run as { organization_id: string; monitored_domain_id: string }
    if (run.organization_id !== org.id) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const { questions } = (await request.json()) as { questions: QuestionInput[] }

    // Validate
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'At least 1 question is required' }, { status: 400 })
    }
    if (questions.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 questions allowed' }, { status: 400 })
    }
    for (const q of questions) {
      if (!q.promptText?.trim() || !q.category?.trim()) {
        return NextResponse.json({ error: 'Each question needs promptText and category' }, { status: 400 })
      }
    }

    // Deactivate all existing questions for this org+domain
    await supabase
      .from('hb_frozen_questions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('organization_id', org.id)
      .eq('monitored_domain_id', run.monitored_domain_id)

    // Upsert each question
    for (const [index, q] of questions.entries()) {
      if (q.id) {
        // Existing question — reactivate and update
        await supabase
          .from('hb_frozen_questions')
          .update({
            prompt_text: q.promptText.trim(),
            category: q.category,
            is_active: true,
            sort_order: index,
            updated_at: new Date().toISOString(),
          })
          .eq('id', q.id)
          .eq('organization_id', org.id)
      } else {
        // New question
        await supabase.from('hb_frozen_questions').insert({
          organization_id: org.id,
          monitored_domain_id: run.monitored_domain_id,
          prompt_text: q.promptText.trim(),
          category: q.category,
          source: 'user_custom',
          is_active: true,
          sort_order: index,
        })
      }
    }

    return NextResponse.json({ success: true, count: questions.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Setup questions PUT error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
