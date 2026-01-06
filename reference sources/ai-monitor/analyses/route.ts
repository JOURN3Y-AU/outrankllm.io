import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/ai-monitor/analyses - List all analyses
// GET /api/ai-monitor/analyses?id=xxx - Get a specific analysis
export async function GET(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const analysisId = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (analysisId) {
      // Fetch a specific analysis
      const { data: analysis, error } = await supabase
        .from('ai_monitor_analyses')
        .select(`
          *,
          run:ai_monitor_runs(id, started_at, completed_at, status, triggered_by)
        `)
        .eq('id', analysisId)
        .single()

      if (error || !analysis) {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
      }

      return NextResponse.json(analysis)
    }

    // Fetch list of analyses (summary view)
    const { data: analyses, error } = await supabase
      .from('ai_monitor_analyses')
      .select(`
        id,
        run_id,
        created_at,
        summary,
        stats_snapshot,
        is_baseline,
        notes,
        processing_time_ms,
        was_forced_refresh,
        prd_output,
        run:ai_monitor_runs(id, started_at, triggered_by)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching analyses:', error)
      return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 })
    }

    // Transform to add has_prd flag (avoid sending full prd_output in list)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedAnalyses = (analyses || []).map((a: any) => ({
      ...a,
      has_prd: !!a.prd_output,
      prd_output: undefined // Remove full prd_output from list response
    }))

    return NextResponse.json(transformedAnalyses)
  } catch (error) {
    console.error('Analyses API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/ai-monitor/analyses - Update an analysis (notes, baseline status)
export async function PATCH(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, notes, is_baseline } = body

    if (!id) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (notes !== undefined) updates.notes = notes
    if (is_baseline !== undefined) updates.is_baseline = is_baseline

    const { data, error } = await supabase
      .from('ai_monitor_analyses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating analysis:', error)
      return NextResponse.json({ error: 'Failed to update analysis' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Analyses PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/ai-monitor/analyses - Delete an analysis
export async function DELETE(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ai_monitor_analyses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting analysis:', error)
      return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analyses DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
