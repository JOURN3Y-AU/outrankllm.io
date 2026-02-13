/**
 * HiringBrand Setup Competitors API
 * PUT: Bulk-save frozen competitors for a brand
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ token: string }>
}

interface CompetitorInput {
  id?: string
  name: string
  domain?: string | null
  reason?: string | null
}

/** Normalize a domain: strip protocol, www., and trailing slash */
function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let d = raw.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '')
  d = d.replace(/^www\./, '')
  d = d.replace(/\/+$/, '')
  return d || null
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

    const { competitors } = (await request.json()) as { competitors: CompetitorInput[] }

    // Validate
    if (!Array.isArray(competitors)) {
      return NextResponse.json({ error: 'competitors must be an array' }, { status: 400 })
    }
    if (competitors.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 competitors allowed' }, { status: 400 })
    }
    for (const c of competitors) {
      if (!c.name?.trim()) {
        return NextResponse.json({ error: 'Each competitor needs a name' }, { status: 400 })
      }
    }

    // Deactivate all existing competitors for this org+domain
    await supabase
      .from('hb_frozen_competitors')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('organization_id', org.id)
      .eq('monitored_domain_id', run.monitored_domain_id)

    // Upsert each competitor
    for (const [index, c] of competitors.entries()) {
      if (c.id) {
        // Existing competitor — reactivate and update
        await supabase
          .from('hb_frozen_competitors')
          .update({
            name: c.name.trim(),
            domain: normalizeDomain(c.domain),
            reason: c.reason?.trim() || null,
            is_active: true,
            sort_order: index,
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id)
          .eq('organization_id', org.id)
      } else {
        // New competitor
        await supabase.from('hb_frozen_competitors').insert({
          organization_id: org.id,
          monitored_domain_id: run.monitored_domain_id,
          name: c.name.trim(),
          domain: normalizeDomain(c.domain),
          reason: c.reason?.trim() || null,
          source: 'user_custom',
          is_active: true,
          sort_order: index,
        })
      }
    }

    return NextResponse.json({ success: true, count: competitors.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Setup competitors PUT error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
