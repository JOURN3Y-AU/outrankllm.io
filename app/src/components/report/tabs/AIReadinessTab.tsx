'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Eye,
  Sparkles,
  Lock
} from 'lucide-react'
import Link from 'next/link'
import type { Analysis, CrawlData, ReadinessCheck } from '../shared'
import { handlePricingClick } from '../shared'

const readinessChecks: ReadinessCheck[] = [
  {
    id: 'business_clarity',
    label: 'Clear Business Identity',
    description: 'AI can determine what your business does and offers',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.business_name && analysis.business_type !== 'Business website') return 'pass'
      if (analysis.business_type !== 'Business website') return 'warning'
      return 'fail'
    }
  },
  {
    id: 'services_defined',
    label: 'Services/Products Listed',
    description: 'Your offerings are clearly described on the site',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.services && analysis.services.length >= 3) return 'pass'
      if (analysis.services && analysis.services.length > 0) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'location_specified',
    label: 'Location Information',
    description: 'Geographic service area is specified for local discovery',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.location) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'target_audience',
    label: 'Target Audience Defined',
    description: 'Clear indication of who you serve helps AI match queries',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.target_audience) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'industry_context',
    label: 'Industry Context',
    description: 'Industry classification helps AI categorize your business',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.industry && analysis.industry !== 'General') return 'pass'
      return 'warning'
    }
  },
  {
    id: 'key_phrases',
    label: 'Relevant Keywords',
    description: 'Important phrases that describe your expertise',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.key_phrases && analysis.key_phrases.length >= 5) return 'pass'
      if (analysis.key_phrases && analysis.key_phrases.length > 0) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'sitemap',
    label: 'XML Sitemap Available',
    description: 'Helps AI crawlers discover and index all your pages',
    impact: 'high',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.hasSitemap) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'page_depth',
    label: 'Sufficient Content Depth',
    description: 'Multiple pages provide more context for AI training',
    impact: 'medium',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.pagesCrawled && crawlData.pagesCrawled >= 10) return 'pass'
      if (crawlData.pagesCrawled && crawlData.pagesCrawled >= 5) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'schema_markup',
    label: 'Schema Markup (Structured Data)',
    description: 'JSON-LD helps AI understand your business data',
    impact: 'high',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.schemaTypes && crawlData.schemaTypes.length > 0) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'meta_descriptions',
    label: 'Meta Descriptions',
    description: 'Clear summaries help AI understand page content',
    impact: 'medium',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.hasMetaDescriptions) return 'pass'
      return 'warning'
    }
  },
]

