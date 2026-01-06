import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePRDWithClaude } from '@/lib/ai-monitor/generatePRD'

export const maxDuration = 120 // Increased for Sonnet 4 with larger output

// Re-export types from shared module
export type { PRDTask, PRDOutput } from '@/lib/ai-monitor/generatePRD'

export async function POST(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { analysisId } = body

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 })
    }

    // Fetch the analysis (including any existing PRD output)
    const { data: analysis, error: fetchError } = await supabase
      .from('ai_monitor_analyses')
      .select('synthesized_recommendations, prd_output')
      .eq('id', analysisId)
      .single()

    if (fetchError || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Return cached PRD if available (no force regeneration option)
    if (analysis.prd_output) {
      return NextResponse.json({
        ...analysis.prd_output,
        cached: true
      })
    }

    if (!analysis.synthesized_recommendations) {
      return NextResponse.json({ error: 'No recommendations found in analysis' }, { status: 400 })
    }

    // Generate PRD tasks
    const prdResult = await generatePRDWithClaude(analysis.synthesized_recommendations)

    // Add generation timestamp
    const prdOutputWithMeta = {
      ...prdResult.prdOutput,
      generatedAt: new Date().toISOString()
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('ai_monitor_analyses')
      .update({ prd_output: prdOutputWithMeta })
      .eq('id', analysisId)

    if (updateError) {
      console.error('Error saving PRD output:', updateError)
      // Still return the result even if save fails
    }

    return NextResponse.json({
      ...prdResult.prdOutput,
      cached: false
    })
  } catch (error) {
    console.error('PRD generation error:', error)
    return NextResponse.json({
      error: 'Failed to generate PRD',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
