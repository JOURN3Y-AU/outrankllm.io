/**
 * HiringBrand Dashboard Data API
 * Returns organization info, brands with latest scores, and team data (owner only).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireHBSession } from '@/lib/hiringbrand-auth'
import {
  getOrganizationMembers,
  getPendingInvites,
  canAddPrimaryDomain,
} from '@/lib/organization'
import { HB_TIER_NAMES, HB_DOMAIN_LIMITS } from '@/lib/hiringbrand-stripe'
import type { OrganizationTier } from '@/lib/organization'

export async function GET() {
  try {
    const { session, org, role } = await requireHBSession()

    const supabase = createServiceClient()

    // Fetch monitored domains with latest scan/report data
    const { data: brandsRaw, error: brandsError } = await supabase
      .rpc('get_hb_dashboard_brands', { org_id: org.id })

    // If RPC doesn't exist yet, fall back to a manual query
    let brands
    if (brandsError) {
      // Fallback: fetch domains then latest report for each
      const { data: domains } = await supabase
        .from('monitored_domains')
        .select('*')
        .eq('organization_id', org.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })

      brands = await Promise.all(
        (domains || []).map(async (md: { id: string; domain: string; company_name: string | null; is_primary: boolean; organization_id: string; created_at: string }) => {
          // Get latest scan run for this domain
          const { data: latestRun } = await supabase
            .from('scan_runs')
            .select('id, status, created_at')
            .eq('domain', md.domain)
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          let latestReport = null
          if (latestRun) {
            const { data: report } = await supabase
              .from('reports')
              .select('visibility_score, url_token, created_at')
              .eq('run_id', latestRun.id)
              .single()

            latestReport = report
          }

          return {
            id: md.id,
            domain: md.domain,
            companyName: md.company_name,
            isPrimary: md.is_primary,
            latestScore: latestReport?.visibility_score ?? null,
            latestReportToken: latestReport?.url_token ?? null,
            lastScanDate: latestReport?.created_at ?? latestRun?.created_at ?? null,
            scanStatus: latestRun?.status ?? null,
          }
        })
      )
    } else {
      brands = brandsRaw
    }

    // Team data (owner and admin)
    let team = null
    if (role === 'owner' || role === 'admin') {
      const [members, pendingInvites] = await Promise.all([
        getOrganizationMembers(org.id),
        getPendingInvites(org.id),
      ])

      team = {
        members: members.map((m) => ({
          id: m.lead_id,
          email: m.email,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        pendingInvites: pendingInvites.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: (inv as { role?: string }).role || 'viewer',
          createdAt: inv.created_at,
          expiresAt: inv.expires_at,
        })),
      }
    }

    // Viewers cannot add domains
    const canAdd = role !== 'viewer' && await canAddPrimaryDomain(org.id)

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        tier: org.tier,
        tierName: HB_TIER_NAMES[org.tier as OrganizationTier] || org.tier,
        domainLimit: HB_DOMAIN_LIMITS[org.tier as OrganizationTier] || org.domain_limit,
        status: org.status,
      },
      brands: brands || [],
      team,
      role,
      canAddDomain: canAdd,
      email: session.email,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'No organization found') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    console.error('Dashboard data error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
