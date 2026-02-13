/**
 * HiringBrand Super-Admin Brand Detail
 * GET — Returns frozen questions and competitors for a monitored domain.
 */

import { NextResponse } from 'next/server'
import { requireHBSuperAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireHBSuperAdmin()
    const { id } = await params
    const supabase = createServiceClient()

    const [{ data: questions }, { data: competitors }] = await Promise.all([
      supabase
        .from('hb_frozen_questions')
        .select('id, prompt_text, category, sort_order')
        .eq('monitored_domain_id', id)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('hb_frozen_competitors')
        .select('id, name, domain, reason, sort_order')
        .eq('monitored_domain_id', id)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    return NextResponse.json({
      questions: questions || [],
      competitors: competitors || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Super admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Admin brand detail error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
