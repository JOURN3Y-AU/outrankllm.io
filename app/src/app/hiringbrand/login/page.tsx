'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HBAuthShell,
  hbColors,
  hbInputStyle,
  hbLabelStyle,
  hbButtonStyle,
} from '@/components/hiringbrand/HBAuthShell'

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
          <label style={hbLabelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            style={hbInputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hbColors.teal
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <label style={hbLabelStyle}>Password</label>
            {!isSetupMode && (
              <Link
                href="/hiringbrand/forgot-password"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: hbColors.tealDeep,
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSetupMode ? 'Create a password (8+ characters)' : 'Enter your password'}
            required
            minLength={8}
            style={hbInputStyle}
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
            <label style={hbLabelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={8}
              style={hbInputStyle}
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

        <button type="submit" disabled={loading} style={hbButtonStyle(loading)}>
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
    <HBAuthShell>
      <Suspense
        fallback={
          <div style={{ textAlign: 'center', padding: '40px', color: hbColors.slateMid }}>
            Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </HBAuthShell>
  )
}
