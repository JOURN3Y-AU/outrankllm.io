'use client'

import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { login } from '@/lib/auth-client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password)

    if (result.success) {
      router.push(redirectTo)
    } else {
      setError(result.error || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
      {error && (
        <div
          className="border border-red-500/50 bg-red-500/10 text-red-400 text-sm"
          style={{ padding: '12px 16px', marginBottom: '16px' }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="email"
          className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider"
          style={{ marginBottom: '8px' }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          disabled={loading}
          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono text-sm placeholder:text-[var(--text-dim)] focus:border-[var(--green)] focus:outline-none transition-colors disabled:opacity-50"
          style={{ padding: '12px 16px' }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label
          htmlFor="password"
          className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider"
          style={{ marginBottom: '8px' }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          disabled={loading}
          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono text-sm placeholder:text-[var(--text-dim)] focus:border-[var(--green)] focus:outline-none transition-colors disabled:opacity-50"
          style={{ padding: '12px 16px' }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ padding: '14px' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main
        className="relative z-10 min-h-screen flex items-center justify-center"
        style={{ padding: '24px' }}
      >
        <div className="w-full" style={{ maxWidth: '384px' }}>
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <h1 className="text-2xl font-medium" style={{ marginBottom: '8px' }}>
              Welcome back
            </h1>
            <p className="text-[var(--text-dim)] text-sm">
              Sign in to your outrankllm account
            </p>
          </div>

          {/* Login Form */}
          <Suspense
            fallback={
              <div className="text-center" style={{ padding: '24px' }}>
                <Loader2 className="w-6 h-6 animate-spin text-[var(--green)]" style={{ margin: '0 auto' }} />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          {/* Links */}
          <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p className="text-sm text-[var(--text-dim)]">
              <Link
                href="/forgot-password"
                className="text-[var(--text-mid)] hover:text-[var(--text)]"
              >
                Forgot your password?
              </Link>
            </p>
            <p className="text-sm text-[var(--text-dim)]">
              Don&apos;t have an account?{' '}
              <Link href="/" className="text-[var(--green)] hover:underline">
                Get started free
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
