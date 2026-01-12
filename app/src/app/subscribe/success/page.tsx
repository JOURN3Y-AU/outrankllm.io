'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Loader2, ArrowRight, Sparkles, Lock, Globe } from 'lucide-react'
import { Nav } from '@/components/nav/Nav'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

type PageStatus = 'loading' | 'set-password' | 'complete' | 'error'

interface VerificationData {
  email: string
  tier: string
  isNewDomain: boolean
  domain: string | null
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [reportToken, setReportToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sid = searchParams.get('session_id')
    const report = searchParams.get('report')

    if (report) {
      setReportToken(report)
    }

    // Clear checkout context from session storage
    sessionStorage.removeItem('checkout_lead_id')
    sessionStorage.removeItem('checkout_report_token')

    if (!sid) {
      setStatus('error')
      setError('No checkout session found')
      return
    }

    setSessionId(sid)

    // Verify the checkout session and check if password is already set
    const verifySession = async () => {
      try {
        const res = await fetch(`/api/stripe/verify-session?session_id=${sid}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify session')
        }

        setVerificationData({
          email: data.email,
          tier: data.tier,
          isNewDomain: data.isNewDomain,
          domain: data.domain,
        })

        if (data.hasPassword) {
          // User already has a password (returning customer) - go straight to complete
          setStatus('complete')
        } else {
          // New subscriber - needs to set password
          setStatus('set-password')
        }
      } catch (err) {
        console.error('Verification error:', err)
        setError(err instanceof Error ? err.message : 'Failed to verify checkout')
        setStatus('error')
      }
    }

    // Give the webhook a moment to process, then verify
    setTimeout(verifySession, 2000)
  }, [searchParams])

  const handlePasswordSuccess = () => {
    setStatus('complete')
  }

  if (status === 'loading') {
    return (
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--green)]" style={{ margin: '0 auto 24px' }} />
        <h1 className="text-2xl font-medium" style={{ marginBottom: '12px' }}>
          Processing your subscription...
        </h1>
        <p className="text-[var(--text-mid)]">
          Please wait while we activate your account.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"
          style={{ margin: '0 auto 24px' }}
        >
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <h1 className="text-2xl font-medium" style={{ marginBottom: '12px' }}>
          Something went wrong
        </h1>
        <p className="text-[var(--text-mid)]" style={{ marginBottom: '24px' }}>
          {error || 'We couldn\'t verify your subscription. Please contact support.'}
        </p>
        <a
          href="mailto:hello@outrankllm.io"
          className="text-[var(--green)] font-mono text-sm hover:underline"
        >
          Contact Support →
        </a>
      </div>
    )
  }

  if (status === 'set-password' && sessionId && verificationData) {
    return (
      <div>
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <div
            className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center"
            style={{ margin: '0 auto 24px' }}
          >
            <Lock className="w-8 h-8 text-[var(--green)]" />
          </div>

          <h1 className="text-3xl font-medium" style={{ marginBottom: '12px' }}>
            Create Your Account
          </h1>
          <p className="text-[var(--text-mid)]">
            Set a password to access your dashboard and manage your subscription.
          </p>
        </div>

        <div
          className="border border-[var(--border)] bg-[var(--surface)]"
          style={{ padding: '28px' }}
        >
          <SetPasswordForm
            sessionId={sessionId}
            email={verificationData.email}
            onSuccess={handlePasswordSuccess}
          />
        </div>
      </div>
    )
  }

  // Complete state - different content for domain additions vs first-time signup
  const isNewDomain = verificationData?.isNewDomain
  const domain = verificationData?.domain

  if (isNewDomain && domain) {
    // Domain addition success
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center"
          style={{ margin: '0 auto 24px' }}
        >
          <Globe className="w-8 h-8 text-[var(--green)]" />
        </div>

        <h1 className="text-3xl font-medium" style={{ marginBottom: '12px' }}>
          Domain Added
        </h1>
        <p className="text-[var(--text-mid)] text-lg" style={{ marginBottom: '32px' }}>
          <span className="font-mono text-[var(--text)]">{domain}</span> is now being monitored.
        </p>

        <div
          className="border border-[var(--border)] bg-[var(--surface)]"
          style={{ padding: '24px', marginBottom: '32px' }}
        >
          <h2 className="font-mono text-sm text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '16px' }}>
            What happens next
          </h2>
          <ul className="text-left" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li className="flex items-center gap-3 text-sm">
              <Sparkles className="w-4 h-4 text-[var(--green)]" />
              <span>Initial scan is starting now</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Sparkles className="w-4 h-4 text-[var(--green)]" />
              <span>Results ready in ~5 minutes</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Sparkles className="w-4 h-4 text-[var(--green)]" />
              <span>Weekly monitoring enabled</span>
            </li>
          </ul>
        </div>

        <Link
          href="/dashboard"
          className="form-button inline-flex items-center justify-center gap-2"
          style={{ padding: '16px 28px' }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  // First-time signup success
  return (
    <div className="text-center">
      <div
        className="w-16 h-16 rounded-full bg-[var(--green)]/10 flex items-center justify-center"
        style={{ margin: '0 auto 24px' }}
      >
        <CheckCircle className="w-8 h-8 text-[var(--green)]" />
      </div>

      <h1 className="text-3xl font-medium" style={{ marginBottom: '12px' }}>
        Welcome aboard!
      </h1>
      <p className="text-[var(--text-mid)] text-lg" style={{ marginBottom: '32px' }}>
        Your account is ready. You have full access to all premium features.
      </p>

      <div
        className="border border-[var(--border)] bg-[var(--surface)]"
        style={{ padding: '24px', marginBottom: '32px' }}
      >
        <h2 className="font-mono text-sm text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '16px' }}>
          What&apos;s unlocked
        </h2>
        <ul className="text-left" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <li className="flex items-center gap-3 text-sm">
            <Sparkles className="w-4 h-4 text-[var(--green)]" />
            <span>Full competitor analysis</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <Sparkles className="w-4 h-4 text-[var(--green)]" />
            <span>Personalized action plans</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <Sparkles className="w-4 h-4 text-[var(--green)]" />
            <span>PRD generation for AI coding tools</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <Sparkles className="w-4 h-4 text-[var(--green)]" />
            <span>Weekly monitoring & alerts</span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/dashboard"
          className="form-button inline-flex items-center justify-center gap-2"
          style={{ padding: '16px 28px' }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
        {reportToken && (
          <Link
            href={`/report/${reportToken}`}
            className="inline-flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--text)] transition-colors font-mono text-sm"
            style={{ padding: '16px 28px' }}
          >
            View Your Report
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

export default function SubscribeSuccessPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen flex items-center justify-center" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <Suspense fallback={
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-[var(--green)]" style={{ margin: '0 auto' }} />
            </div>
          }>
            <SuccessContent />
          </Suspense>
        </div>
      </main>
    </>
  )
}
