/**
 * HiringBrand Super-Admin Brand Detail
 * GET   — Returns frozen questions and competitors for a monitored domain.
 * PATCH — Update brand settings (e.g. schedule_paused).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBSuperAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHBSuperAdmin()
    const { id } = await params
    const { schedule_paused } = await request.json()

    if (typeof schedule_paused !== 'boolean') {
      return NextResponse.json({ error: 'schedule_paused must be a boolean' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('monitored_domains')
      .update({ schedule_paused })
      .eq('id', id)

    if (error) {
      console.error('Admin brand update error:', error)
      return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Super admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Admin brand update error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
