'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HBAuthShell,
  hbColors,
  hbInputStyle,
  hbLabelStyle,
  hbButtonStyle,
} from '@/components/hiringbrand/HBAuthShell'

export default function HiringBrandForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), brand: 'hiringbrand' }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <HBAuthShell>
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: hbColors.slate,
              marginBottom: '12px',
              fontFamily: "'Outfit', system-ui, sans-serif",
            }}
          >
            Check your email
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: hbColors.slateMid,
              lineHeight: 1.6,
              marginBottom: '32px',
            }}
          >
            If a HiringBrand account exists for{' '}
            <strong style={{ color: hbColors.slate }}>{email}</strong>, you&apos;ll receive a
            password reset link shortly. The link expires in 1 hour.
          </p>
          <Link
            href="/hiringbrand/login"
            style={{ color: hbColors.tealDeep, fontWeight: 600, textDecoration: 'none', fontSize: '15px' }}
          >
            &larr; Back to sign in
          </Link>
        </div>
      </HBAuthShell>
    )
  }

  return (
    <HBAuthShell>
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
        Forgot your password?
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
        Enter the email you use for HiringBrand and we&apos;ll send you a reset link.
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
            autoFocus
            style={hbInputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hbColors.teal
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
            }}
          />
        </div>

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
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
        <Link
          href="/hiringbrand/login"
          style={{ color: hbColors.slateLight, textDecoration: 'none' }}
        >
          &larr; Back to sign in
        </Link>
      </p>
    </HBAuthShell>
  )
}
