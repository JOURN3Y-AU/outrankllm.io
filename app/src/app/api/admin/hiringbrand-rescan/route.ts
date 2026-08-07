/**
 * Admin endpoint to force a HiringBrand rescan.
 *
 * The HiringBrand triggers (dashboard/run-scan, hiringbrand/admin/scan) both
 * require a logged-in session cookie, so there was no way to kick off a scan
 * from a script or a terminal — /api/admin/rescan only fires `scan/process`,
 * the outrankllm pipeline. This is the HiringBrand counterpart, using the same
 * two auth methods as its outrankllm sibling:
 *   1. x-admin-secret header (programmatic/external access)
 *   2. Admin session cookie (admin UI)
 *
 * Accepts either an explicit monitoredDomainId, or a domain plus organizationId
 * to resolve one. Scans are dispatched as `hiringbrand/scan`, identical to what
 * the dashboard sends, so a rescan triggered here is indistinguishable from one
 * a customer starts themselves.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { getAdminSession } from '@/lib/admin'

interface TargetRequest {
  monitoredDomainId?: string
  domain?: string
  organizationId?: string
}

export async function POST(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    const hasValidSecret = adminSecret && adminSecret === process.env.ADMIN_SECRET
    const adminSession = await getAdminSession()

    if (!hasValidSecret && !adminSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Accept a single target or a batch, so a whole organization can be
    // rescanned in one call without racing separate requests.
    const rawTargets: TargetRequest[] = Array.isArray(body?.targets)
      ? body.targets
      : [body]

    if (rawTargets.length === 0) {
      return NextResponse.json(
        { error: 'Provide a target (monitoredDomainId, or domain + organizationId)' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const dispatched: Array<{ domain: string; companyName: string | null; monitoredDomainId: string }> = []
    const skipped: Array<{ target: TargetRequest; reason: string }> = []

    for (const target of rawTargets) {
      const { monitoredDomainId, domain, organizationId } = target || {}

      if (!monitoredDomainId && !(domain && organizationId)) {
        skipped.push({ target, reason: 'Need monitoredDomainId, or domain + organizationId' })
        continue
      }

      let query = supabase
        .from('monitored_domains')
        .select('id, domain, company_name, organization_id')

      if (monitoredDomainId) {
        query = query.eq('id', monitoredDomainId)
      } else {
        query = query.eq('domain', domain!.toLowerCase()).eq('organization_id', organizationId!)
      }

      const { data: md, error } = await query.single()

      if (error || !md) {
        skipped.push({ target, reason: 'Monitored domain not found' })
        continue
      }

      // A scan with no company name falls back to whatever the AI reads off the
      // crawled site, which has produced job-ad titles and a staff member's name
      // as the subject of an entire report. Refuse rather than burn a scan.
      if (!md.company_name || !md.company_name.trim()) {
        skipped.push({
          target,
          reason: `No company_name set for ${md.domain} — set one before rescanning`,
        })
        continue
      }

      await inngest.send({
        name: 'hiringbrand/scan',
        data: {
          domain: md.domain,
          organizationId: md.organization_id,
          monitoredDomainId: md.id,
        },
      })

      dispatched.push({
        domain: md.domain,
        companyName: md.company_name,
        monitoredDomainId: md.id,
      })
    }

    return NextResponse.json({
      success: dispatched.length > 0,
      dispatched,
      skipped,
    })
  } catch (error) {
    console.error('HiringBrand admin rescan error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
