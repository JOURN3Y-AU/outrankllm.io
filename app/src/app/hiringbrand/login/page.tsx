'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const hbColors = {
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

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const setupOrgId = searchParams.get('setup')
  const redirect = searchParams.get('redirect')
  const isSetupMode = !!setupOrgId

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSetupMode) {
        // Password setup mode
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        const res = await fetch('/api/hiringbrand/auth/setup-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: setupOrgId,
            email: email.toLowerCase().trim(),
            password,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to set password')
          setLoading(false)
          return
        }
      } else {
        // Normal login mode
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
            password,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Login failed')
          setLoading(false)
          return
        }
      }

      // Success — redirect to dashboard
      router.push(redirect || '/hiringbrand/account')
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    border: `1px solid ${hbColors.slateLight}40`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
    color: hbColors.slate,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: hbColors.slateMid,
    marginBottom: '6px',
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
  }

  return (
    <div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: hbColors.slate,
          marginBottom: '8px',
          fontFamily: "'Outfit', system-ui, sans-serif",
          textAlign: 'center',
        }}
      >
        {isSetupMode ? 'Set up your password' : 'Sign in to HiringBrand'}
      </h1>
      <p
        style={{
          fontSize: '15px',
          color: hbColors.slateMid,
          marginBottom: '32px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {isSetupMode
          ? 'Create a password to access your dashboard.'
          : 'Enter your credentials to access your dashboard.'}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hbColors.teal
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSetupMode ? 'Create a password (8+ characters)' : 'Enter your password'}
            required
            minLength={8}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hbColors.teal
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
            }}
          />
        </div>

        {isSetupMode && (
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={8}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = hbColors.teal
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
              }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: hbColors.coralLight,
              color: hbColors.error,
              fontSize: '14px',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: "'Outfit', system-ui, sans-serif",
            background: loading ? hbColors.slateLight : hbColors.coral,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {loading
            ? (isSetupMode ? 'Setting up...' : 'Signing in...')
            : (isSetupMode ? 'Set Password & Continue' : 'Sign In')}
        </button>
      </form>

      {!isSetupMode && (
        <p
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '14px',
            color: hbColors.slateLight,
            lineHeight: 1.5,
          }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/hiringbrand"
            style={{ color: hbColors.tealDeep, fontWeight: 500, textDecoration: 'none' }}
          >
            Book a demo
          </Link>{' '}
          to get started.
        </p>
      )}
    </div>
  )
}

export default function HiringBrandLoginPage() {
  return (
    <div style={{ minHeight: '100vh', background: hbColors.surfaceDim }}>
      {/* Nav */}
      <nav
        style={{
          background: hbColors.teal,
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
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
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}
        >
          hiring<span style={{ fontWeight: 800 }}>brand</span>
          <span style={{ color: hbColors.gold }}>.io</span>
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
            maxWidth: '440px',
            background: 'white',
            borderRadius: '24px',
            padding: '48px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', padding: '40px', color: hbColors.slateMid }}>
                Loading...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: hbColors.slateLight,
        }}
      >
        &copy; {new Date().getFullYear()} HiringBrand.io
      </footer>
    </div>
  )
}
