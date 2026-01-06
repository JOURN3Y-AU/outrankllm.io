'use client'

import { useState, useEffect } from 'react'
import { Ghost } from '@/components/ghost/Ghost'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { ScoreGauge } from '@/components/report/ScoreGauge'
import { PlatformResults } from '@/components/report/PlatformResults'
import { CompetitorsList } from '@/components/report/CompetitorsList'
import { OptInModal } from '@/components/report/OptInModal'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ReportData {
  report: {
    visibility_score: number
    platform_scores: Record<string, number>
    top_competitors: { name: string; count: number }[]
    summary: string
  }
  analysis: {
    business_type: string
    business_name: string | null
    services: string[]
    location: string | null
  } | null
  responses: {
    platform: string
    response_text: string
    domain_mentioned: boolean
    prompt: { prompt_text: string }
  }[] | null
  email: string
  domain: string
}

interface ReportClientProps {
  data: ReportData
}

export function ReportClient({ data }: ReportClientProps) {
  const { report, analysis, responses, email, domain } = data
  const [showModal, setShowModal] = useState(false)
  const [hasSeenModal, setHasSeenModal] = useState(false)

  // Show modal after a brief delay on first view
  useEffect(() => {
    const modalShown = localStorage.getItem(`modal_shown_${domain}`)
    if (!modalShown) {
      const timer = setTimeout(() => {
        setShowModal(true)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setHasSeenModal(true)
    }
  }, [domain])

  const handleModalClose = () => {
    setShowModal(false)
    setHasSeenModal(true)
    localStorage.setItem(`modal_shown_${domain}`, 'true')
  }

  const handleOptIn = (optedIn: boolean) => {
    console.log('User opted in:', optedIn)
    // Additional tracking can happen here
  }

  return (
    <>
      {/* Background */}
      <div className="grid-bg" />
      <FloatingPixels />

      {/* Main content */}
      <main className="relative z-10 min-h-screen px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-12">
            <Link
              href="/"
              className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-mono text-sm">Back</span>
            </Link>

            <div className="flex items-center gap-3">
              <Ghost size="sm" />
              <span className="font-mono text-lg">
                outrank<span className="text-[var(--green)]">llm</span>
              </span>
            </div>
          </header>

          {/* Report header */}
          <div className="text-center mb-12 stagger-children">
            <h1 className="text-3xl md:text-4xl font-medium mb-4">
              AI Visibility Report
            </h1>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-[var(--text-mid)] hover:text-[var(--green)] transition-colors"
            >
              {domain}
              <ExternalLink className="w-4 h-4" />
            </a>
            {analysis?.business_type && (
              <p className="mt-2 text-[var(--text-dim)] font-mono text-sm">
                {analysis.business_type}
                {analysis.location && ` • ${analysis.location}`}
              </p>
            )}
          </div>

          {/* Score section */}
          <section className="flex justify-center mb-12">
            <ScoreGauge score={report.visibility_score} size="lg" />
          </section>

          {/* Summary */}
          <section className="mb-12">
            <div className="card">
              <h2 className="text-lg font-medium mb-3">Summary</h2>
              <p className="text-[var(--text-mid)] leading-relaxed">
                {report.summary}
              </p>
            </div>
          </section>

          {/* Platform breakdown */}
          <section className="mb-12">
            <h2 className="text-lg font-medium mb-4">Platform Breakdown</h2>
            <PlatformResults scores={report.platform_scores} />
          </section>

          {/* Competitors */}
          <section className="mb-12">
            <CompetitorsList competitors={report.top_competitors || []} />
          </section>

          {/* Sample responses */}
          {responses && responses.length > 0 && (
            <section className="mb-12">
              <h2 className="text-lg font-medium mb-4">Sample AI Responses</h2>
              <div className="space-y-4">
                {responses.slice(0, 3).map((response, index) => (
                  <div key={index} className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-2 h-2"
                        style={{
                          backgroundColor:
                            response.platform === 'chatgpt'
                              ? 'var(--red)'
                              : response.platform === 'claude'
                                ? 'var(--green)'
                                : 'var(--blue)',
                        }}
                      />
                      <span className="font-mono text-xs text-[var(--text-dim)] uppercase">
                        {response.platform}
                      </span>
                      {response.domain_mentioned && (
                        <span className="ml-auto text-xs text-[var(--green)] font-mono">
                          ✓ Mentioned
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-dim)] text-sm mb-3 font-mono">
                      Q: {response.prompt?.prompt_text}
                    </p>
                    <p className="text-[var(--text-mid)] text-sm leading-relaxed">
                      {response.response_text?.slice(0, 400)}
                      {(response.response_text?.length || 0) > 400 && '...'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA section */}
          <section className="text-center py-12 border-t border-[var(--border)]">
            <h2 className="text-xl font-medium mb-3">
              Want to improve your AI visibility?
            </h2>
            <p className="text-[var(--text-mid)] mb-6 max-w-md mx-auto">
              Get ongoing monitoring, detailed recommendations, and
              ready-to-ship PRDs for your AI coding tools.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="form-button inline-block"
            >
              Get Started →
            </button>
          </section>

          {/* Footer */}
          <footer className="text-center py-8">
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
    </>
  )
}
