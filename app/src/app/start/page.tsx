'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { useSession } from '@/lib/auth-client'
import { usePricingRegion } from '@/hooks/usePricingRegion'
import { TIER_PRICES, CURRENCY_SYMBOL } from '@/lib/stripe-config'
import { Check, ArrowRight, Loader2 } from 'lucide-react'

type TierKey = 'starter' | 'pro'

const TIER_FEATURES: Record<TierKey, string[]> = {
  starter: [
    'Weekly AI visibility report',
    'ChatGPT, Claude & Gemini tracking',
    'Email alerts on changes',
  ],
  pro: [
    'Everything in Starter, plus:',
    'Competitor gap analysis',
    'Monthly fix PRDs for AI tools',
  ],
}

function StartContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const { region, loading: regionLoading } = usePricingRegion()

  const [selectedTier, setSelectedTier] = useState<TierKey>('starter')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Pre-fill from URL params
  useEffect(() => {
    const tierParam = searchParams.get('tier')
    if (tierParam === 'starter' || tierParam === 'pro') {
      setSelectedTier(tierParam)
    }

    const domainParam = searchParams.get('domain')
    if (domainParam) setDomain(domainParam)

    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(emailParam)

    const promoParam = searchParams.get('promo')
    if (promoParam) {
      setVoucherCode(promoParam)
    }
  }, [searchParams])

  // Pre-fill email from session
  useEffect(() => {
    if (session?.email && !email) {
      setEmail(session.email)
    }
  }, [session, email])

  const checkoutCancelled = searchParams.get('checkout_cancelled') === 'true'

  const prices = TIER_PRICES[region]
  const symbol = CURRENCY_SYMBOL[region]

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    // Clean domain
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/$/, '')

    try {
      const response = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          domain: cleanDomain,
          tier: selectedTier,
          region,
          agreedToTerms,
          ...(voucherCode.trim() ? { voucherCode: voucherCode.trim() } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Start checkout error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('idle')
    }
  }, [domain, email, selectedTier, region, agreedToTerms, voucherCode])

  const isLoggedIn = !!session
  const isFormValid = domain.trim().length >= 3 && email.trim().includes('@') && agreedToTerms
  const selectedPrice = prices[selectedTier]

  return (
    <div className="w-full flex flex-col items-center" style={{ padding: '0 20px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <h1 className="text-3xl md:text-4xl font-medium" style={{ marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Start monitoring your AI visibility
          </h1>
          <p className="text-[var(--text-mid)]" style={{ fontSize: '15px' }}>
            Choose a plan, enter your details, and you&apos;ll be scanning in minutes.
          </p>
        </div>

        {/* Checkout cancelled notice */}
        {checkoutCancelled && (
          <div
            className="border border-[var(--amber)]/50 bg-[var(--amber)]/10 text-[var(--amber)] font-mono text-sm text-center"
            style={{ padding: '12px 16px', marginBottom: '24px' }}
          >
            Checkout was cancelled. You can try again below.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Tier selection */}
          <div style={{ marginBottom: '24px' }}>
            <label className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider block" style={{ marginBottom: '10px' }}>
              Select your plan
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['starter', 'pro'] as const).map((tier) => {
                const isSelected = selectedTier === tier
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`relative text-left border transition-all ${
                      isSelected
                        ? 'border-[var(--green)] bg-[var(--green)]/5'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-dim)]'
                    }`}
                    style={{ padding: '16px' }}
                  >
                    {tier === 'pro' && (
                      <span
                        className="absolute font-mono text-[var(--bg)] bg-[var(--green)]"
                        style={{ top: '-1px', right: '12px', fontSize: '0.6rem', padding: '2px 6px', letterSpacing: '0.05em' }}
                      >
                        POPULAR
                      </span>
                    )}

                    <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                      <span className="font-medium capitalize">{tier}</span>
                      {isSelected && (
                        <div
                          className="w-5 h-5 rounded-full bg-[var(--green)] flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-[var(--bg)]" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1" style={{ marginBottom: '10px' }}>
                      {!regionLoading && (
                        <>
                          <span className="text-2xl font-medium">{symbol}{prices[tier]}</span>
                          <span className="text-[var(--text-dim)] font-mono text-xs">/mo</span>
                        </>
                      )}
                      {regionLoading && (
                        <span className="text-[var(--text-dim)] font-mono text-xs">Loading...</span>
                      )}
                    </div>

                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {TIER_FEATURES[tier].map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-dim)]">
                          <Check className="w-3 h-3 text-[var(--green)] flex-shrink-0" style={{ marginTop: '1px' }} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Domain input */}
          <div style={{ marginBottom: '16px' }}>
            <label className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider block" style={{ marginBottom: '6px' }}>
              Your website
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="yourbusiness.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={status === 'loading'}
              required
              autoFocus={!searchParams.get('domain')}
            />
          </div>

          {/* Email input */}
          <div style={{ marginBottom: '16px' }}>
            <label className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider block" style={{ marginBottom: '6px' }}>
              Your email
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading' || isLoggedIn}
              required
              style={isLoggedIn ? { opacity: 0.7 } : undefined}
            />
            {isLoggedIn && (
              <p className="text-[var(--text-dim)] font-mono text-xs" style={{ marginTop: '4px' }}>
                Signed in as {session.email}
              </p>
            )}
          </div>

          {/* Voucher code */}
          <div style={{ marginBottom: '16px' }}>
            <label className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider block" style={{ marginBottom: '6px' }}>
              Voucher code <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. FREETRIAL"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              disabled={status === 'loading'}
            />
          </div>

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer" style={{ padding: '4px 0', marginBottom: '20px' }}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={status === 'loading'}
              className="mt-0.5 w-4 h-4 accent-[var(--green)] cursor-pointer"
              style={{ flexShrink: 0 }}
            />
            <span className="text-[0.7rem] text-[var(--text-dim)] leading-tight">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="text-[var(--green)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms & Conditions
              </Link>
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div
              className="border border-red-500/50 bg-red-500/10 text-red-400 font-mono text-sm text-center"
              style={{ padding: '12px 16px', marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={status === 'loading' || !isFormValid}
            className="form-button flex items-center justify-center gap-2"
            title={!agreedToTerms ? 'Please agree to the Terms & Conditions' : undefined}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Reassurance text */}
        <div className="text-center" style={{ marginTop: '16px', marginBottom: '32px' }}>
          <p className="text-[var(--text-dim)] font-mono text-xs">
            {voucherCode.trim()
              ? 'Your voucher will be applied at checkout.'
              : <>{!regionLoading && <>{symbol}{selectedPrice}/mo</>}. Cancel anytime.</>}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function StartPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen" style={{ paddingTop: '140px', paddingBottom: '80px' }}>
        <Suspense fallback={
          <div className="flex items-center justify-center" style={{ padding: '120px 24px' }}>
            <Loader2 className="w-8 h-8 animate-spin text-[var(--green)]" />
          </div>
        }>
          <StartContent />
        </Suspense>
      </main>

      <Footer />
    </>
  )
}
