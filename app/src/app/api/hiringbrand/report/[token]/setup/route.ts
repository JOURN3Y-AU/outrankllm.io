/**
 * HiringBrand Setup API
 * GET: Fetch frozen questions + competitors for a brand
 * POST: Trigger a rescan (after saving setup changes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationById } from '@/lib/organization'
import { inngest } from '@/inngest/client'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** Look up report → org + monitored domain, verify caller owns it */
async function getReportContext(token: string, callerOrgId: string) {
  const supabase = createServiceClient()

  const { data: report } = await supabase
    .from('reports')
    .select('run:scan_runs(organization_id, monitored_domain_id, domain)')
    .eq('url_token', token)
    .eq('brand', 'hiringbrand')
    .single()

  if (!report?.run) return null

  const run = report.run as { organization_id: string; monitored_domain_id: string; domain: string }
  if (run.organization_id !== callerOrgId) return null

  return {
    organizationId: run.organization_id,
    monitoredDomainId: run.monitored_domain_id,
    domain: run.domain,
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const { org } = await requireHBAdmin()

    const ctx = await getReportContext(token, org.id)
    if (!ctx) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    // Fetch org limits
    const orgData = await getOrganizationById(ctx.organizationId)

    const [{ data: questions }, { data: competitors }, { data: roleFamilies }] = await Promise.all([
      supabase
        .from('hb_frozen_questions')
        .select('id, prompt_text, category, source, is_active, sort_order')
        .eq('organization_id', ctx.organizationId)
        .eq('monitored_domain_id', ctx.monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('hb_frozen_competitors')
        .select('id, name, domain, reason, source, is_active, sort_order')
        .eq('organization_id', ctx.organizationId)
        .eq('monitored_domain_id', ctx.monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('hb_frozen_role_families')
        .select('id, family, display_name, description, source, is_active, sort_order')
        .eq('organization_id', ctx.organizationId)
        .eq('monitored_domain_id', ctx.monitoredDomainId)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    return NextResponse.json({
      questions: (questions || []).map((q: Record<string, unknown>) => ({
        id: q.id,
        promptText: q.prompt_text,
        category: q.category,
        source: q.source || 'employer_research',
        sortOrder: q.sort_order,
      })),
      competitors: (competitors || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        reason: c.reason,
        source: c.source || 'employer_research',
        sortOrder: c.sort_order,
      })),
      roleFamilies: (roleFamilies || []).map((rf: Record<string, unknown>) => ({
        id: rf.id,
        family: rf.family,
        displayName: rf.display_name,
        description: rf.description,
        source: rf.source || 'employer_research',
        sortOrder: rf.sort_order,
      })),
      limits: {
        maxQuestions: orgData?.max_questions ?? 20,
        maxCompetitors: orgData?.max_competitors ?? 10,
        maxRoleFamilies: orgData?.max_role_families ?? 5,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Setup GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const { org } = await requireHBAdmin()

    const ctx = await getReportContext(token, org.id)
    if (!ctx) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const { action } = await request.json()

    if (action === 'rescan') {
      await inngest.send({
        name: 'hiringbrand/scan',
        data: {
          domain: ctx.domain,
          organizationId: ctx.organizationId,
          monitoredDomainId: ctx.monitoredDomainId,
        },
      })
      return NextResponse.json({ success: true, message: 'Scan triggered' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Setup POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
