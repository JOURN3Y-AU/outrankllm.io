'use client'

import { useState, useRef } from 'react'
import { Ghost } from '@/components/ghost/Ghost'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { Journ3yAttribution } from '@/components/landing/Platforms'
import { DemoVideo } from '@/components/landing/DemoVideo'
import { Footer } from '@/components/landing/Footer'
import { Nav } from '@/components/nav/Nav'
import { ExperimentTracker } from '@/components/experiments/ExperimentTracker'
import { ScanFormModal } from '@/components/landing/ScanFormModal'
import Image from 'next/image'
import { Search, Users, CheckCircle, ArrowRight } from 'lucide-react'
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'

export function HomePageC() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const ctaButtonRef = useRef<HTMLButtonElement>(null)

  const openModal = (source: string) => {
    trackEvent(ANALYTICS_EVENTS.SCAN_MODAL_OPENED, { source })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    trackEvent(ANALYTICS_EVENTS.SCAN_MODAL_CLOSED)
    setIsModalOpen(false)
  }

  return (
    <>
      {/* A/B Test Tracking */}
      <ExperimentTracker experimentName="homepage" />

      {/* Background layers */}
      <div className="grid-bg" />
      <FloatingPixels />
      <Nav />

      {/* Main content */}
      <main className="page relative z-10 min-h-screen flex flex-col items-center" style={{ paddingTop: '6vh' }}>
        <div className="w-full flex flex-col items-center" style={{ maxWidth: '480px', padding: '0 20px' }}>

          {/* Logo - stacked vertically */}
          <div className="flex flex-col items-center gap-2" style={{ marginBottom: '24px' }}>
            <Ghost size="sm" />
            <div className="logo-text" style={{ fontSize: '1.5rem' }}>
              outrank<span className="mark">llm</span>.io
            </div>
          </div>

          {/* Headline - New wording */}
          <h1 className="text-center" style={{ marginBottom: '12px', fontSize: '1.75rem', lineHeight: '1.2' }}>
            Are AI assistants sending customers{' '}
            <span className="em">to your competitors?</span>
          </h1>

          {/* Subhead - Clear value proposition */}
          <p className="text-[var(--text-mid)] text-center" style={{ marginBottom: '24px', fontSize: '1rem', lineHeight: '1.5' }}>
            Get your free AI Visibility Report and see how ChatGPT, Claude, Gemini and Perplexity talk about your business.
          </p>

          {/* Platform logos - single row with labels below */}
          <div className="flex flex-col items-center w-full" style={{ marginBottom: '24px' }}>
            <span className="font-mono text-[0.65rem] text-[var(--text-dim)] uppercase tracking-widest" style={{ marginBottom: '12px' }}>
              We scan these AI assistants
            </span>
            <div className="flex items-end justify-between w-full" style={{ maxWidth: '300px' }}>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center" style={{ height: '32px' }}>
                  <Image
                    src="/images/ChatGPT-Logo.png"
                    alt="ChatGPT"
                    width={50}
                    height={50}
                    className="object-contain invert"
                  />
                </div>
                <span className="text-[var(--text-dim)] text-[0.6rem] font-mono" style={{ marginTop: '4px' }}>ChatGPT</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center" style={{ height: '32px' }}>
                  <Image
                    src="/images/Claude_AI_symbol.svg.png"
                    alt="Claude"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <span className="text-[var(--text-dim)] text-[0.6rem] font-mono" style={{ marginTop: '4px' }}>Claude</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center" style={{ height: '32px' }}>
                  <Image
                    src="/images/Google_Gemini_icon_2025.svg.png"
                    alt="Gemini"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <span className="text-[var(--text-dim)] text-[0.6rem] font-mono" style={{ marginTop: '4px' }}>Gemini</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center" style={{ height: '32px' }}>
                  <Image
                    src="/images/perplexity-color.png"
                    alt="Perplexity"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <span className="text-[var(--text-dim)] text-[0.6rem] font-mono" style={{ marginTop: '4px' }}>Perplexity</span>
              </div>
            </div>
          </div>

          {/* CTA Button - Opens Modal */}
          <div id="cta-section" className="w-full" style={{ marginBottom: '12px' }}>
            <button
              ref={ctaButtonRef}
              onClick={() => openModal('hero_cta')}
              className="form-button w-full flex items-center justify-center gap-2"
            >
              Get My Free AI Visibility Report
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Micro-reassurance */}
          <p className="text-[var(--text-dim)] text-xs text-center font-mono" style={{ marginBottom: '48px' }}>
            Free &middot; No credit card &middot; Results in minutes
          </p>

          {/* What You'll Discover Section */}
          <div className="w-full" style={{ marginBottom: '48px' }}>
            <h2 className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center" style={{ marginBottom: '20px' }}>
              What you&apos;ll discover
            </h2>

            <div className="flex flex-col gap-4">
              {/* Item 1 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <Search className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    See what AI sees
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    Find out if AI assistants mention and recommend your business
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <Users className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    Know your competition
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    Discover which competitors are winning AI visibility—and why
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    Get your action plan
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    Receive specific, actionable fixes to improve your AI presence
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="w-full" style={{ marginBottom: '48px' }}>
            <h2 className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center" style={{ marginBottom: '20px' }}>
              How it works
            </h2>

            <div className="flex flex-col gap-4">
              {/* Step 1 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[var(--green)] text-sm font-mono font-bold">1</span>
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    Enter your website
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    We crawl your site to understand your business
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[var(--green)] text-sm font-mono font-bold">2</span>
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    We scan 4 AI platforms
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    ChatGPT, Claude, Gemini, and Perplexity
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[var(--green)] text-sm font-mono font-bold">3</span>
                </div>
                <div>
                  <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '2px' }}>
                    Get your report
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    See exactly what AI says about your business
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Video */}
          <div className="w-full" style={{ marginBottom: '32px' }}>
            <h2 className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center" style={{ marginBottom: '16px' }}>
              What you get
            </h2>
            <DemoVideo />
          </div>

          {/* Secondary CTA */}
          <button
            onClick={() => openModal('bottom_cta')}
            className="form-button flex items-center justify-center w-full gap-2"
            style={{ marginBottom: '48px' }}
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* JOURN3Y attribution */}
          <Journ3yAttribution />
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Scan Form Modal */}
      <ScanFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        triggerButtonRef={ctaButtonRef}
      />
    </>
  )
}
