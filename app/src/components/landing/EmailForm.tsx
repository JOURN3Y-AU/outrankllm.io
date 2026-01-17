'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight } from 'lucide-react'
import { ScanProgressModal } from './ScanProgressModal'
import { useSession } from '@/lib/auth-client'
import Link from 'next/link'

import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackLinkedInConversion, LINKEDIN_CONVERSIONS } from '@/lib/linkedin'

interface EmailFormProps {
  onSuccess?: (data: { email: string; domain: string; scanId: string }) => void
}

interface UserReport {
  domain: string
  tier: string
  reportToken: string | null
}

export function EmailForm({ onSuccess }: EmailFormProps) {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [cleanedDomain, setCleanedDomain] = useState('')
  const [userReport, setUserReport] = useState<UserReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [freeReportUsed, setFreeReportUsed] = useState<{
    existingDomain: string
    reportToken: string
    isExpired: boolean
  } | null>(null)

  // Fetch user's report when logged in
  useEffect(() => {
    if (session && !sessionLoading) {
      setLoadingReport(true)
      fetch('/api/user/report')
        .then(res => res.json())
        .then(data => {
          // Set userReport even if no reportToken - we need domain/tier info
          if (data.domain) {
            setUserReport(data)
          }
        })
        .catch(() => {
          // Ignore errors - just show regular form
        })
        .finally(() => setLoadingReport(false))
    }
  }, [session, sessionLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    // Clean domain (remove protocol if present)
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/$/, '')
    setCleanedDomain(cleanDomain)

    // Track button click
    trackEvent(ANALYTICS_EVENTS.GET_FREE_REPORT_CLICK, {
      user_type: session ? 'logged_in' : 'anonymous',
      user_tier: session?.tier || 'none',
    })

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session ? session.email : email.trim(),
          domain: cleanDomain,
          agreedToTerms,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      // Check if user already has a free report for this domain
      if (data.alreadyScanned) {
        // Redirect to report with locked flag (free users see locked modal)
        if (data.isSubscriber) {
          // Subscribers go directly to their report
          router.push(`/report/${data.reportToken}`)
        } else {
          // Free users see locked modal over frosted report
          router.push(`/report/${data.reportToken}?locked=true`)
        }
        return
      }

      // Check if user has already used their one free report on a different domain
      if (data.freeReportUsed) {
        setStatus('idle')
        setFreeReportUsed({
          existingDomain: data.existingDomain,
          reportToken: data.reportToken,
          isExpired: data.isExpired || false,
        })
        return
      }

      // Check if user already has a scan in progress
      if (data.scanInProgress) {
        // Show the progress modal for their existing scan
        setScanId(data.scanId)
        setShowModal(true)
        setStatus('success')
        return
      }

      setScanId(data.scanId)
      setShowModal(true)
      setStatus('success')

      // Track successful scan submission (form completed, not just clicked)
      trackEvent(ANALYTICS_EVENTS.SCAN_SUBMITTED, {
        user_type: session ? 'logged_in' : 'anonymous',
        user_tier: session?.tier || 'none',
        domain: cleanDomain,
      })

      // Track LinkedIn conversion for free report signup
      trackLinkedInConversion(LINKEDIN_CONVERSIONS.FREE_REPORT_SIGNUP)

      onSuccess?.({ email: session ? session.email : email.trim(), domain: cleanDomain, scanId: data.scanId })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    // Reset form for another scan
    setEmail('')
    setDomain('')
    setStatus('idle')
    setScanId(null)
  }

  // Show loading state while checking session
  if (sessionLoading || loadingReport) {
    return (
      <div className="w-full flex justify-center" style={{ padding: '24px 0' }}>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-dim)]" />
      </div>
    )
  }

  // Logged-in Starter/Pro/Free users with a report: Show "View Your Report" CTA
  // (Agency users can scan multiple domains, so they see the form instead)
  if (session && userReport && session.tier !== 'agency') {
    return (
      <div className="w-full">
        <div
          className="bg-[var(--surface)] border border-[var(--border)]"
          style={{ padding: '24px', textAlign: 'center' }}
        >
          <p className="text-[var(--text-mid)] text-sm" style={{ marginBottom: '8px' }}>
            Welcome back!
          </p>
          <p className="font-mono text-[var(--green)]" style={{ marginBottom: '16px' }}>
            {userReport.domain}
          </p>
          {userReport.reportToken ? (
            <Link
              href={`/report/${userReport.reportToken}`}
              className="form-button inline-flex items-center justify-center gap-2"
              style={{ width: '100%' }}
            >
              View Your Report
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <p className="text-[var(--text-dim)] text-sm">
              Your report is being generated...
            </p>
          )}
          <Link
            href="/dashboard"
            className="inline-block text-[var(--text-dim)] text-sm hover:text-[var(--text)] transition-colors"
            style={{ marginTop: '12px' }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Logged-in Agency users: Show form + existing domains
  // Agency users can scan new domains

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="form-container">
        <input
          type="email"
          placeholder="your work email"
          value={session ? session.email : email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'loading' || !!session}
          className="form-input"
          style={session ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
        />
        <input
          type="text"
          placeholder="your company website (e.g. acme.com)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
          disabled={status === 'loading'}
          className="form-input"
        />
        <label className="flex items-start gap-3 cursor-pointer" style={{ padding: '8px 0' }}>
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            disabled={status === 'loading'}
            className="mt-1 w-4 h-4 accent-[var(--green)] cursor-pointer"
            style={{ flexShrink: 0 }}
          />
          <span className="text-xs text-[var(--text-dim)]">
            I agree to the{' '}
            <Link
              href="/terms"
              target="_blank"
              className="text-[var(--green)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms & Conditions
            </Link>
          </span>
        </label>
        <button
          type="submit"
          disabled={status === 'loading' || !agreedToTerms}
          className="form-button flex items-center justify-center gap-2"
          title={!agreedToTerms ? 'Please agree to the Terms & Conditions' : undefined}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : session?.tier === 'agency' ? (
            'Scan New Domain →'
          ) : (
            'Get Free Report →'
          )}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-[var(--red)] font-mono text-sm text-center">
          {error}
        </p>
      )}

      {freeReportUsed && (
        <div
          className="bg-[var(--surface)] border border-[var(--border)]"
          style={{ marginTop: '16px', padding: '20px', textAlign: 'center' }}
        >
          <p className="text-[var(--text)] text-sm" style={{ marginBottom: '8px' }}>
            {freeReportUsed.isExpired
              ? 'Your free report has expired:'
              : "You've already used your free report for:"}
          </p>
          <p className="font-mono text-[var(--green)]" style={{ marginBottom: '16px' }}>
            {freeReportUsed.existingDomain}
          </p>
          <p className="text-[var(--text-dim)] text-xs" style={{ marginBottom: '16px' }}>
            {freeReportUsed.isExpired
              ? 'Subscribe to unlock your report and add more domains with weekly updates and action plans.'
              : 'Subscribe to monitor multiple domains with weekly updates, action plans, and competitive insights.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/pricing"
              className="form-button inline-flex items-center justify-center gap-2"
            >
              {freeReportUsed.isExpired ? 'Unlock Your Report' : 'See Subscription Plans'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/report/${freeReportUsed.reportToken}`}
              className="text-[var(--text-dim)] text-sm hover:text-[var(--text)] transition-colors"
            >
              {freeReportUsed.isExpired ? 'View expired report' : 'View your existing report'}
            </Link>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {scanId && (
        <ScanProgressModal
          scanId={scanId}
          domain={cleanedDomain}
          email={session ? session.email : email.trim()}
          isOpen={showModal}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
