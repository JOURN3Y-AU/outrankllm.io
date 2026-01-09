'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { Loader2, Lock, Eye, EyeOff, Check, CheckCircle, AlertCircle } from 'lucide-react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"
          style={{ margin: '0 auto 24px' }}
        >
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-medium" style={{ marginBottom: '12px' }}>
          Invalid reset link
        </h1>
        <p className="text-[var(--text-mid)]" style={{ marginBottom: '24px' }}>
          This password reset link is invalid or has expired.
        </p>

        <Link
          href="/forgot-password"
          className="text-[var(--green)] font-mono text-sm hover:underline"
        >
          Request a new reset link →
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center"
          style={{ margin: '0 auto 24px' }}
        >
          <CheckCircle className="w-8 h-8 text-[var(--green)]" />
        </div>

        <h1 className="text-2xl font-medium" style={{ marginBottom: '12px' }}>
          Password reset!
        </h1>
        <p className="text-[var(--text-mid)]" style={{ marginBottom: '8px' }}>
          Your password has been updated successfully.
        </p>
        <p className="text-[var(--text-dim)] text-sm">
          Redirecting to dashboard...
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="text-center" style={{ marginBottom: '32px' }}>
        <div
          className="w-16 h-16 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center"
          style={{ margin: '0 auto 24px' }}
        >
          <Lock className="w-8 h-8 text-[var(--text-dim)]" />
        </div>

        <h1 className="text-2xl font-medium" style={{ marginBottom: '8px' }}>
          Set a new password
        </h1>
        <p className="text-[var(--text-mid)] text-sm">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors"
              style={{ padding: '12px 48px 12px 16px' }}
              placeholder="Enter password"
              required
              minLength={8}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ marginTop: '8px' }}>
            <Check className={`w-3 h-3 ${minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`} />
            <span className={minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}>
              At least 8 characters
            </span>
          </div>
        </div>

        <div>
          <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors"
            style={{ padding: '12px 16px' }}
            placeholder="Confirm password"
            required
          />
          {confirmPassword.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono" style={{ marginTop: '8px' }}>
              <Check className={`w-3 h-3 ${hasMatch ? 'text-[var(--green)]' : 'text-red-400'}`} />
              <span className={hasMatch ? 'text-[var(--green)]' : 'text-red-400'}>
                {hasMatch ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-sm font-mono text-center" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: '14px' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Resetting...
            </span>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen flex items-center justify-center" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <Suspense fallback={
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--green)]" style={{ margin: '0 auto' }} />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </>
  )
}
