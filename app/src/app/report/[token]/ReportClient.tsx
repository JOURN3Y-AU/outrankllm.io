'use client'

import { useState, useEffect } from 'react'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { ScoreGauge } from '@/components/report/ScoreGauge'
import { PlatformResults } from '@/components/report/PlatformResults'
import { ReportTabs } from '@/components/report/ReportTabs'
import { VerificationGate } from '@/components/report/VerificationGate'
import { OptInModal } from '@/components/report/OptInModal'
import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { FeatureFlags } from '@/lib/features/flags'

interface ReportData {
  report: {
    id: string
    url_token: string
    visibility_score: number
    platform_scores: Record<string, number>
    top_competitors: { name: string; count: number }[]
    summary: string
    run_id: string
    requires_verification: boolean
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
  email: string
  domain: string
  leadId: string
  runId: string
  isVerified: boolean
  featureFlags: FeatureFlags
  sitemapUsed: boolean
}

interface ReportClientProps {
  data: ReportData
}

export function ReportClient({ data }: ReportClientProps) {
  const { report, analysis, crawlData, responses, prompts, brandAwareness, email, domain, runId, isVerified } = data
  const [showModal, setShowModal] = useState(false)
  const [hasSeenModal, setHasSeenModal] = useState(false)

  // Show modal after a brief delay on first view
  useEffect(() => {
    const modalShown = localStorage.getItem(`modal_shown_${domain}`)
    if (!modalShown && isVerified) {
      const timer = setTimeout(() => {
        setShowModal(true)
      }, 8000) // Show after 8 seconds - let them explore first
      return () => clearTimeout(timer)
    } else {
      setHasSeenModal(true)
    }
  }, [domain, isVerified])

  const handleModalClose = () => {
    setShowModal(false)
    setHasSeenModal(true)
    localStorage.setItem(`modal_shown_${domain}`, 'true')
  }

  const handleOptIn = (optedIn: boolean) => {
    console.log('User opted in:', optedIn)
  }

  const handleUpgradeClick = () => {
    setShowModal(true)
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

      {/* Main content */}
      <main className="relative z-10 min-h-screen" style={{ padding: '48px 24px 80px' }}>
        <div style={{ maxWidth: '960px', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header */}
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
            {analysis?.business_type && analysis.business_type !== 'Business website' && (
              <p
                className="text-[var(--text-dim)] font-mono"
                style={{ marginTop: '12px', fontSize: '13px' }}
              >
                {analysis.business_type}
                {analysis.location && ` • ${analysis.location}`}
              </p>
            )}
          </div>

          {/* Score + Summary + Platform - Always Visible */}
          <div
            className="bg-[var(--surface)] border border-[var(--border)]"
            style={{ padding: '40px', marginBottom: '8px' }}
          >
            {/* Score */}
            <div className="flex justify-center" style={{ marginBottom: '40px' }}>
              <ScoreGauge score={report.visibility_score} size="lg" />
            </div>

            {/* Summary */}
            <div style={{ marginBottom: '40px' }}>
              <h2
                className="text-[var(--green)] font-mono uppercase tracking-wider"
                style={{ fontSize: '11px', marginBottom: '16px', letterSpacing: '0.1em' }}
              >
                Summary
              </h2>
              <p
                className="text-[var(--text-mid)]"
                style={{ fontSize: '15px', lineHeight: '1.7', maxWidth: '720px' }}
              >
                {report.summary}
              </p>
            </div>

            {/* Platform breakdown */}
            <div>
              <h2
                className="text-[var(--green)] font-mono uppercase tracking-wider"
                style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
              >
                Platform Breakdown
              </h2>
              <PlatformResults scores={report.platform_scores} />
            </div>
          </div>

          {/* Tabbed Content */}
          <ReportTabs
            analysis={analysis}
            responses={responses}
            prompts={prompts}
            brandAwareness={brandAwareness}
            crawlData={crawlData ?? undefined}
            visibilityScore={report.visibility_score}
            platformScores={report.platform_scores}
            competitors={report.top_competitors}
            domain={domain}
            onUpgradeClick={handleUpgradeClick}
          />

          {/* CTA section */}
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
              onClick={() => setShowModal(true)}
              className="form-button inline-flex items-center gap-2"
              style={{ width: 'auto', padding: '18px 32px' }}
            >
              <Sparkles size={16} />
              Upgrade for Full Access
            </button>
          </section>

          {/* Footer */}
          <footer className="text-center" style={{ paddingTop: '48px', paddingBottom: '24px' }}>
            <p className="font-mono text-xs text-[var(--text-dim)]">
              outrankllm.io — GEO for Vibe Coders
            </p>
          </footer>
        </div>
      </main>

      {/* Opt-in modal */}
      {showModal && (
        <OptInModal
          email={email}
          onClose={handleModalClose}
          onOptIn={handleOptIn}
        />
      )}
    </VerificationGate>
  )
}
