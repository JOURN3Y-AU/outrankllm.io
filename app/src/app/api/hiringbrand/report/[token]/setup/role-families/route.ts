/**
 * HiringBrand Setup Role Families API
 * PUT: Bulk-save frozen role families for a brand
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireHBAdmin } from '@/lib/hiringbrand-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationById } from '@/lib/organization'

interface RouteParams {
  params: Promise<{ token: string }>
}

interface RoleFamilyInput {
  id?: string
  family: 'engineering' | 'business' | 'operations' | 'creative' | 'corporate' | 'general'
  displayName: string
  description?: string | null
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

    const { roleFamilies } = (await request.json()) as { roleFamilies: RoleFamilyInput[] }

    // Validate
    if (!Array.isArray(roleFamilies)) {
      return NextResponse.json({ error: 'roleFamilies must be an array' }, { status: 400 })
    }
    const orgData = await getOrganizationById(run.organization_id)
    const maxRoleFamilies = orgData?.max_role_families ?? 5
    if (roleFamilies.length > maxRoleFamilies) {
      return NextResponse.json({ error: `Maximum ${maxRoleFamilies} role families allowed` }, { status: 400 })
    }

    // Validate each role family
    const validFamilies = ['engineering', 'business', 'operations', 'creative', 'corporate', 'general']
    for (const rf of roleFamilies) {
      if (!validFamilies.includes(rf.family)) {
        return NextResponse.json({ error: `Invalid family: ${rf.family}` }, { status: 400 })
      }
      if (!rf.displayName?.trim()) {
        return NextResponse.json({ error: 'Each role family needs a display name' }, { status: 400 })
      }
    }

    // Check for duplicate families
    const familySet = new Set(roleFamilies.map((rf) => rf.family))
    if (familySet.size !== roleFamilies.length) {
      return NextResponse.json({ error: 'Duplicate family detected' }, { status: 400 })
    }

    // Deactivate all existing role families for this org+domain
    await supabase
      .from('hb_frozen_role_families')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('organization_id', org.id)
      .eq('monitored_domain_id', run.monitored_domain_id)

    // Upsert each role family
    for (const [index, rf] of roleFamilies.entries()) {
      if (rf.id) {
        // Existing role family — reactivate and update
        await supabase
          .from('hb_frozen_role_families')
          .update({
            family: rf.family,
            display_name: rf.displayName.trim(),
            description: rf.description?.trim() || null,
            is_active: true,
            sort_order: index,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rf.id)
          .eq('organization_id', org.id)
      } else {
        // New role family
        await supabase.from('hb_frozen_role_families').insert({
          organization_id: org.id,
          monitored_domain_id: run.monitored_domain_id,
          family: rf.family,
          display_name: rf.displayName.trim(),
          description: rf.description?.trim() || null,
          source: 'user_custom',
          is_active: true,
          sort_order: index,
        })
      }
    }

    return NextResponse.json({ success: true, count: roleFamilies.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Setup role-families PUT error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
