'use client'

import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement authentication
    console.log('Login attempt:', { email })
  }

  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
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
          <form onSubmit={handleSubmit} className="space-y-4" style={{ marginBottom: '24px' }}>
            <div>
              <label htmlFor="email" className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono text-sm placeholder:text-[var(--text-dim)] focus:border-[var(--green)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono text-sm placeholder:text-[var(--text-dim)] focus:border-[var(--green)] focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
          </form>

          {/* Links */}
          <div className="text-center space-y-3">
            <p className="text-sm text-[var(--text-dim)]">
              <Link href="/forgot-password" className="text-[var(--text-mid)] hover:text-[var(--text)]">
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

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="font-mono text-xs text-[var(--text-dim)]">or</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Social Login Placeholder */}
          <div className="space-y-3">
            <button
              type="button"
              disabled
              className="w-full py-3 border border-[var(--border)] text-[var(--text-dim)] font-mono text-sm cursor-not-allowed opacity-50"
            >
              Continue with Google (Coming Soon)
            </button>
            <button
              type="button"
              disabled
              className="w-full py-3 border border-[var(--border)] text-[var(--text-dim)] font-mono text-sm cursor-not-allowed opacity-50"
            >
              Continue with GitHub (Coming Soon)
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
