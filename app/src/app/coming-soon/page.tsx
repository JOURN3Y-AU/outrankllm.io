'use client'

import { useState } from 'react'
import { Ghost } from '@/components/ghost/Ghost'
import { FloatingPixels } from '@/components/landing/FloatingPixels'

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')

    // For now, just simulate success - you can connect this to your API later
    await new Promise(resolve => setTimeout(resolve, 800))
    setStatus('success')
  }

  return (
    <>
      <div className="grid-bg" />
      <FloatingPixels />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center" style={{ padding: '24px' }}>
        <div className="stagger-children flex flex-col items-center text-center">
          {/* Ghost mascot */}
          <div style={{ marginBottom: '32px' }}>
            <Ghost size="lg" />
          </div>

          {/* Logo */}
          <div className="logo-text" style={{ marginBottom: '24px' }}>
            outrank<span className="mark">llm</span>
          </div>

          {/* Divider */}
          <div className="divider" style={{ marginBottom: '32px' }} />

          {/* Status indicator */}
          <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
            <div className="status-dot amber" />
            <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
              Coming Soon
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ marginBottom: '16px', fontSize: 'clamp(1.8rem, 5vw, 2.5rem)' }}>
            Something <span className="em">invisible</span> is coming
          </h1>

          {/* Subhead */}
          <p className="tagline" style={{ maxWidth: '400px', marginBottom: '40px' }}>
            AI visibility tools for developers who build in public.
            Be the first to know when we launch.
          </p>

          {/* Email signup */}
          {status === 'success' ? (
            <div className="card text-center" style={{ maxWidth: '380px' }}>
              <div className="text-[var(--green)] text-2xl" style={{ marginBottom: '8px' }}>✓</div>
              <p className="font-mono text-sm text-[var(--text-mid)]">
                You&apos;re on the list. We&apos;ll be in touch.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '380px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="form-button"
                  style={{ width: 'auto', padding: '18px 24px' }}
                >
                  {status === 'loading' ? '...' : 'Notify Me'}
                </button>
              </div>
            </form>
          )}

          {/* Footer note */}
          <p className="font-mono text-xs text-[var(--text-ghost)]" style={{ marginTop: '48px' }}>
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </main>
    </>
  )
}
