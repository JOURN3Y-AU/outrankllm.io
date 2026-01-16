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
    const isToken = /^[a-zA-Z0-9]{12}$/.test(query)
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
    const seenLeadIds = new Set<string>()

    // Helper to add result if not duplicate
    const addResult = (result: SearchResult) => {
      if (!seenLeadIds.has(result.lead_id)) {
        seenLeadIds.add(result.lead_id)
        results.push(result)
      }
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

    // For non-token searches, always search emails
    // Search by email (partial match)
    const { data: emailLeads } = await supabase
      .from('leads')
      .select('id, email, domain, tier, created_at')
      .ilike('email', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (emailLeads) {
      for (const lead of emailLeads) {
        // Get latest report for this lead
        const { data: latestReport } = await supabase
          .from('reports')
          .select(`
            url_token,
            visibility_score,
            created_at,
            expires_at,
            run:scan_runs!inner(lead_id, domain)
          `)
          .eq('run.lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestReport) {
          const scanDomain = (latestReport.run as { domain: string } | null)?.domain
          addResult({
            type: 'report',
            token: latestReport.url_token,
            email: lead.email,
            domain: scanDomain || lead.domain,
            tier: lead.tier,
            visibility_score: latestReport.visibility_score,
            created_at: latestReport.created_at,
            expires_at: latestReport.expires_at,
            is_expired: latestReport.expires_at ? new Date(latestReport.expires_at) < new Date() : false,
            lead_id: lead.id,
          })
        } else {
          // Lead exists but no report yet
          addResult({
            type: 'lead',
            email: lead.email,
            domain: lead.domain,
            tier: lead.tier,
            created_at: lead.created_at,
            lead_id: lead.id,
          })
        }
      }
    }

    // If NOT a definite email search, also search by domain
    if (!isDefinitelyEmail) {
      // Normalize domain query
      const normalizedDomain = query
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]

      // Search leads by domain
      const { data: domainLeads } = await supabase
        .from('leads')
        .select('id, email, domain, tier, created_at')
        .ilike('domain', `%${normalizedDomain}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (domainLeads) {
        for (const lead of domainLeads) {
          // Skip if already found via email search
          if (seenLeadIds.has(lead.id)) continue

          // Get latest report for this lead
          const { data: latestReport } = await supabase
            .from('reports')
            .select(`
              url_token,
              visibility_score,
              created_at,
              expires_at,
              run:scan_runs!inner(lead_id, domain)
            `)
            .eq('run.lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (latestReport) {
            const scanDomain = (latestReport.run as { domain: string } | null)?.domain
            addResult({
              type: 'report',
              token: latestReport.url_token,
              email: lead.email,
              domain: scanDomain || lead.domain,
              tier: lead.tier,
              visibility_score: latestReport.visibility_score,
              created_at: latestReport.created_at,
              expires_at: latestReport.expires_at,
              is_expired: latestReport.expires_at ? new Date(latestReport.expires_at) < new Date() : false,
              lead_id: lead.id,
            })
          } else {
            addResult({
              type: 'lead',
              email: lead.email,
              domain: lead.domain,
              tier: lead.tier,
              created_at: lead.created_at,
              lead_id: lead.id,
            })
          }
        }
      }

      // Also search scan_runs.domain for multi-domain cases
      const { data: scanDomainReports } = await supabase
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
        .ilike('run.domain', `%${normalizedDomain}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (scanDomainReports) {
        for (const report of scanDomainReports) {
          if (!report.run?.lead) continue

          const lead = report.run.lead as { id: string; email: string; domain: string; tier: string }
          if (seenLeadIds.has(lead.id)) continue

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