export function AIReadinessTab({
  analysis,
  crawlData,
  domain,
  tier = 'free',
}: {
  analysis: Analysis | null
  crawlData?: CrawlData
  domain: string
  tier?: 'free' | 'starter' | 'pro' | 'agency'
}) {
  const [showStickyUpsell, setShowStickyUpsell] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  // Track scroll to show sticky upsell as soon as user starts scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky upsell after minimal scroll (50px)
      setShowStickyUpsell(window.scrollY > 50)
    }

    // Check initial scroll position (in case page loaded scrolled down)
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate results for each check
  const results = readinessChecks.map(check => ({
    ...check,
    status: check.check(analysis, crawlData)
  }))

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length
  const totalChecks = results.filter(r => r.status !== 'unknown').length
  const readinessPercent = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0

  // Group by impact
  const highImpact = results.filter(r => r.impact === 'high')
  const mediumImpact = results.filter(r => r.impact === 'medium')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Shield size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Technical Readiness Check:</strong> We analyzed your website&apos;s structure, content, and metadata to determine how easily AI systems can understand and index your business. Each factor is rated by its impact on AI visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div ref={summaryRef} className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          AI Readiness Score
        </h3>

        <div className="flex items-center justify-between flex-wrap" style={{ gap: '24px' }}>
          <div className="flex items-center" style={{ gap: '32px' }}>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <CheckCircle2 size={20} className="text-[var(--green)]" />
              <span className="font-mono text-lg text-[var(--text)]">{passCount}</span>
              <span className="text-[var(--text-dim)] text-sm">passed</span>
            </div>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <AlertCircle size={20} className="text-[var(--amber)]" />
              <span className="font-mono text-lg text-[var(--text)]">{warningCount}</span>
              <span className="text-[var(--text-dim)] text-sm">warnings</span>
            </div>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <XCircle size={20} className="text-[var(--red)]" />
              <span className="font-mono text-lg text-[var(--text)]">{failCount}</span>
              <span className="text-[var(--text-dim)] text-sm">failed</span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-3xl text-[var(--text)]">
              {readinessPercent}%
            </span>
            <span className="text-[var(--text-dim)] text-sm block">ready for AI</span>
          </div>
        </div>
      </div>

      {/* High Impact Checks */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--red)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          High Impact Factors
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          {highImpact.map((check) => (
            <ReadinessCheckRow key={check.id} check={check} analysis={analysis} crawlData={crawlData} />
          ))}
        </div>
      </div>

      {/* Medium Impact Checks */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--amber)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Medium Impact Factors
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          {mediumImpact.map((check) => (
            <ReadinessCheckRow key={check.id} check={check} analysis={analysis} crawlData={crawlData} />
          ))}
        </div>
      </div>

      {/* What to do */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why This Matters
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          AI assistants like ChatGPT, Claude, and Gemini use signals from your website to understand
          and recommend your business. The checks above identify what&apos;s helping or hurting your
          AI visibility. Fixing failed items can significantly improve how often AI recommends you.
        </p>
      </div>

      {/* Sticky Floating Upsell - Free and Starter only (no meaningful upgrade path for Pro/Agency) */}
      {showStickyUpsell && (tier === 'free' || tier === 'starter') && (
        <div
          style={{
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 50,
            padding: '16px 24px',
            background: failCount > 0
              ? 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(30,20,20,0.98) 100%)'
              : 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(20,30,20,0.98) 100%)',
            borderTop: failCount > 0 ? '1px solid var(--red-dim)' : '1px solid var(--green)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="flex items-center" style={{ gap: '16px' }}>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: failCount > 0
                    ? 'linear-gradient(135deg, var(--red) 0%, #b91c1c 100%)'
                    : 'linear-gradient(135deg, var(--green) 0%, #16a34a 100%)',
                }}
              >
                {failCount > 0 ? (
                  <XCircle size={20} style={{ color: 'white' }} />
                ) : (
                  <CheckCircle2 size={20} style={{ color: 'white' }} />
                )}
              </div>
              <div>
                {failCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      {failCount} issue{failCount > 1 ? 's' : ''} affecting AI visibility
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      {tier === 'free' && 'Get step-by-step fixes'}
                      {tier === 'starter' && 'Get technical fixes with Pro'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      {readinessPercent}% AI ready
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      {tier === 'free' && 'Monitor weekly to maintain your edge'}
                      {tier === 'starter' && 'Get technical PRDs to improve further'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/pricing?from=report"
              onClick={handlePricingClick}
              className="font-mono text-sm flex items-center gap-2 transition-all hover:scale-105"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              <Sparkles size={16} />
              {tier === 'free' && (failCount > 0 ? 'Get Fixes & Action Plans' : 'Subscribe for Weekly Monitoring')}
              {tier === 'starter' && 'Upgrade to Pro'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadinessCheckRow({
  check,
  analysis,
  crawlData
}: {
  check: ReadinessCheck & { status: string }
  analysis: Analysis | null
  crawlData?: CrawlData
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusConfig = {
    pass: { icon: CheckCircle2, color: 'var(--green)', bg: 'var(--green)' },
    warning: { icon: AlertCircle, color: 'var(--amber)', bg: 'var(--amber)' },
    fail: { icon: XCircle, color: 'var(--red)', bg: 'var(--red)' },
    unknown: { icon: AlertCircle, color: 'var(--text-ghost)', bg: 'var(--text-ghost)' },
  }

  const config = statusConfig[check.status as keyof typeof statusConfig] || statusConfig.unknown
  const Icon = config.icon

  // Get detected value for each check type
  const getDetectedValue = (): string | null => {
    switch (check.id) {
      case 'business_clarity':
        return analysis?.business_name || analysis?.business_type || null
      case 'services_defined':
        return analysis?.services?.slice(0, 3).join(', ') || null
      case 'location_specified':
        return analysis?.location || null
      case 'target_audience':
        return analysis?.target_audience || null
      case 'industry_context':
        return analysis?.industry || null
      case 'key_phrases':
        return analysis?.key_phrases?.slice(0, 3).join(', ') || null
      case 'sitemap':
        return crawlData?.hasSitemap ? 'Found' : 'Not found'
      case 'page_depth':
        return crawlData?.pagesCrawled ? `${crawlData.pagesCrawled} pages` : null
      case 'schema_markup':
        return crawlData?.schemaTypes?.join(', ') || null
      case 'meta_descriptions':
        return crawlData?.hasMetaDescriptions ? 'Found' : 'Not found'
      default:
        return null
    }
  }

  const detectedValue = getDetectedValue()
  const hasDetails = detectedValue !== null

  return (
    <div
      className="bg-[var(--surface-elevated)] border border-[var(--border)]"
      style={{ padding: '20px' }}
    >
      <div
        className="flex items-start cursor-pointer"
        style={{ gap: '16px' }}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center"
          style={{ width: '32px', height: '32px', backgroundColor: `${config.bg}15` }}
        >
          <Icon size={16} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
            <span className="font-medium text-[var(--text)]">{check.label}</span>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs uppercase"
                style={{ color: config.color }}
              >
                {check.status}
              </span>
              {hasDetails && (
                <ChevronDown
                  size={14}
                  className="text-[var(--text-ghost)]"
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              )}
            </div>
          </div>
          <p className="text-[var(--text-dim)] text-sm">
            {check.description}
          </p>
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && hasDetails && (
        <div
          className="border-t border-[var(--border-subtle)]"
          style={{ marginTop: '16px', paddingTop: '16px', marginLeft: '48px' }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Eye size={12} className="text-[var(--text-ghost)]" />
            <span className="font-mono text-xs text-[var(--text-ghost)] uppercase">
              Detected Value
            </span>
          </div>
          <p className="text-[var(--text-mid)] text-sm font-mono" style={{ lineHeight: '1.5' }}>
            {detectedValue}
          </p>
        </div>
      )}
    </div>
  )
}
