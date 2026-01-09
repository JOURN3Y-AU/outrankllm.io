'use client'

import Link from 'next/link'
import { XCircle, ArrowLeft } from 'lucide-react'
import { Nav } from '@/components/nav/Nav'

export default function SubscribeCancelPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen flex items-center justify-center" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full bg-[var(--text-dim)]/10 flex items-center justify-center"
              style={{ margin: '0 auto 24px' }}
            >
              <XCircle className="w-8 h-8 text-[var(--text-dim)]" />
            </div>

            <h1 className="text-3xl font-medium" style={{ marginBottom: '12px' }}>
              Checkout cancelled
            </h1>
            <p className="text-[var(--text-mid)] text-lg" style={{ marginBottom: '32px' }}>
              No worries! Your free report is still available. You can subscribe anytime.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--text)] transition-all font-mono text-sm"
                style={{ padding: '16px 28px' }}
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>

              <Link
                href="/pricing"
                className="form-button inline-flex items-center justify-center gap-2"
                style={{ padding: '16px 28px' }}
              >
                View Plans
              </Link>
            </div>

            <p className="text-[var(--text-dim)] font-mono text-xs" style={{ marginTop: '32px' }}>
              Questions? <a href="mailto:hello@outrankllm.io" className="text-[var(--green)] hover:underline">Contact us</a>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
