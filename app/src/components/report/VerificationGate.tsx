'use client'

import { useState } from 'react'
import { Ghost } from '@/components/ghost/Ghost'
import { Mail, RefreshCw, Loader2 } from 'lucide-react'

interface VerificationGateProps {
  email: string
  domain: string
  runId: string
  isVerified: boolean
  children: React.ReactNode
}

export function VerificationGate({
  email,
  domain,
  runId,
  isVerified,
  children
}: VerificationGateProps) {
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'rate_limited'>('idle')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number>(0)

  // If verified, show the report content
  if (isVerified) {
    return <>{children}</>
  }

  const handleResendVerification = async () => {
    setResendStatus('loading')
    setResendMessage(null)

    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, runId })
      })

      const data = await response.json()

      if (response.status === 429) {
        setResendStatus('rate_limited')
        setRetryAfter(data.retryAfter || 120)
        setResendMessage(data.message)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend email')
      }

      setResendStatus('success')
      setResendMessage(data.message)
    } catch (err) {
      setResendStatus('error')
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend email')
    }
  }

  // Show verification required prompt
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 text-center"
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Ghost */}
        <div className="flex justify-center mb-6">
          <Ghost size="lg" />
        </div>

        {/* Title */}
        <h1
          className="text-xl font-medium text-[var(--text)] mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Verify your email to view your report
        </h1>

        <p className="text-[var(--text-mid)] text-sm mb-6">
          Your AI visibility report for <strong className="text-[var(--text)]">{domain}</strong> is ready!
          Check your inbox for the verification link.
        </p>

        {/* Email display */}
        <div
          className="flex items-center justify-center gap-3 p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg mb-6"
        >
          <Mail size={20} className="text-[var(--green)]" />
          <div className="text-left">
            <div
              className="text-xs text-[var(--text-dim)] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Verification sent to
            </div>
            <div
              className="text-sm text-[var(--text)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {email}
            </div>
          </div>
        </div>

        {/* Resend button */}
        <div className="mb-6">
          {resendStatus === 'success' ? (
            <p className="text-[var(--green)] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {resendMessage || 'Verification email sent!'}
            </p>
          ) : resendStatus === 'rate_limited' ? (
            <p className="text-[var(--amber)] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              Please wait {retryAfter}s before requesting another email
            </p>
          ) : resendStatus === 'error' ? (
            <p className="text-[var(--red)] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {resendMessage || 'Failed to resend email'}
            </p>
          ) : null}

          <button
            onClick={handleResendVerification}
            disabled={resendStatus === 'loading' || resendStatus === 'rate_limited'}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {resendStatus === 'loading' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Resend verification email
              </>
            )}
          </button>
        </div>

        {/* Help text */}
        <div className="text-xs text-[var(--text-dim)] space-y-1">
          <p>Don&apos;t see the email? Check your spam or junk folder for an email from <strong className="text-[var(--text-mid)]">reports@outrankllm.io</strong></p>
          <p>The verification link expires in 24 hours.</p>
        </div>
      </div>
    </div>
  )
}
