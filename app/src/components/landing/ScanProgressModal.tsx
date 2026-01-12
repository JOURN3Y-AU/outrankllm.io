'use client'

import { useEffect, useState, useCallback } from 'react'
import { Ghost } from '@/components/ghost/Ghost'
import { X, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react'
import Link from 'next/link'

interface ScanProgressModalProps {
  scanId: string
  domain: string
  email: string
  isOpen: boolean
  onClose: () => void
}

interface ScanStatus {
  status: string
  progress: number
  statusMessage: string
  estimatedTimeRemaining: number
  isComplete: boolean
  isFailed: boolean
  errorMessage: string | null
  reportToken: string | null
}

export function ScanProgressModal({
  scanId,
  domain,
  email,
  isOpen,
  onClose
}: ScanProgressModalProps) {
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/scan/status?id=${scanId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStatus(data)
      return data
    } catch (err) {
      console.error('Status poll error:', err)
      setError('Failed to check scan status')
      return null
    }
  }, [scanId])

  useEffect(() => {
    if (!isOpen || !scanId) return

    // Initial poll
    pollStatus()

    // Poll every 3 seconds until complete or failed
    const interval = setInterval(async () => {
      const result = await pollStatus()
      if (result?.isComplete || result?.isFailed) {
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isOpen, scanId, pollStatus])

  if (!isOpen) return null

  const progress = status?.progress || 0
  const isComplete = status?.isComplete || false
  const isFailed = status?.isFailed || false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - clicking always closes (users can leave anytime) */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl"
        style={{ maxWidth: '480px', margin: '0 20px' }}
      >
        {/* Close button (always visible - users can close anytime) */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          title="You can close this - we'll email you when ready"
        >
          <X size={20} />
        </button>

        <div style={{ padding: '40px 32px 36px' }} className="text-center">
          {/* Ghost animation */}
          <div className="flex justify-center" style={{ marginBottom: '28px' }}>
            <div className={isComplete ? '' : 'animate-pulse'}>
              <Ghost size="lg" />
            </div>
          </div>

          {/* Status content */}
          {isFailed ? (
            <FailedContent
              errorMessage={status?.errorMessage || error || 'Unknown error'}
              onClose={onClose}
            />
          ) : isComplete ? (
            <CompleteContent email={email} domain={domain} />
          ) : (
            <ProgressContent
              domain={domain}
              progress={progress}
              statusMessage={status?.statusMessage || 'Starting scan...'}
              estimatedTime={status?.estimatedTimeRemaining || 600}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressContent({
  domain,
  progress,
  statusMessage,
  estimatedTime
}: {
  domain: string
  progress: number
  statusMessage: string
  estimatedTime: number
}) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`
    const minutes = Math.ceil(seconds / 60)
    return `~${minutes} min`
  }

  return (
    <>
      <h2
        className="text-2xl font-medium text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', marginBottom: '12px' }}
      >
        Analyzing<br />
        <span className="text-[var(--green)]">{domain}</span>
      </h2>

      <p className="text-[var(--text-mid)] text-sm" style={{ marginBottom: '32px', lineHeight: '1.6' }}>
        We&apos;re asking ChatGPT, Claude, Gemini, and Perplexity what they know about you... and your competitors.<br /><br />
        This takes 10-15 minutes. Grab a coffee — we&apos;ll email you when it&apos;s ready.<br /><br />
        <span className="text-[var(--text-dim)]">
          If you don&apos;t receive an email, check your spam or junk folder for <strong className="text-[var(--text-mid)]">reports@outrankllm.io</strong>
        </span>
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: '24px' }}>
        <div
          className="bg-[var(--surface-elevated)] rounded-full overflow-hidden"
          style={{ height: '8px' }}
        >
          <div
            className="h-full bg-[var(--green)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--text-dim)]" style={{ marginTop: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{progress}%</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(estimatedTime)}</span>
        </div>
      </div>

      {/* Status message */}
      <div
        className="flex items-center justify-center gap-2 text-[var(--text-mid)]"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', marginBottom: '28px' }}
      >
        <Loader2 size={14} className="animate-spin" />
        <span>{statusMessage}</span>
      </div>

      {/* Close hint and Learn link */}
      <div
        className="border-t border-[var(--border)]"
        style={{ paddingTop: '24px', marginTop: '8px' }}
      >
        <p className="text-[var(--text-dim)] text-sm" style={{ lineHeight: '1.6' }}>
          You can close this dialog, or{' '}
          <Link
            href="/learn"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--green)] hover:text-[var(--text)] transition-colors"
          >
            learn about GEO while you wait →
          </Link>
        </p>
      </div>
    </>
  )
}

function CompleteContent({ email, domain }: { email: string; domain: string }) {
  return (
    <>
      <div className="flex justify-center" style={{ marginBottom: '20px' }}>
        <div
          className="rounded-full bg-[var(--green)]/10 flex items-center justify-center"
          style={{ width: '56px', height: '56px' }}
        >
          <CheckCircle size={28} className="text-[var(--green)]" />
        </div>
      </div>

      <h2
        className="text-2xl font-medium text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', marginBottom: '16px' }}
      >
        Your report is ready!
      </h2>

      <p
        className="text-[var(--text-mid)] text-sm"
        style={{ marginBottom: '28px', lineHeight: '1.6' }}
      >
        We&apos;ve sent a verification email to view your AI visibility report for <strong className="text-[var(--text)]">{domain}</strong>.
      </p>

      {/* Email indicator */}
      <div
        className="flex items-center justify-center bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg"
        style={{ gap: '14px', padding: '18px 20px', marginBottom: '28px' }}
      >
        <Mail size={22} className="text-[var(--green)]" />
        <div className="text-left">
          <div
            className="text-xs text-[var(--text-dim)] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-mono)', marginBottom: '4px' }}
          >
            Check your inbox
          </div>
          <div
            className="text-[var(--text)]"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
          >
            {email}
          </div>
        </div>
      </div>

      <p
        className="text-[var(--text-dim)]"
        style={{ fontSize: '13px', lineHeight: '1.6' }}
      >
        Click the verification link in the email to view your report.<br />
        Don&apos;t see it? Check your spam or junk folder for an email from <strong className="text-[var(--text-mid)]">reports@outrankllm.io</strong><br />
        The link expires in 24 hours.
      </p>
    </>
  )
}

function FailedContent({
  errorMessage,
  onClose
}: {
  errorMessage: string
  onClose: () => void
}) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 rounded-full bg-[var(--red)]/10 flex items-center justify-center">
          <AlertCircle size={24} className="text-[var(--red)]" />
        </div>
      </div>

      <h2
        className="text-xl font-medium text-[var(--text)] mb-2"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Something went wrong
      </h2>

      <p className="text-[var(--text-mid)] text-sm mb-4">
        We couldn&apos;t complete the analysis. This might be due to website access restrictions.
      </p>

      <div
        className="p-3 bg-[var(--red)]/5 border border-[var(--red)]/20 rounded text-xs text-[var(--red)] mb-6"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {errorMessage}
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--text)] text-sm hover:border-[var(--text-dim)] transition-colors"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Try Again
      </button>
    </>
  )
}
