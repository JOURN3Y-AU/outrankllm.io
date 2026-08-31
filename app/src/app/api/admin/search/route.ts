import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin'

/**
 * Admin search endpoint - find users/reports by email, domain, or token
 *
 * GET /api/admin/search?q=xxx
 *
 * The search automatically detects the query type:
 * - Token: exactly 12 alphanumeric chars → direct token lookup
 * - Email (contains @): search emails
 * - Otherwise: search BOTH emails AND domains (fuzzy match)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminSession()

    const query = request.nextUrl.searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Detect query type
    // Report tokens are 16-character hex strings (e.g., 68bbc4f0e39003a6)
    const isToken = /^[a-fA-F0-9]{16}$/.test(query)
    const isDefinitelyEmail = query.includes('@')

    interface SearchResult {
      type: 'report' | 'lead'
      token?: string
      email: string
      domain: string
      tier: string
      visibility_score?: number
      created_at: string
      expires_at?: string | null
      is_expired?: boolean
      lead_id: string
    }

    const results: SearchResult[] = []

    // One row per lead AND domain. Keying on lead alone hid every domain on a
    // multi-domain account except the most recently scanned one.
    const seen = new Set<string>()

    const addResult = (result: SearchResult) => {
      const key = `${result.lead_id}::${(result.domain || '').toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      results.push(result)
    }

    interface LeadRow {
      id: string
      email: string
      domain: string
      tier: string
      created_at: string
    }

    interface ReportRow {
      url_token: string
      visibility_score: number
      created_at: string
      expires_at: string | null
      run: { lead_id: string; domain: string | null }
    }

    interface ScanDomainReportRow {
      url_token: string
      visibility_score: number
      created_at: string
      expires_at: string | null
      run: { domain: string | null; lead: LeadRow | null } | null
    }

    if (isToken) {
      // Search by report token - exact match
      const { data: report } = await supabase
        .from('reports')
        .select(`
          url_token,
          visibility_score,
          created_at,
          expires_at,
          run:scan_runs(
            domain,
            lead:leads(id, email, domain, tier)
          )
        `)
        .eq('url_token', query)
        .single()

      if (report?.run?.lead) {
        const lead = report.run.lead as { id: string; email: string; domain: string; tier: string }
        const scanDomain = report.run.domain as string | null
        addResult({
          type: 'report',
          token: report.url_token,
          email: lead.email,
          domain: scanDomain || lead.domain,
          tier: lead.tier,
          visibility_score: report.visibility_score,
          created_at: report.created_at,
          expires_at: report.expires_at,
          is_expired: report.expires_at ? new Date(report.expires_at) < new Date() : false,
          lead_id: lead.id,
        })
      }

      return NextResponse.json({
        success: true,
        query,
        queryType: 'token',
        results,
        totalFound: results.length,
      })
    }

    // For non-token searches, collect every lead whose email or domain matches,
    // then list one row per DOMAIN they have scanned.
    //
    // This used to key on lead_id alone: the email pass took each lead's single
    // most recent report and marked the lead seen, and the domain passes then
    // skipped it. On a multi-domain account only the most recently scanned
    // domain was reachable. Searching "therecruitmentcompany.com" returned
    // theservicescompany.com, because that domain had scanned six hours earlier
    // under the same login, and the domain actually searched for could not be
    // opened from admin at all.
    const candidateLeads = new Map<string, LeadRow>()

    const { data: emailLeads } = await supabase
      .from('leads')
      .select('id, email, domain, tier, created_at')
      .ilike('email', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const lead of (emailLeads || []) as LeadRow[]) {
      candidateLeads.set(lead.id, lead)
    }

    const normalizedDomain = query
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]

    if (!isDefinitelyEmail) {
      const { data: domainLeads } = await supabase
        .from('leads')
        .select('id, email, domain, tier, created_at')
        .ilike('domain', `%${normalizedDomain}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      for (const lead of (domainLeads || []) as LeadRow[]) {
        candidateLeads.set(lead.id, lead)
      }
    }

    // Per-domain tier. The badge used to show leads.tier, which is the account's
    // highest tier, so every domain on a multi-domain account looked like the
    // best one — a Starter domain sitting beside two Pro domains rendered as
    // Pro. domain_subscriptions holds the tier actually being paid for.
    const tierByLeadDomain = new Map<string, string>()

    // Every report belonging to those leads, newest first. One query rather than
    // one per lead, so adding per-domain rows costs nothing.
    const leadIds = [...candidateLeads.keys()]
    const reportRows: ReportRow[] = []

    if (leadIds.length > 0) {
      const { data: subs } = await supabase
        .from('domain_subscriptions')
        .select('lead_id, domain, tier')
        .in('lead_id', leadIds)

      for (const sub of (subs || []) as { lead_id: string; domain: string; tier: string }[]) {
        tierByLeadDomain.set(`${sub.lead_id}::${sub.domain.toLowerCase()}`, sub.tier)
      }

      const { data } = await supabase
        .from('reports')
        .select(`
          url_token,
          visibility_score,
          created_at,
          expires_at,
          run:scan_runs!inner(lead_id, domain)
        `)
        .in('run.lead_id', leadIds)
        .order('created_at', { ascending: false })
        .limit(200)

      reportRows.push(...((data || []) as unknown as ReportRow[]))
    }

    for (const report of reportRows) {
      const lead = candidateLeads.get(report.run.lead_id)
      if (!lead) continue
      const reportDomain = report.run.domain || lead.domain
      addResult({
        type: 'report',
        token: report.url_token,
        email: lead.email,
        domain: reportDomain,
        tier: tierByLeadDomain.get(`${lead.id}::${(reportDomain || '').toLowerCase()}`) ?? lead.tier,
        visibility_score: report.visibility_score,
        created_at: report.created_at,
        expires_at: report.expires_at,
        is_expired: report.expires_at ? new Date(report.expires_at) < new Date() : false,
        lead_id: lead.id,
      })
    }

    // Leads with no report at all still deserve a row.
    for (const lead of candidateLeads.values()) {
      if (reportRows.some((r) => r.run.lead_id === lead.id)) continue
      addResult({
        type: 'lead',
        email: lead.email,
        domain: lead.domain,
        tier: lead.tier,
        created_at: lead.created_at,
        lead_id: lead.id,
      })
    }

    // Finally, reports whose SCANNED domain matches even though the owning lead's
    // email and lead.domain do not — the common shape for a domain added to an
    // existing account. `!inner` is required here: without it PostgREST applies
    // the filter to the embed instead of the parent, so it returns an arbitrary
    // page of reports with `run` nulled out rather than the matching ones.
    if (!isDefinitelyEmail) {
      const { data: scanDomainReports } = await supabase
        .from('reports')
        .select(`
          url_token,
          visibility_score,
          created_at,
          expires_at,
          run:scan_runs!inner(
            domain,
            lead:leads!inner(id, email, domain, tier)
          )
        `)
        .ilike('run.domain', `%${normalizedDomain}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      for (const report of (scanDomainReports || []) as unknown as ScanDomainReportRow[]) {
        const run = report.run
        const lead = run?.lead
        if (!run || !lead) continue
        addResult({
          type: 'report',
          token: report.url_token,
          email: lead.email,
          domain: run.domain || lead.domain,
          tier: lead.tier,
          visibility_score: report.visibility_score,
          created_at: report.created_at,
          expires_at: report.expires_at,
          is_expired: report.expires_at ? new Date(report.expires_at) < new Date() : false,
          lead_id: lead.id,
        })
      }
    }

    // Sort by created_at descending
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Determine query type for UI feedback
    const queryType = isDefinitelyEmail ? 'email' : 'email & domain'

    return NextResponse.json({
      success: true,
      query,
      queryType,
      results: results.slice(0, 25),
      totalFound: results.length,
    })
  } catch (error) {
    console.error('Admin search error:', error)

    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
