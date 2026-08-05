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

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minLength = password.length >= 8
  const hasMatch = password === confirmPassword && password.length > 0
  const isValid = minLength && hasMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Invalid reset link')
      return
    }

    if (!isValid) {
      setError('Please fix the errors above')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)

      // The reset endpoint signs the user in, so send them straight to their
      // HiringBrand dashboard — not the outrankllm one.
      setTimeout(() => {
        router.push('/hiringbrand/account')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const headingStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: hbColors.slate,
    marginBottom: '8px',
    fontFamily: "'Outfit', system-ui, sans-serif",
    textAlign: 'center',
  }

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1 style={headingStyle}>Invalid reset link</h1>
        <p
          style={{
            fontSize: '15px',
            color: hbColors.slateMid,
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/hiringbrand/forgot-password"
          style={{ color: hbColors.tealDeep, fontWeight: 600, textDecoration: 'none', fontSize: '15px' }}
        >
          Request a new reset link &rarr;
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1 style={headingStyle}>Password updated</h1>
        <p style={{ fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.5 }}>
          Taking you to your HiringBrand dashboard...
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 style={headingStyle}>Set a new password</h1>
      <p
        style={{
          fontSize: '15px',
          color: hbColors.slateMid,
          marginBottom: '32px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Choose a new password for your HiringBrand account.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={hbLabelStyle}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (8+ characters)"
            required
            minLength={8}
            autoFocus
            style={hbInputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = hbColors.teal
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${hbColors.slateLight}40`
            }}
          />
          {password.length > 0 && !minLength && (
            <p style={{ fontSize: '13px', color: hbColors.error, marginTop: '6px' }}>
              At least 8 characters
            </p>
          )}
        </div>

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
          {confirmPassword.length > 0 && !hasMatch && (
            <p style={{ fontSize: '13px', color: hbColors.error, marginTop: '6px' }}>
              Passwords do not match
            </p>
          )}
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

        <button
          type="submit"
          disabled={!isValid || loading}
          style={hbButtonStyle(loading, !isValid)}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </>
  )
}

export default function HiringBrandResetPasswordPage() {
  return (
    <HBAuthShell>
      <Suspense
        fallback={
          <div style={{ textAlign: 'center', padding: '40px', color: hbColors.slateMid }}>
            Loading...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </HBAuthShell>
  )
}
