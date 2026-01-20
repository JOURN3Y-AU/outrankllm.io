'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { ReportTabs } from '@/components/report/ReportTabs'
import { AdminOverlay } from './AdminOverlay'
import {
  Search,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Mail,
  Globe,
  FileText,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import type { FeatureFlags } from '@/lib/features/flags'

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

interface ReportData {
  report: {
    id: string
    url_token: string
    visibility_score: number
    platform_scores: Record<string, number>
    top_competitors: { name: string; count: number }[]
    summary: string
    run_id: string
    created_at: string
    completed_at: string | null
    requires_verification: boolean
    expires_at: string | null
    subscriber_only: boolean
    enrichment_status: EnrichmentStatus
  }
  analysis: {
    business_type: string
    business_name: string | null
    services: string[]
    location: string | null
    target_audience?: string | null
    key_phrases?: string[]
    industry?: string
  } | null
  crawlData: {
    hasSitemap: boolean
    hasRobotsTxt: boolean
    pagesCrawled: number
    schemaTypes: string[]
    hasMetaDescriptions: boolean
  } | null
  responses: {
    platform: string
    response_text: string
    domain_mentioned: boolean
    prompt: { prompt_text: string } | null
  }[] | null
  prompts: {
    id: string
    prompt_text: string
    category: string
  }[] | null
  subscriberQuestions: {
    id: string
    prompt_text: string
    category: string
    source: 'ai_generated' | 'user_created'
  }[] | null
  brandAwareness: {
    platform: string
    query_type: string
    tested_entity: string
    tested_attribute: string | null
    entity_recognized: boolean
    attribute_mentioned: boolean
    response_text: string
    confidence_score: number
    compared_to: string | null
    positioning: string | null
  }[] | null
  competitiveSummary: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    overallPosition: string
  } | null
  email: string
  domain: string
  leadId: string
  runId: string
  domainSubscriptionId: string | null
  isVerified: boolean
  featureFlags: FeatureFlags
  sitemapUsed: boolean
  hasMarketingOptIn: boolean | null
}

interface UserInfo {
  email: string
  leadId: string
  signedUpAt: string
  emailVerified: boolean
  termsAcceptedAt: string | null
  lastLoginAt: string | null
  hasPassword: boolean
  passwordSetAt: string | null
  stripeCustomerId: string | null
  marketingOptIn: boolean | null
  tier: string
  isSubscriber: boolean
  location: {
    country: string | null
    city: string | null
    region: string | null
    timezone: string | null
  }
  subscription: {
    id: string
    domain: string
    tier: string
    status: string
    stripeSubscriptionId: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    createdAt: string
  } | null
  reportViews: number
  scanHistory: {
    id: string
    created_at: string
    completed_at: string | null
    status: string
    domain: string | null
  }[]
}

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

