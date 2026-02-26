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
import Link from 'next/link'
import { Search, Users, CheckCircle, ArrowRight, X } from 'lucide-react'
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import { usePricingRegion } from '@/hooks/usePricingRegion'
import { TIER_PRICES, CURRENCY_SYMBOL } from '@/lib/stripe-config'

export function HomePageD() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const ctaButtonRef = useRef<HTMLButtonElement>(null)
  const { region, loading } = usePricingRegion()
  const price = TIER_PRICES[region].starter
  const symbol = CURRENCY_SYMBOL[region]

  // Display price - show USD while loading
  const displayPrice = loading ? '$24.99' : `${symbol}${price}`

  const openModal = (source: string) => {
    trackEvent(ANALYTICS_EVENTS.SCAN_MODAL_OPENED, {
      source,
      variant: 'variant-d',
      price_shown: displayPrice,
      region,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    trackEvent(ANALYTICS_EVENTS.SCAN_MODAL_CLOSED)
    setIsModalOpen(false)
  }

  return (
    <>
      {/* CTA Button Animation Styles */}
      <style jsx>{`
        @keyframes ctaPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.6);
          }
        }
        .cta-enhanced {
          animation: ctaPulse 3s ease-in-out infinite;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
        }
        .cta-enhanced:hover {
          animation: none;
          transform: scale(1.02);
          box-shadow: 0 0 35px rgba(34, 197, 94, 0.7);
        }
      `}</style>

      {/* A/B Test Tracking */}
      <ExperimentTracker experimentName="homepage" />

      {/* Background layers */}
      <div className="grid-bg" />
      <FloatingPixels />
      <Nav />

      {/* Main content */}
      <main
        className="page relative z-10 min-h-screen flex flex-col items-center"
        style={{ paddingTop: '80px' }}
      >
        <div
          className="w-full flex flex-col items-center"
          style={{ maxWidth: '520px', padding: '0 20px' }}
        >
          {/* Logo - compact */}
          <div className="flex flex-col items-center gap-1" style={{ marginBottom: '16px' }}>
            <Ghost size="sm" />
            <div className="logo-text" style={{ fontSize: '1.125rem' }}>
              outrank<span className="mark">llm</span>.io
            </div>
          </div>

          {/* Headline - Emotional, customer-focused */}
          <h1
            className="text-center"
            style={{
              marginBottom: '12px',
              fontSize: 'clamp(1.4rem, 5vw, 1.75rem)',
              lineHeight: '1.25',
            }}
          >
            Is AI sending your customers{' '}
            <span className="em">to the competition?</span>
          </h1>

          {/* Subhead - Value-first, price at end */}
          <p
            className="text-[var(--text-mid)] text-center"
            style={{
              marginBottom: '16px',
              fontSize: 'clamp(0.85rem, 3vw, 1rem)',
              lineHeight: '1.5',
            }}
          >
            Find out in minutes. Track your visibility across ChatGPT, Claude, Gemini and
            Perplexity — starting at just{' '}
            <span className="text-[var(--green)] font-semibold">{displayPrice}/month</span>.
          </p>

          {/* Cut the Bloat Section - Condensed */}
          <div
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            style={{ padding: '12px', marginBottom: '16px' }}
          >
            <p
              className="text-[var(--text-mid)] text-xs text-center"
              style={{ marginBottom: '8px' }}
            >
              Other tools charge <span className="text-[var(--text)] font-semibold">$99–$499/month</span> for features you&apos;ll never use:
            </p>

            {/* What you DON'T need - crossed out, 2-column grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1" style={{ marginBottom: '8px' }}>
              <div className="flex items-center gap-1">
                <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[var(--text-dim)] text-xs line-through">Enterprise dashboards</span>
              </div>
              <div className="flex items-center gap-1">
                <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[var(--text-dim)] text-xs line-through">50+ SEO metrics</span>
              </div>
              <div className="flex items-center gap-1">
                <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[var(--text-dim)] text-xs line-through">Annual contracts</span>
              </div>
              <div className="flex items-center gap-1">
                <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[var(--text-dim)] text-xs line-through">Sales calls</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" style={{ margin: '8px 0' }} />

            {/* What you get - compact two-column */}
            <p
              className="text-[var(--green)] font-mono text-sm font-bold text-center"
              style={{ marginBottom: '6px' }}
            >
              outrankllm.io: Just {displayPrice}/mo
            </p>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[var(--green)] flex-shrink-0" />
                <span className="text-[var(--text)] text-xs">AI visibility insights</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[var(--green)] flex-shrink-0" />
                <span className="text-[var(--text)] text-xs">Competitor tracking</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[var(--green)] flex-shrink-0" />
                <span className="text-[var(--text)] text-xs">Actionable fixes</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[var(--green)] flex-shrink-0" />
                <span className="text-[var(--text)] text-xs">No contracts</span>
              </div>
            </div>
          </div>

          {/* Platform logos - condensed */}
          <div className="flex flex-col items-center w-full" style={{ marginBottom: '14px' }}>
            <span
              className="font-mono text-[0.55rem] text-[var(--text-dim)] uppercase tracking-widest"
              style={{ marginBottom: '8px' }}
            >
              We scan these AI assistants
            </span>
            <div
              className="flex items-end justify-between w-full"
              style={{ maxWidth: '280px' }}
            >
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center"
                  style={{ height: '28px' }}
                >
                  <Image
                    src="/images/ChatGPT-Logo.png"
                    alt="ChatGPT"
                    width={44}
                    height={44}
                    className="object-contain invert"
                  />
                </div>
                <span
                  className="text-[var(--text-dim)] text-[0.55rem] font-mono"
                  style={{ marginTop: '3px' }}
                >
                  ChatGPT
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center"
                  style={{ height: '28px' }}
                >
                  <Image
                    src="/images/Claude_AI_symbol.svg.png"
                    alt="Claude"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <span
                  className="text-[var(--text-dim)] text-[0.55rem] font-mono"
                  style={{ marginTop: '3px' }}
                >
                  Claude
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center"
                  style={{ height: '28px' }}
                >
                  <Image
                    src="/images/Google_Gemini_icon_2025.svg.png"
                    alt="Gemini"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <span
                  className="text-[var(--text-dim)] text-[0.55rem] font-mono"
                  style={{ marginTop: '3px' }}
                >
                  Gemini
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center"
                  style={{ height: '28px' }}
                >
                  <Image
                    src="/images/perplexity-color.png"
                    alt="Perplexity"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <span
                  className="text-[var(--text-dim)] text-[0.55rem] font-mono"
                  style={{ marginTop: '3px' }}
                >
                  Perplexity
                </span>
              </div>
            </div>
          </div>

          {/* Dual CTA Buttons — stack on mobile, side-by-side on sm+ */}
          <div id="cta-section" className="w-full flex flex-col sm:flex-row" style={{ gap: '12px', marginBottom: '40px' }}>
            {/* Free Trial column */}
            <div className="sm:flex-1 sm:min-w-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                ref={ctaButtonRef}
                onClick={() => openModal('hero_cta')}
                className="form-button w-full flex items-center justify-center"
                style={{ fontSize: '1rem', padding: '16px 20px', fontWeight: 600, boxSizing: 'border-box' }}
              >
                Start Your Free Trial
              </button>
              <span className="text-[var(--text-dim)] text-xs font-mono" style={{ marginTop: '8px', textAlign: 'center' }}>
                7-day free trial &middot; Limited features
              </span>
            </div>
            {/* Subscribe column */}
            <div className="sm:flex-1 sm:min-w-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Link
                href="/start"
                className="form-button w-full flex items-center justify-center"
                style={{ fontSize: '1rem', padding: '16px 20px', fontWeight: 600, boxSizing: 'border-box', textDecoration: 'none' }}
              >
                Subscribe Now
              </Link>
              <span className="text-[var(--text-dim)] text-xs font-mono" style={{ marginTop: '8px', textAlign: 'center' }}>
                Already trialled? Have a voucher?
              </span>
            </div>
          </div>

          {/* Trial Value Preview Section */}
          <div className="w-full" style={{ marginBottom: '40px' }}>
            <h2
              className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center"
              style={{ marginBottom: '16px' }}
            >
              What you&apos;ll discover
            </h2>

            <div className="flex flex-col gap-4">
              {/* Item 1 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <Search className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
                    Your AI Visibility Score
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    See how visible you are across ChatGPT, Claude, Gemini & Perplexity
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <Users className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
                    Who AI recommends instead
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    Discover which competitors are getting the visibility you deserve
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div>
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
                    Your personalized action plan
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    Get specific, actionable fixes to improve your AI presence
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="w-full" style={{ marginBottom: '40px' }}>
            <h2
              className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center"
              style={{ marginBottom: '16px' }}
            >
              How it works
            </h2>

            <div className="flex flex-col gap-4">
              {/* Step 1 */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[var(--green)] text-sm font-mono font-bold">1</span>
                </div>
                <div>
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
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
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
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
                  <p
                    className="text-[var(--text)] text-sm font-medium"
                    style={{ marginBottom: '2px' }}
                  >
                    Get your report in minutes
                  </p>
                  <p className="text-[var(--text-dim)] text-xs">
                    See exactly what AI says about your business
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Video */}
          <div className="w-full" style={{ marginBottom: '40px' }}>
            <h2
              className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center"
              style={{ marginBottom: '16px' }}
            >
              What you get
            </h2>
            <DemoVideo />
          </div>

          {/* Why We're Different Section */}
          <div className="w-full" style={{ marginBottom: '40px' }}>
            <h2
              className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center"
              style={{ marginBottom: '16px' }}
            >
              Why we&apos;re different
            </h2>
            <div
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              style={{ padding: '20px' }}
            >
              <p
                className="text-[var(--text-mid)] text-sm text-center"
                style={{ marginBottom: '16px' }}
              >
                Other tools bundle dozens of features you&apos;ll never use. We focus on one
                thing: showing you exactly what AI says about your business. We believe every
                business deserves these insights — not just those with $500/month budgets.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                  <span className="text-[var(--text)] text-sm">
                    No feature bloat — just the insights that matter
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                  <span className="text-[var(--text)] text-sm">
                    Same AI platforms as the expensive tools
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                  <span className="text-[var(--text)] text-sm">
                    Sign up in minutes, no sales calls required
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section */}
          <div className="w-full" style={{ marginBottom: '40px' }}>
            <h2
              className="font-mono text-[0.7rem] text-[var(--text-dim)] uppercase tracking-widest text-center"
              style={{ marginBottom: '16px' }}
            >
              What our customers say
            </h2>
            <div className="flex flex-col gap-4">
              {/* Testimonial 1 */}
              <div
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                style={{ padding: '16px' }}
              >
                <p
                  className="text-[var(--text-mid)] text-sm italic"
                  style={{ marginBottom: '12px' }}
                >
                  &ldquo;I was paying $99/month for another tool and getting the same insights.
                  Switched to outrankllm and saved $75/month with zero difference in quality.&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full bg-[var(--green)] flex items-center justify-center"
                    style={{ opacity: 0.2 }}
                  >
                    <span className="text-[var(--text)] text-xs font-bold">JM</span>
                  </div>
                  <div>
                    <p className="text-[var(--text)] text-sm font-medium">James M.</p>
                    <p className="text-[var(--text-dim)] text-xs">Marketing Director</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                style={{ padding: '16px' }}
              >
                <p
                  className="text-[var(--text-mid)] text-sm italic"
                  style={{ marginBottom: '12px' }}
                >
                  &ldquo;Finally understand why our competitors were ranking in AI results and we
                  weren&apos;t. The action plan alone was worth it.&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full bg-[var(--green)] flex items-center justify-center"
                    style={{ opacity: 0.2 }}
                  >
                    <span className="text-[var(--text)] text-xs font-bold">SR</span>
                  </div>
                  <div>
                    <p className="text-[var(--text)] text-sm font-medium">Sarah R.</p>
                    <p className="text-[var(--text-dim)] text-xs">Founder, SaaS startup</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                style={{ padding: '16px' }}
              >
                <p
                  className="text-[var(--text-mid)] text-sm italic"
                  style={{ marginBottom: '12px' }}
                >
                  &ldquo;We had no idea ChatGPT was recommending our main competitor instead of
                  us. Fixed it in two weeks using the insights from our report.&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full bg-[var(--green)] flex items-center justify-center"
                    style={{ opacity: 0.2 }}
                  >
                    <span className="text-[var(--text)] text-xs font-bold">DT</span>
                  </div>
                  <div>
                    <p className="text-[var(--text)] text-sm font-medium">David T.</p>
                    <p className="text-[var(--text-dim)] text-xs">E-commerce Owner</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary CTA */}
          <button
            onClick={() => openModal('bottom_cta')}
            className="form-button cta-enhanced flex items-center justify-center w-full gap-2"
            style={{ marginBottom: '48px', fontSize: '1.125rem', padding: '18px 28px', fontWeight: 600 }}
          >
            Get Your Free Trial
            <ArrowRight className="w-5 h-5" />
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
