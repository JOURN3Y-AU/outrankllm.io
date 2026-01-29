'use client'

import { useState, useEffect } from 'react'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { ReportTabs } from '@/components/report/ReportTabs'
import { VerificationGate } from '@/components/report/VerificationGate'
import { OptInModal } from '@/components/report/OptInModal'
import { ExpiryCountdown } from '@/components/report/ExpiryCountdown'
import { Nav } from '@/components/nav/Nav'
import { ArrowLeft, ExternalLink, Sparkles, Lock, Crown, Check } from 'lucide-react'
import Link from 'next/link'
import type { FeatureFlags } from '@/lib/features/flags'
import { trackEventOnce, ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackLinkedInConversionOnce, LINKEDIN_CONVERSIONS } from '@/lib/linkedin'

// Locked report modal for users who already used their free report
function LockedReportModal({
  domain,
  onUpgrade
}: {
  domain: string
  onUpgrade: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: '24px' }}
    >
      {/* Frosted backdrop */}
      <div
        className="absolute inset-0 bg-[var(--bg)]/80"
        style={{ backdropFilter: 'blur(8px)' }}
      />

      {/* Modal */}
      <div
        className="relative bg-[var(--surface)] border border-[var(--border)] w-full"
        style={{ maxWidth: '480px', padding: '48px 32px' }}
      >
        {/* Lock icon */}
        <div
          className="flex items-center justify-center mx-auto"
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
            marginBottom: '24px',
          }}
        >
          <Lock size={32} style={{ color: 'var(--bg)' }} />
        </div>

        {/* Title */}
        <h2
          className="text-center font-medium text-[var(--text)]"
          style={{ fontSize: '1.5rem', marginBottom: '12px' }}
        >
          Your Report is Ready
        </h2>

        {/* Domain */}
        <p
          className="text-center font-mono text-[var(--green)]"
          style={{ fontSize: '15px', marginBottom: '24px' }}
        >
          {domain}
        </p>

        {/* Message */}
        <p
          className="text-center text-[var(--text-mid)]"
          style={{ lineHeight: '1.6', marginBottom: '32px' }}
        >
          You&apos;ve already used your free report. Subscribe now to unlock full access
          and get weekly AI visibility updates with personalized action plans.
        </p>

        {/* Benefits */}
        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '20px', marginBottom: '32px' }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <Crown size={16} className="text-[var(--gold)]" />
            <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider">
              What you&apos;ll unlock
            </span>
          </div>
          <ul style={{ display: 'grid', gap: '12px' }}>
            {[
              'Full access to your AI visibility report',
              'Weekly automated scans & trend tracking',
              'Competitor analysis & benchmarking',
              'Personalized action plans to improve',
            ].map((benefit, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-mid)]">
                <Check size={16} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          onClick={onUpgrade}
          className="w-full font-mono text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
            color: 'var(--bg)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={16} />
          Subscribe to Unlock
        </button>

        {/* Login link */}
        <p className="text-center text-sm text-[var(--text-dim)]" style={{ marginTop: '16px' }}>
          Already subscribed?{' '}
          <Link href="/login" className="text-[var(--green)] hover:underline">
            Log in
          </Link>
        </p>

        {/* Help link */}
        <p className="text-center text-sm text-[var(--text-dim)]" style={{ marginTop: '12px' }}>
          Wrong domain or need help?{' '}
          <a href="mailto:help@outrankllm.io" className="text-[var(--text-mid)] hover:text-[var(--text)] hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  )
}

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
  platformData: {
    detected_cms?: string | null
    detected_cms_confidence?: 'high' | 'medium' | 'low' | null
    detected_framework?: string | null
    detected_css_framework?: string | null
    detected_ecommerce?: string | null
    detected_hosting?: string | null
    detected_analytics?: string[]
    detected_lead_capture?: string[]
    has_blog?: boolean
    has_case_studies?: boolean
    has_resources?: boolean
    has_faq?: boolean
    has_about_page?: boolean
    has_team_page?: boolean
    has_testimonials?: boolean
    is_ecommerce?: boolean
    has_ai_readability_issues?: boolean
    ai_readability_issues?: string[]
    renders_client_side?: boolean
    likely_ai_generated?: boolean
    ai_generated_signals?: string[]
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

interface ReportClientProps {
  data: ReportData
  showLockedModal?: boolean
}

export function ReportClient({ data, showLockedModal = false }: ReportClientProps) {
  const { report, analysis, crawlData, platformData, responses, prompts, subscriberQuestions, brandAwareness, competitiveSummary, email, domain, runId, domainSubscriptionId, isVerified, featureFlags, hasMarketingOptIn } = data
  const [showModal, setShowModal] = useState(false)
  const [showLocked, setShowLocked] = useState(showLockedModal)
  const isSubscriber = featureFlags.isSubscriber

  // Restore scroll position when returning from pricing page
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('report_scroll_position')
    if (savedPosition) {
      // Small delay to ensure page is rendered before scrolling
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition, 10))
        sessionStorage.removeItem('report_scroll_position')
      })
    }
  }, [])

  // Track report view (once per session per report)
  useEffect(() => {
    if (!isVerified) return // Don't track until verified

    const hoursSinceScan = Math.round(
      (Date.now() - new Date(report.created_at).getTime()) / (1000 * 60 * 60)
    )

    trackEventOnce(ANALYTICS_EVENTS.REPORT_VIEWED, report.url_token, {
      user_tier: featureFlags.tier,
      is_subscriber: isSubscriber,
      domain,
      hours_since_scan: hoursSinceScan,
    })

    // Track LinkedIn report view conversion
    trackLinkedInConversionOnce(LINKEDIN_CONVERSIONS.REPORT_VIEWED, report.url_token)
  }, [isVerified, report.url_token, report.created_at, featureFlags.tier, isSubscriber, domain])

  // Show modal after a brief delay on first view
  // Skip if user has already opted in or out (hasMarketingOptIn is not null)
  useEffect(() => {
    const modalShown = localStorage.getItem(`modal_shown_${domain}`)
    const alreadyResponded = hasMarketingOptIn !== null
    if (!modalShown && !alreadyResponded && isVerified) {
      const timer = setTimeout(() => {
        setShowModal(true)
      }, 8000) // Show after 8 seconds - let them explore first
      return () => clearTimeout(timer)
    }
  }, [domain, isVerified, hasMarketingOptIn])

  const handleModalClose = () => {
    setShowModal(false)
    localStorage.setItem(`modal_shown_${domain}`, 'true')
  }

  const handleOptIn = (optedIn: boolean) => {
    console.log('User opted in:', optedIn)
  }

  const handleUpgradeClick = () => {
    saveScrollPosition()
    // Store lead info for checkout process
    sessionStorage.setItem('checkout_lead_id', data.leadId)
    sessionStorage.setItem('checkout_report_token', report.url_token)
    sessionStorage.setItem('checkout_domain', domain)
    window.location.href = '/pricing?from=report'
  }

  // Save scroll position before navigating to pricing page
  const saveScrollPosition = () => {
    sessionStorage.setItem('report_scroll_position', String(window.scrollY))
  }

  // Wrap content in verification gate
  return (
    <VerificationGate
      email={email}
      domain={domain}
      runId={runId}
      isVerified={isVerified}
    >
      {/* Background */}
      <div className="grid-bg" />
      <FloatingPixels />

      {/* Show Nav for subscribers, simple header for free users */}
      {isSubscriber && <Nav />}

      {/* Main content */}
      <main className="relative z-10 min-h-screen" style={{ padding: isSubscriber ? '120px 24px 80px' : '48px 24px 80px' }}>
        <div style={{ maxWidth: '960px', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header - only show for non-subscribers */}
          {!isSubscriber && (
            <header className="flex items-center justify-between" style={{ marginBottom: '56px' }}>
              <Link
                href="/"
                className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-mono text-sm">Back</span>
              </Link>

              <div className="flex items-center gap-3">
                <span className="font-mono text-lg">
                  outrank<span className="text-[var(--green)]">llm</span>
                </span>
              </div>
            </header>
          )}

          {/* Report header */}
          <div className="text-center stagger-children" style={{ marginBottom: '48px' }}>
            <h1
              className="font-medium text-[var(--text)]"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '16px' }}
            >
              AI Visibility Report
            </h1>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-[var(--text-mid)] hover:text-[var(--green)] transition-colors"
              style={{ fontSize: '15px' }}
            >
              {domain}
              <ExternalLink className="w-4 h-4" />
            </a>
            <p
              className="text-[var(--text-dim)] font-mono"
              style={{ marginTop: '12px', fontSize: '13px' }}
            >
              {analysis?.business_type && analysis.business_type !== 'Business website' && (
                <>
                  {analysis.business_type}
                  {analysis.location && ` • ${analysis.location}`}
                  {' • '}
                </>
              )}
              Scanned {new Date(report.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })} at {new Date(report.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>

          {/* Expiry countdown for free users only */}
          {!isSubscriber && (
            <ExpiryCountdown
              expiresAt={report.expires_at}
              onUpgradeClick={handleUpgradeClick}
            />
          )}

          {/* Tabbed Content */}
          <ReportTabs
            analysis={analysis}
            responses={responses}
            prompts={isSubscriber && subscriberQuestions?.length ? subscriberQuestions : prompts}
            brandAwareness={brandAwareness}
            competitiveSummary={competitiveSummary}
            crawlData={crawlData ?? undefined}
            platformData={platformData ?? undefined}
            visibilityScore={report.visibility_score}
            platformScores={report.platform_scores}
            competitors={report.top_competitors}
            domain={domain}
            domainSubscriptionId={domainSubscriptionId}
            onUpgradeClick={handleUpgradeClick}
            isSubscriber={isSubscriber}
            tier={featureFlags.tier}
            customQuestionLimit={featureFlags.customQuestionLimit}
            currentRunId={report.run_id}
            enrichmentStatus={report.enrichment_status}
            blurCompetitors={featureFlags.blurCompetitors}
            showActionPlans={featureFlags.showActionPlans}
            showPrdTasks={featureFlags.showPrdTasks}
            isTrial={featureFlags.isTrial}
          />

          {/* CTA section - only for non-subscribers */}
          {!isSubscriber && (
            <section
              className="text-center border-t border-[var(--border)]"
              style={{ paddingTop: '56px', marginTop: '56px' }}
            >
              <div className="flex justify-center" style={{ marginBottom: '20px' }}>
                <Sparkles size={36} className="text-[var(--green)]" />
              </div>
              <h2
                className="font-medium text-[var(--text)]"
                style={{ fontSize: '1.375rem', marginBottom: '16px' }}
              >
                Want to outrank your competitors?
              </h2>
              <p
                className="text-[var(--text-mid)]"
                style={{
                  marginBottom: '28px',
                  maxWidth: '480px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  lineHeight: '1.6'
                }}
              >
                Unlock competitor analysis, personalized action plans, and
                ready-to-ship PRDs for your AI coding tools.
              </p>
              <button
                onClick={handleUpgradeClick}
                className="form-button inline-flex items-center gap-2"
                style={{ width: 'auto', padding: '18px 32px' }}
              >
                <Sparkles size={16} />
                Upgrade for Full Access
              </button>
            </section>
          )}

          {/* Footer */}
          <footer className="text-center" style={{ paddingTop: '48px', paddingBottom: '24px' }}>
            <p className="font-mono text-xs text-[var(--text-dim)]">
              outrankllm.io — GEO for Business owners, developers, vibe coders and agencies
            </p>
          </footer>
        </div>
      </main>

      {/* Opt-in modal */}
      {showModal && !showLocked && (
        <OptInModal
          email={email}
          onClose={handleModalClose}
          onOptIn={handleOptIn}
        />
      )}

      {/* Locked report modal - shown when user already used their free report */}
      {showLocked && (
        <LockedReportModal
          domain={domain}
          onUpgrade={handleUpgradeClick}
        />
      )}
    </VerificationGate>
  )
}