interface AdminReportViewerProps {
  adminEmail: string
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function TierBadge({ tier }: { tier: string }) {
  const isSubscriber = tier !== 'free'
  return (
    <span
      className="font-mono text-xs px-2 py-0.5 rounded"
      style={{
        background: isSubscriber ? 'var(--gold)' : 'var(--surface-elevated)',
        color: isSubscriber ? 'var(--bg)' : 'var(--text-dim)',
      }}
    >
      {tier}
    </span>
  )
}

export function AdminReportViewer({ adminEmail }: AdminReportViewerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenFromUrl = searchParams.get('token') || ''

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [queryType, setQueryType] = useState<string | null>(null)

  // Report state
  const [selectedToken, setSelectedToken] = useState(tokenFromUrl)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  // Fetch report by token
  const fetchReport = useCallback(async (token: string) => {
    setReportLoading(true)
    setReportError(null)

    try {
      const response = await fetch(`/api/admin/report?token=${encodeURIComponent(token)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch report')
      }

      setReportData(data.reportData)
      setUserInfo(data.userInfo)
      setSelectedToken(token)

      // Clear search results when viewing a report
      setSearchResults(null)
      setSearchQuery('')
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unknown error')
      setReportData(null)
      setUserInfo(null)
    } finally {
      setReportLoading(false)
    }
  }, [])

  // Load report from URL on mount
  useEffect(() => {
    if (tokenFromUrl) {
      fetchReport(tokenFromUrl)
    }
  }, [tokenFromUrl, fetchReport])

  // Update URL when viewing a report
  useEffect(() => {
    if (selectedToken && selectedToken !== tokenFromUrl) {
      router.replace(`/j3y-internal/view?token=${encodeURIComponent(selectedToken)}`)
    }
  }, [selectedToken, tokenFromUrl, router])

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    // Check if it looks like a token (16-char hex string) - go directly to report
    if (/^[a-fA-F0-9]{16}$/.test(query)) {
      fetchReport(query)
      return
    }

    // Clear current report view to show search results
    setReportData(null)
    setUserInfo(null)
    setSelectedToken('')

    setSearchLoading(true)
    setSearchError(null)
    setSearchResults(null)

    // Clear URL token when searching
    router.replace('/j3y-internal/view')

    try {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setSearchResults(data.results)
      setQueryType(data.queryType)

      // If only one result with a token, go directly to it
      if (data.results.length === 1 && data.results[0].token) {
        fetchReport(data.results[0].token)
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle clicking a search result
  const handleResultClick = (result: SearchResult) => {
    if (result.token) {
      fetchReport(result.token)
    }
  }

  // Go back to search
  const handleBackToSearch = () => {
    setReportData(null)
    setUserInfo(null)
    setSelectedToken('')
    router.replace('/j3y-internal/view')
  }

  // Dummy upgrade handler (admin can't upgrade for user)
  const handleUpgradeClick = () => {
    // No-op for admin view
  }

  const isLoading = searchLoading || reportLoading
  const showSearchResults = searchResults && searchResults.length > 0 && !reportData
  const showNoResults = searchResults && searchResults.length === 0 && !reportData
  const showReport = reportData && userInfo

  return (
    <>
      {/* Background */}
      <div className="grid-bg" />
      <FloatingPixels />

      {/* Admin mode banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white font-mono text-sm flex items-center justify-center gap-2"
        style={{ padding: '8px 16px' }}
      >
        <ShieldAlert size={16} />
        ADMIN MODE - Viewing as {adminEmail}
      </div>

      {/* Main content */}
      <main className="relative z-10 min-h-screen" style={{ paddingTop: '56px' }}>
        {/* Search form */}
        <div
          className="bg-[var(--surface)] border-b border-[var(--border)]"
          style={{ padding: '24px' }}
        >
          <div style={{ maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            {/* Back button when viewing report */}
            {showReport && (
              <button
                onClick={handleBackToSearch}
                className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors font-mono text-sm"
                style={{ marginBottom: '16px' }}
              >
                <ArrowLeft size={16} />
                Back to Search
              </button>
            )}

            <h1
              className="font-mono text-[var(--text)] text-center"
              style={{ fontSize: '1.25rem', marginBottom: '16px' }}
            >
              Admin Report Viewer
            </h1>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email, domain, or report token..."
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono text-sm"
                style={{ padding: '12px 16px' }}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-[var(--green)] text-[var(--bg)] font-mono text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ padding: '12px 20px' }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </form>

            <div className="flex items-center justify-center gap-4 text-[var(--text-dim)] text-xs font-mono" style={{ marginTop: '12px' }}>
              <span className="flex items-center gap-1">
                <Mail size={12} />
                email
              </span>
              <span className="flex items-center gap-1">
                <Globe size={12} />
                domain
              </span>
              <span className="flex items-center gap-1">
                <FileText size={12} />
                token
              </span>
            </div>
          </div>
        </div>

        {/* Error states */}
        {(searchError || reportError) && (
          <div
            className="flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-sm"
            style={{ padding: '16px', margin: '24px' }}
          >
            <AlertCircle size={20} />
            {searchError || reportError}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center" style={{ padding: '80px 24px' }}>
            <Loader2 size={32} className="animate-spin text-[var(--green)]" />
          </div>
        )}

        {/* Search results */}
        {!isLoading && showSearchResults && (
          <div style={{ padding: '24px' }}>
            <div style={{ maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
              <p className="font-mono text-sm text-[var(--text-dim)]" style={{ marginBottom: '16px' }}>
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                {queryType && <span className="text-[var(--text-mid)]"> (searched by {queryType})</span>}
              </p>

              <div style={{ display: 'grid', gap: '12px' }}>
                {searchResults.map((result, index) => (
                  <button
                    key={result.token || `${result.lead_id}-${index}`}
                    onClick={() => handleResultClick(result)}
                    disabled={!result.token}
                    className="w-full text-left bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--green)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ padding: '16px' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Domain */}
                        <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
                          <Globe size={14} className="text-[var(--green)] flex-shrink-0" />
                          <span className="font-mono text-sm text-[var(--text)] truncate">
                            {result.domain}
                          </span>
                          <TierBadge tier={result.tier} />
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
                          <Mail size={14} className="text-[var(--text-dim)] flex-shrink-0" />
                          <span className="font-mono text-xs text-[var(--text-mid)] truncate">
                            {result.email}
                          </span>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center gap-3 text-[var(--text-dim)]">
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <Clock size={12} />
                            {formatRelativeTime(result.created_at)}
                          </span>

                          {result.type === 'report' && result.visibility_score !== undefined && (
                            <span className="font-mono text-xs">
                              Score: <span className="text-[var(--green)]">{result.visibility_score}%</span>
                            </span>
                          )}

                          {result.is_expired && (
                            <span className="font-mono text-xs text-red-400">
                              EXPIRED
                            </span>
                          )}

                          {result.type === 'lead' && (
                            <span className="font-mono text-xs text-[var(--gold)]">
                              No report yet
                            </span>
                          )}
                        </div>
                      </div>

                      {/* View button */}
                      {result.token && (
                        <div className="flex items-center gap-1 text-[var(--green)] font-mono text-xs">
                          View
                          <ExternalLink size={12} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No results */}
        {!isLoading && showNoResults && (
          <div className="flex flex-col items-center justify-center text-[var(--text-dim)]" style={{ padding: '80px 24px' }}>
            <Search size={48} className="opacity-30" style={{ marginBottom: '16px' }} />
            <p className="font-mono text-sm">No results found</p>
          </div>
        )}

        {/* Report view */}
        {!isLoading && showReport && (
          <div style={{ padding: '24px' }}>
            <div style={{ maxWidth: '960px', marginLeft: 'auto', marginRight: 'auto' }}>
              {/* Report header */}
              <div className="text-center" style={{ marginBottom: '48px' }}>
                <h1
                  className="font-medium text-[var(--text)]"
                  style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '16px' }}
                >
                  AI Visibility Report
                </h1>
                <a
                  href={`https://${reportData.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-mono text-[var(--text-mid)] hover:text-[var(--green)] transition-colors"
                  style={{ fontSize: '15px' }}
                >
                  {reportData.domain}
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p
                  className="text-[var(--text-dim)] font-mono"
                  style={{ marginTop: '12px', fontSize: '13px' }}
                >
                  {reportData.analysis?.business_type && reportData.analysis.business_type !== 'Business website' && (
                    <>
                      {reportData.analysis.business_type}
                      {reportData.analysis.location && ` • ${reportData.analysis.location}`}
                      {' • '}
                    </>
                  )}
                  Scanned {new Date(reportData.report.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })} at {new Date(reportData.report.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>

                {/* Expiry warning for admin */}
                {reportData.report.expires_at && (
                  <p
                    className="font-mono text-xs"
                    style={{
                      marginTop: '8px',
                      color: new Date(reportData.report.expires_at) < new Date() ? 'var(--red, #ef4444)' : 'var(--gold)',
                    }}
                  >
                    {new Date(reportData.report.expires_at) < new Date()
                      ? `EXPIRED: ${new Date(reportData.report.expires_at).toLocaleDateString()}`
                      : `Expires: ${new Date(reportData.report.expires_at).toLocaleDateString()}`
                    }
                  </p>
                )}
              </div>

              {/* Report tabs - showing exactly what user sees */}
              <ReportTabs
                analysis={reportData.analysis}
                responses={reportData.responses}
                prompts={reportData.featureFlags.isSubscriber && reportData.subscriberQuestions?.length
                  ? reportData.subscriberQuestions
                  : reportData.prompts}
                brandAwareness={reportData.brandAwareness}
                competitiveSummary={reportData.competitiveSummary}
                crawlData={reportData.crawlData ?? undefined}
                visibilityScore={reportData.report.visibility_score}
                platformScores={reportData.report.platform_scores}
                competitors={reportData.report.top_competitors}
                domain={reportData.domain}
                domainSubscriptionId={reportData.domainSubscriptionId}
                onUpgradeClick={handleUpgradeClick}
                isSubscriber={reportData.featureFlags.isSubscriber}
                tier={reportData.featureFlags.tier}
                customQuestionLimit={reportData.featureFlags.customQuestionLimit}
                currentRunId={reportData.report.run_id}
                enrichmentStatus={reportData.report.enrichment_status}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !searchError && !reportError && !searchResults && !reportData && (
          <div className="flex flex-col items-center justify-center text-[var(--text-dim)]" style={{ padding: '80px 24px' }}>
            <Search size={48} className="opacity-30" style={{ marginBottom: '16px' }} />
            <p className="font-mono text-sm">Search by email, domain, or report token</p>
          </div>
        )}
      </main>

      {/* Admin overlay with user info - floating button */}
      {userInfo && <AdminOverlay userInfo={userInfo} reportToken={selectedToken} />}
    </>
  )
}
