'use client'

import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { Check, ArrowLeft, Loader2, Globe } from 'lucide-react'
import Link from 'next/link'
import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  TIER_PRICES,
  CURRENCY_SYMBOL,
  CURRENCY_CODE,
  type PricingRegion,
  type SubscriptionTier
} from '@/lib/stripe-config'
import {
  detectPricingRegion,
  parseRegionParam,
  parseRegionCookie,
  REGION_COOKIE_NAME,
  type RegionDetectionContext
} from '@/lib/geo/pricing-region'

type TierKey = SubscriptionTier

interface Plan {
  name: string
  tier: TierKey
  description: string
  highlight: boolean
  features: string[]
  cta: string
  contactOnly?: boolean
}

const plans: Plan[] = [
  {
    name: 'Starter',
    tier: 'starter',
    description: 'For Business Owners',
    highlight: false,
    features: [
      '1 domain + 3 competitors',
      'Weekly AI visibility report',
      'ChatGPT, Claude & Gemini tracking',
      'Visibility score & trends',
      'Email alerts on changes',
      'Basic recommendations',
    ],
    cta: 'Subscribe',
  },
  {
    name: 'Pro',
    tier: 'pro',
    description: 'For Developers & Business Owners',
    highlight: true,
    features: [
      'Everything in Starter, plus:',
      'Monthly fix PRDs for AI tools',
      'Claude Code ready implementations',
      'Competitor gap analysis',
      'Priority prompt testing',
      'API access (coming soon)',
    ],
    cta: 'Subscribe',
  },
  {
    name: 'Agency',
    tier: 'agency',
    description: 'For Agencies',
    highlight: false,
    features: [
      'Everything in Pro, plus:',
      'Monitor multiple domains',
      'White-label reports',
      'Per-client dashboards',
      'Bulk competitor tracking',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    contactOnly: true,
  },
]

// Back button component that uses useSearchParams (needs Suspense boundary)
function BackButton() {
  const searchParams = useSearchParams()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    // Check if user came from a report page via:
    // 1. Query param ?from=report (most reliable)
    // 2. Referrer containing /report/ (fallback)
    const fromReport = searchParams.get('from') === 'report'
    const referrerFromReport = typeof window !== 'undefined' &&
      document.referrer &&
      document.referrer.includes('/report/')

    if ((fromReport || referrerFromReport) && window.history.length > 1) {
      setCanGoBack(true)
    }
  }, [searchParams])

  const handleBack = () => {
    window.history.back()
  }

  if (!canGoBack) return null

  return (
    <div className="w-full px-6" style={{ marginBottom: '24px' }}>
      <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-sm">Back to Report</span>
        </button>
      </div>
    </div>
  )
}

// Region toggle component
function RegionToggle({
  region,
  onToggle
}: {
  region: PricingRegion
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--green)] transition-all"
    >
      <Globe className="w-3 h-3" />
      <span>
        {region === 'AU' ? 'Viewing AUD prices' : 'Viewing USD prices'}
      </span>
    </button>
  )
}

