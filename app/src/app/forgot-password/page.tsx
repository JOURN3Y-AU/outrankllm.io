'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
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
        body: JSON.stringify({ email }),
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

  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen flex items-center justify-center" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          {sent ? (
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center"
                style={{ margin: '0 auto 24px' }}
              >
                <CheckCircle className="w-8 h-8 text-[var(--green)]" />
              </div>

              <h1 className="text-2xl font-medium" style={{ marginBottom: '12px' }}>
                Check your email
              </h1>
              <p className="text-[var(--text-mid)]" style={{ marginBottom: '32px' }}>
                If an account exists for <strong className="text-[var(--text)]">{email}</strong>, you&apos;ll receive a password reset link shortly.
              </p>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-[var(--green)] font-mono text-sm hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center" style={{ marginBottom: '32px' }}>
                <div
                  className="w-16 h-16 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center"
                  style={{ margin: '0 auto 24px' }}
                >
                  <Mail className="w-8 h-8 text-[var(--text-dim)]" />
                </div>

                <h1 className="text-2xl font-medium" style={{ marginBottom: '8px' }}>
                  Forgot your password?
                </h1>
                <p className="text-[var(--text-mid)] text-sm">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors"
                    style={{ padding: '12px 16px' }}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm font-mono text-center" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ padding: '14px' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  )
}
