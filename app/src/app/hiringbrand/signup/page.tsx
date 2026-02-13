'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Building2, Globe, CreditCard, Check, ArrowRight, ArrowLeft, Users } from 'lucide-react'
import {
  HB_TIER_PRICES,
  HB_TIER_NAMES,
  HB_CURRENCY_SYMBOL,
  HB_ANNUAL_MULTIPLIER,
  HB_DOMAIN_LIMITS,
} from '@/lib/hiringbrand-stripe'
import type { OrganizationTier } from '@/lib/organization'
import type { PricingRegion, BillingFrequency } from '@/lib/hiringbrand-stripe'

// HiringBrand CSS variables
const hbStyles = {
  '--hb-teal': '#4ABDAC',
  '--hb-teal-deep': '#2D8A7C',
  '--hb-teal-light': '#E8F7F5',
  '--hb-coral': '#FC4A1A',
  '--hb-coral-light': '#FFF0EC',
  '--hb-gold': '#F7B733',
  '--hb-slate': '#1E293B',
  '--hb-slate-mid': '#475569',
  '--hb-slate-light': '#94A3B8',
  '--hb-surface': '#FFFFFF',
  '--hb-surface-dim': '#F1F5F9',
} as React.CSSProperties

type Step = 'account' | 'organization' | 'tier' | 'checkout'

