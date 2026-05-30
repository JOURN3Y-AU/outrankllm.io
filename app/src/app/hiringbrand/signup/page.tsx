'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Globe, Loader2, Tag, Building2, Mail } from 'lucide-react'

const C = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',
  gold: '#F7B733',
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',
  surface: '#FFFFFF',
  surfaceDim: '#F1F5F9',
  error: '#EF4444',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  fontSize: '15px',
  fontFamily: "'Source Sans 3', system-ui, sans-serif",
  border: `1.5px solid ${C.surfaceDim}`,
  borderRadius: '10px',
  outline: 'none',
  color: C.slate,
  background: 'white',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: C.slateLight,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '8px',
  fontFamily: "'Source Sans 3', system-ui, sans-serif",
}

function SignupForm() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'

  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    try {
      const res = await fetch('/api/hiringbrand/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          organizationName: orgName.trim(),
          domain: cleanDomain,
          tier: 'pro_5',
          frequency: 'monthly',
          region: 'AU',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const isValid = orgName.trim().length >= 2 && email.includes('@') && domain.trim().length >= 3

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Link href="/hiringbrand" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '26px', fontWeight: 700, color: C.teal, fontFamily: "'Outfit', sans-serif" }}>
            hiring<span style={{ fontWeight: 800 }}>brand</span>
            <span style={{ color: C.gold }}>.io</span>
          </span>
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.slate, marginTop: '20px', marginBottom: '8px', fontFamily: "'Outfit', sans-serif" }}>
          Get started with HiringBrand
        </h1>
        <p style={{ fontSize: '15px', color: C.slateMid, lineHeight: 1.5 }}>
          Pro plan · 5 employer brands · A$89/month
        </p>
      </div>

      {/* Promo code callout */}
      <div style={{
        background: C.gold,
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '28px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: C.slate, margin: '0 0 2px', fontFamily: "'Outfit', sans-serif" }}>
          2 months free — webinar offer
        </p>
        <p style={{ fontSize: '13px', color: C.slate, margin: 0 }}>
          Enter code{' '}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, background: 'rgba(0,0,0,0.1)', padding: '1px 6px', borderRadius: '3px' }}>TORCPro</span>
          {' '}on the next screen
        </p>
      </div>

      {canceled && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '10px',
          background: C.coralLight,
          color: C.error,
          fontSize: '14px',
        }}>
          Checkout was cancelled — you can try again below.
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '10px',
          background: C.coralLight,
          color: C.error,
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Organisation name */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Your Organisation</label>
          <div style={{ position: 'relative' }}>
            <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.slateLight, pointerEvents: 'none' }} />
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Talent Co."
              required
              style={{ ...inputStyle, paddingLeft: '42px' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.teal }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.surfaceDim }}
            />
          </div>
          <p style={{ fontSize: '12px', color: C.slateLight, marginTop: '5px' }}>
            Your company or agency name — used for billing
          </p>
        </div>

        {/* Work email */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Work Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.slateLight, pointerEvents: 'none' }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{ ...inputStyle, paddingLeft: '42px' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.teal }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.surfaceDim }}
            />
          </div>
        </div>

        {/* First employer domain */}
        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>First Employer to Monitor</label>
          <div style={{ position: 'relative' }}>
            <Globe size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.slateLight, pointerEvents: 'none' }} />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              required
              style={{ ...inputStyle, paddingLeft: '42px' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.teal }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.surfaceDim }}
            />
          </div>
          <p style={{ fontSize: '12px', color: C.slateLight, marginTop: '5px' }}>
            You can add up to 4 more brands after signup
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !isValid}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: "'Outfit', sans-serif",
            background: loading || !isValid ? C.slateLight : C.coral,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: loading || !isValid ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!loading && isValid) {
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
              <Loader2 size={18} style={{ animation: 'hb-spin 1s linear infinite' }} />
              Redirecting to checkout...
            </>
          ) : (
            <>
              Continue to Payment
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: C.slateLight, lineHeight: 1.5 }}>
        Already have an account?{' '}
        <Link href="/hiringbrand/login" style={{ color: C.tealDeep, fontWeight: 500, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>

      {/* Trust line */}
      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: C.slateLight }}>
        Secure payment via Stripe · Cancel anytime
      </p>

      <style>{`@keyframes hb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function HiringBrandSignupPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.surfaceDim }}>
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '460px', background: 'white', borderRadius: '24px', padding: '48px', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)' }}>
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: C.slateMid }}>Loading...</div>}>
            <SignupForm />
          </Suspense>
        </div>
      </main>
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: C.slateLight, marginTop: '-40px' }}>
        © {new Date().getFullYear()} HiringBrand.io
      </footer>
    </div>
  )
}