// Pricing cards with checkout functionality
function PricingCards() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState<PricingRegion>('INTL')
  const [checkoutContext, setCheckoutContext] = useState<{
    leadId: string | null
    reportToken: string | null
    fromReport: boolean
    domain: string | null
  }>({ leadId: null, reportToken: null, fromReport: false, domain: null })

  // Detect region on mount
  useEffect(() => {
    const detectRegion = async () => {
      // Check query param first (for testing)
      const queryRegion = parseRegionParam(searchParams.get('region'))

      // Check cookie preference
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${REGION_COOKIE_NAME}=`))
        ?.split('=')[1]
      const cookieRegion = parseRegionCookie(cookieValue)

      // Build detection context
      const context: RegionDetectionContext = {
        queryParamRegion: queryRegion,
        cookieRegion: cookieRegion,
      }

      // Try to get lead data from session storage
      const leadId = sessionStorage.getItem('checkout_lead_id')
      if (leadId) {
        try {
          // Fetch lead data to check for Australian signals
          const response = await fetch(`/api/pricing/region-context?leadId=${leadId}`)
          if (response.ok) {
            const leadData = await response.json()
            context.leadDomain = leadData.domain
            context.leadLocation = leadData.location
            context.hasABN = leadData.hasABN
            context.hasAustralianPhone = leadData.hasAustralianPhone
          }
        } catch (e) {
          // Silently fail - we'll fall back to other detection methods
        }
      }

      // Detect region
      const result = detectPricingRegion(context)
      setRegion(result.region)
    }

    detectRegion()
  }, [searchParams])

  // Get checkout context (including domain from report)
  useEffect(() => {
    const fetchCheckoutContext = async () => {
      const leadId = sessionStorage.getItem('checkout_lead_id')
      const reportToken = sessionStorage.getItem('checkout_report_token')
      const fromReport = searchParams.get('from') === 'report'
      const storedDomain = sessionStorage.getItem('checkout_domain')

      // If we have a stored domain, use it
      if (storedDomain) {
        setCheckoutContext({ leadId, reportToken, fromReport, domain: storedDomain })
        return
      }

      // If we have a reportToken, fetch the domain from the report
      if (reportToken) {
        try {
          const response = await fetch(`/api/report/${reportToken}/domain`)
          if (response.ok) {
            const data = await response.json()
            if (data.domain) {
              sessionStorage.setItem('checkout_domain', data.domain)
              setCheckoutContext({ leadId, reportToken, fromReport, domain: data.domain })
              return
            }
          }
        } catch (e) {
          console.error('Failed to fetch domain from report:', e)
        }
      }

      setCheckoutContext({ leadId, reportToken, fromReport, domain: null })
    }

    fetchCheckoutContext()
  }, [searchParams])

  const handleToggleRegion = useCallback(() => {
    const newRegion = region === 'AU' ? 'INTL' : 'AU'
    setRegion(newRegion)

    // Save preference to cookie (expires in 30 days)
    document.cookie = `${REGION_COOKIE_NAME}=${newRegion}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
  }, [region])

  const handleSubscribe = useCallback(async (tier: TierKey) => {
    setError(null)

    // Check if we have a lead ID (user came from report)
    if (!checkoutContext.leadId) {
      // No lead ID - redirect to home to start a scan first
      router.push('/?subscribe=' + tier)
      return
    }

    // Check if we have a domain (required for new subscription flow)
    if (!checkoutContext.domain) {
      setError('Could not determine domain for subscription. Please try again from your report.')
      return
    }

    setLoadingTier(tier)

    try {
      // Use the new domain subscription API
      // Pass leadId for first-time subscribers (not logged in yet)
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: checkoutContext.domain,
          tier,
          region,
          leadId: checkoutContext.leadId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoadingTier(null)
    }
  }, [checkoutContext, router, region])

  const prices = TIER_PRICES[region]
  const currencySymbol = CURRENCY_SYMBOL[region]
  const currencyCode = CURRENCY_CODE[region]

  return (
    <div className="px-6 w-full" style={{ marginBottom: '48px' }}>
      <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Region toggle */}
        <div className="flex justify-center" style={{ marginBottom: '32px' }}>
          <RegionToggle region={region} onToggle={handleToggleRegion} />
        </div>

        {error && (
          <div
            className="border border-red-500/50 bg-red-500/10 text-red-400 font-mono text-sm text-center"
            style={{ padding: '12px 16px', marginBottom: '24px' }}
          >
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative flex flex-col border ${
                plan.highlight
                  ? 'border-[var(--green)] bg-[var(--surface)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {plan.highlight && (
                <div className="absolute -top-px left-0 right-0 h-px bg-[var(--green)]" />
              )}

              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--green)] text-[var(--bg)] font-mono text-xs uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="border-b border-[var(--border)]" style={{ padding: '28px 28px 24px' }}>
                <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '10px' }}>
                  {plan.description}
                </div>
                <h2 className="text-2xl font-medium" style={{ marginBottom: '16px' }}>
                  {plan.name}
                </h2>
                <div className="flex items-baseline gap-1">
                  {!plan.contactOnly ? (
                    <>
                      <span className="text-5xl font-medium">
                        {currencySymbol}{prices[plan.tier]}
                      </span>
                      <span className="text-[var(--text-dim)] font-mono text-sm">/month</span>
                    </>
                  ) : (
                    <span className="text-4xl font-medium">Custom pricing</span>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="flex-1" style={{ padding: '28px' }}>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ lineHeight: '1.5' }}>
                      <Check className="w-4 h-4 text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                      <span className="text-[var(--text-mid)]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding: '0 28px 28px' }}>
                {plan.contactOnly ? (
                  <a
                    href="mailto:help@outrankllm.io?subject=Agency Plan Inquiry"
                    className="block w-full py-4 font-mono text-sm text-center transition-all border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--text)]"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loadingTier !== null}
                    className={`block w-full py-4 font-mono text-sm text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.highlight
                        ? 'bg-[var(--green)] text-[var(--bg)] hover:opacity-90'
                        : 'border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--text)]'
                    }`}
                  >
                    {loadingTier === plan.tier ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Currency/Region notice */}
        <div className="text-center" style={{ marginTop: '32px' }}>
          <p className="text-[var(--text-dim)] font-mono text-xs">
            {region === 'AU' ? (
              <>
                Prices shown in {currencyCode} (Australian Dollars). GST included.
                <br />
                <span className="text-[var(--text-dim)]" style={{ opacity: 0.7 }}>
                  outrankllm.io is an Australian business. We collect GST from Australian customers.
                </span>
              </>
            ) : (
              <>
                Prices shown in {currencyCode} (US Dollars).
                <br />
                <button
                  onClick={handleToggleRegion}
                  className="text-[var(--green)] hover:underline"
                >
                  Australian customer? View AUD pricing with GST
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen" style={{ paddingTop: '140px', paddingBottom: '120px' }}>
        <div className="w-full flex flex-col items-center">
          {/* Back button - only shows when coming from a report */}
          <Suspense fallback={null}>
            <BackButton />
          </Suspense>

          {/* Header */}
          <div className="text-center px-6 w-full" style={{ marginBottom: '80px' }}>
            <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
            {/* Decorative top element */}
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: '24px' }}>
              <div className="w-8 h-px bg-[var(--border)]" />
              <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">Pricing</span>
              <div className="w-8 h-px bg-[var(--border)]" />
            </div>

            <h1 className="text-5xl md:text-6xl font-medium" style={{ marginBottom: '20px', letterSpacing: '-0.03em' }}>
              Simple, transparent pricing
            </h1>
            <p className="text-[var(--text-mid)] text-lg" style={{ maxWidth: '512px', marginLeft: 'auto', marginRight: 'auto' }}>
              Start with a free AI visibility report. Upgrade when you&apos;re ready.
            </p>
          </div>
        </div>

          {/* Pricing Cards */}
          <Suspense fallback={
            <div className="px-6 w-full" style={{ marginBottom: '80px' }}>
              <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
                <div className="grid md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border border-[var(--border)] bg-[var(--surface)] animate-pulse"
                      style={{ height: '400px' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          }>
            <PricingCards />
          </Suspense>

          {/* FAQ Teaser */}
          <div className="text-center px-6 w-full">
            <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="inline-flex items-center gap-6 p-4 border border-[var(--border)] bg-[var(--surface)]">
              <span className="text-[var(--text-dim)] font-mono text-sm">
                Questions?
              </span>
              <div className="w-px h-4 bg-[var(--border)]" />
              <Link href="/learn#faq" className="text-[var(--green)] font-mono text-sm hover:underline">
                Read FAQ →
              </Link>
              <div className="w-px h-4 bg-[var(--border)]" />
              <a href="mailto:hello@outrankllm.io" className="text-[var(--green)] font-mono text-sm hover:underline">
                Contact us →
              </a>
            </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