const TIERS: Array<Exclude<OrganizationTier, 'enterprise'>> = ['brand', 'agency_10', 'agency_20']

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [step, setStep] = useState<Step>('account')
  const [email, setEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [domain, setDomain] = useState('')
  const [tier, setTier] = useState<Exclude<OrganizationTier, 'enterprise'>>('agency_20')
  const [frequency, setFrequency] = useState<BillingFrequency>('monthly')
  const [region, setRegion] = useState<PricingRegion>('AU')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for canceled param
  const canceled = searchParams.get('canceled')

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStep('organization')
  }

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationName || !domain) return
    setStep('tier')
  }

  const handleTierSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleCheckout()
  }

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/hiringbrand/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          organizationName,
          domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
          tier,
          frequency,
          region,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const getPrice = (t: Exclude<OrganizationTier, 'enterprise'>) => {
    const monthlyPrice = HB_TIER_PRICES[region][t]
    if (frequency === 'annual') {
      return monthlyPrice * HB_ANNUAL_MULTIPLIER
    }
    return monthlyPrice
  }

  const formatPrice = (price: number) => {
    return `${HB_CURRENCY_SYMBOL[region]}${price.toLocaleString()}`
  }

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'account', label: 'Account', icon: <Users size={16} /> },
    { key: 'organization', label: 'Organization', icon: <Building2 size={16} /> },
    { key: 'tier', label: 'Plan', icon: <CreditCard size={16} /> },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  return (
    <div>
      {/* Progress steps */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
        {steps.map((s, i) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                background: i <= currentStepIndex ? 'var(--hb-teal)' : 'var(--hb-surface-dim)',
                color: i <= currentStepIndex ? 'white' : 'var(--hb-slate-light)',
                transition: 'all 0.2s',
              }}
            >
              {i < currentStepIndex ? <Check size={14} /> : s.icon}
              <span style={{ display: i === currentStepIndex ? 'inline' : 'none' }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: '24px',
                  height: '2px',
                  background: i < currentStepIndex ? 'var(--hb-teal)' : 'var(--hb-surface-dim)',
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Canceled message */}
      {canceled && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: 'var(--hb-coral-light)',
            color: 'var(--hb-coral)',
            fontSize: '14px',
          }}
        >
          Checkout was canceled. You can try again when you&apos;re ready.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: 'var(--hb-coral-light)',
            color: 'var(--hb-coral)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Account */}
      {step === 'account' && (
        <form onSubmit={handleAccountSubmit}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--hb-slate)',
              marginBottom: '8px',
              fontFamily: 'var(--font-outfit)',
            }}
          >
            Create your account
          </h2>
          <p style={{ color: 'var(--hb-slate-mid)', marginBottom: '24px', fontSize: '15px' }}>
            Enter your work email to get started
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--hb-slate-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              Work Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '1.5px solid var(--hb-surface-dim)',
                borderRadius: '10px',
                background: 'white',
                color: 'var(--hb-slate)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              background: 'var(--hb-coral)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.1s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </form>
      )}

      {/* Step 2: Organization */}
      {step === 'organization' && (
        <form onSubmit={handleOrgSubmit}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--hb-slate)',
              marginBottom: '8px',
              fontFamily: 'var(--font-outfit)',
            }}
          >
            Set up your organization
          </h2>
          <p style={{ color: 'var(--hb-slate-mid)', marginBottom: '24px', fontSize: '15px' }}>
            Tell us about the employer you want to monitor
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="orgName"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--hb-slate-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Corp"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '1.5px solid var(--hb-surface-dim)',
                borderRadius: '10px',
                background: 'white',
                color: 'var(--hb-slate)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="domain"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--hb-slate-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              Primary Employer Domain
            </label>
            <div style={{ position: 'relative' }}>
              <Globe
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--hb-slate-light)',
                }}
              />
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 44px',
                  fontSize: '15px',
                  border: '1.5px solid var(--hb-surface-dim)',
                  borderRadius: '10px',
                  background: 'white',
                  color: 'var(--hb-slate)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
              />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--hb-slate-light)', marginTop: '8px' }}>
              The employer website you want to monitor for AI reputation
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setStep('account')}
              style={{
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: 500,
                background: 'white',
                color: 'var(--hb-slate-mid)',
                border: '1.5px solid var(--hb-surface-dim)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'border-color 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                background: 'var(--hb-coral)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'transform 0.1s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Continue
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Tier Selection */}
      {step === 'tier' && (
        <form onSubmit={handleTierSubmit}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--hb-slate)',
              marginBottom: '8px',
              fontFamily: 'var(--font-outfit)',
            }}
          >
            Choose your plan
          </h2>
          <p style={{ color: 'var(--hb-slate-mid)', marginBottom: '24px', fontSize: '15px' }}>
            All plans include unlimited users and competitors
          </p>

          {/* Region & Frequency toggles */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                background: 'var(--hb-surface-dim)',
                borderRadius: '8px',
                padding: '4px',
              }}
            >
              {(['AU', 'INTL'] as PricingRegion[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: region === r ? 'white' : 'transparent',
                    color: region === r ? 'var(--hb-slate)' : 'var(--hb-slate-light)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {r === 'AU' ? 'AUD' : 'USD'}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                background: 'var(--hb-surface-dim)',
                borderRadius: '8px',
                padding: '4px',
                flex: 1,
              }}
            >
              {(['monthly', 'annual'] as BillingFrequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: frequency === f ? 'white' : 'transparent',
                    color: frequency === f ? 'var(--hb-slate)' : 'var(--hb-slate-light)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {f === 'monthly' ? 'Monthly' : 'Annual'}
                  {f === 'annual' && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--hb-gold)',
                        color: 'white',
                      }}
                    >
                      2 FREE
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tier cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {TIERS.map((t) => {
              const isSelected = tier === t
              const price = getPrice(t)
              const domainLimit = HB_DOMAIN_LIMITS[t]

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  style={{
                    padding: '20px',
                    border: isSelected ? '2px solid var(--hb-teal)' : '2px solid var(--hb-surface-dim)',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--hb-teal-light)' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          color: 'var(--hb-slate)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {HB_TIER_NAMES[t]}
                        {t === 'agency_20' && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--hb-teal)',
                              color: 'white',
                              textTransform: 'uppercase',
                            }}
                          >
                            Popular
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--hb-slate-mid)' }}>
                        {domainLimit === 1 ? '1 employer' : `Up to ${domainLimit} employers`} • Unlimited competitors
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: 700,
                          color: isSelected ? 'var(--hb-teal-deep)' : 'var(--hb-slate)',
                          fontFamily: 'var(--font-outfit)',
                        }}
                      >
                        {formatPrice(price)}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--hb-slate-light)' }}>
                        {frequency === 'annual' ? '/year' : '/month'}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(74, 189, 172, 0.3)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      {['Full reports', 'Weekly scans', 'Action plans', 'Competitor analysis'].map((feature) => (
                        <span
                          key={feature}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: 'var(--hb-teal-deep)',
                          }}
                        >
                          <Check size={14} />
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setStep('organization')}
              style={{
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: 500,
                background: 'white',
                color: 'var(--hb-slate-mid)',
                border: '1.5px solid var(--hb-surface-dim)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'border-color 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                background: loading ? 'var(--hb-slate-light)' : 'var(--hb-coral)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'transform 0.1s, box-shadow 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating checkout...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Continue to Payment
                </>
              )}
            </button>
          </div>

          {/* Enterprise note */}
          <p style={{ fontSize: '13px', color: 'var(--hb-slate-light)', marginTop: '16px', textAlign: 'center' }}>
            Need more than 20 employers?{' '}
            <a href="mailto:enterprise@hiringbrand.io" style={{ color: 'var(--hb-teal)' }}>
              Contact us for Enterprise pricing
            </a>
          </p>
        </form>
      )}
    </div>
  )
}

export default function HiringBrandSignupPage() {
  return (
    <div style={{ ...hbStyles, minHeight: '100vh', background: 'var(--hb-surface-dim)' }}>
      {/* Nav */}
      <nav
        style={{
          background: 'var(--hb-teal)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/hiringbrand"
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'white',
            textDecoration: 'none',
            fontFamily: 'var(--font-outfit)',
          }}
        >
          hiring<span style={{ fontWeight: 800 }}>brand</span>
          <span style={{ color: 'var(--hb-gold)' }}>.io</span>
        </Link>
        <Link
          href="/hiringbrand/login"
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.9)',
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      </nav>

      {/* Main content */}
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 64px)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            background: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--hb-teal)', margin: '0 auto' }} />
              </div>
            }
          >
            <SignupForm />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: 'var(--hb-slate-light)',
        }}
      >
        © {new Date().getFullYear()} HiringBrand.io • AI Employer Reputation Intelligence
      </footer>
    </div>
  )
}
