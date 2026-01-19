'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, ArrowRight } from 'lucide-react'
import { Ghost } from '@/components/ghost/Ghost'
import { ScanProgressModal } from './ScanProgressModal'
import { useSession } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackLinkedInConversion, LINKEDIN_CONVERSIONS } from '@/lib/linkedin'
import { experiments } from '@/lib/experiments/config'

// Helper to read cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

interface ScanFormModalProps {
  isOpen: boolean
  onClose: () => void
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>
}

interface UserReport {
  domain: string
  tier: string
  reportToken: string | null
}

export function ScanFormModal({ isOpen, onClose, triggerButtonRef }: ScanFormModalProps) {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [cleanedDomain, setCleanedDomain] = useState('')
  const [userReport, setUserReport] = useState<UserReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [freeReportUsed, setFreeReportUsed] = useState<{
    existingDomain: string
    reportToken: string
    isExpired: boolean
  } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed')
  const modalRef = useRef<HTMLDivElement>(null)

  // Only render portal on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle animation states
  useEffect(() => {
    if (isOpen && animationState === 'closed') {
      // First set to 'opening' to render with initial styles
      setAnimationState('opening')
      // Use requestAnimationFrame to ensure the browser has painted the initial state
      // before transitioning to 'open' (required for CSS transitions to work)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('open')
        })
      })
    } else if (!isOpen && animationState === 'open') {
      setAnimationState('closing')
    }
  }, [isOpen, animationState])

  // Handle closing animation completion separately to avoid cleanup issues
  useEffect(() => {
    if (animationState === 'closing') {
      const timer = setTimeout(() => setAnimationState('closed'), 300)
      return () => clearTimeout(timer)
    }
  }, [animationState])

  // Fetch user's report when logged in
  useEffect(() => {
    if (session && !sessionLoading && isOpen) {
      setLoadingReport(true)
      fetch('/api/user/report')
        .then(res => res.json())
        .then(data => {
          if (data.domain) {
            setUserReport(data)
          }
        })
        .catch(() => {
          // Ignore errors
        })
        .finally(() => setLoadingReport(false))
    }
  }, [session, sessionLoading, isOpen])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setDomain('')
      setStatus('idle')
      setError(null)
      setFreeReportUsed(null)
      setAgreedToTerms(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    // Clean domain
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/$/, '')
    setCleanedDomain(cleanDomain)

    // Track button click
    trackEvent(ANALYTICS_EVENTS.GET_FREE_REPORT_CLICK, {
      user_type: session ? 'logged_in' : 'anonymous',
      user_tier: session?.tier || 'none',
      source: 'homepage_modal',
    })

    try {
      // Check URL param first (for testing), then fall back to cookie
      const urlParams = new URLSearchParams(window.location.search)
      const homepageVariant = urlParams.get('variant') || getCookie(experiments.homepage.cookieName)

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session ? session.email : email.trim(),
          domain: cleanDomain,
          agreedToTerms,
          homepageVariant,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      // Check if user already has a scan for this domain
      if (data.alreadyScanned) {
        if (data.isSubscriber) {
          router.push(`/report/${data.reportToken}`)
        } else {
          router.push(`/report/${data.reportToken}?locked=true`)
        }
        return
      }

      // Check if user has already used their free report
      if (data.freeReportUsed) {
        setStatus('idle')
        setFreeReportUsed({
          existingDomain: data.existingDomain,
          reportToken: data.reportToken,
          isExpired: data.isExpired || false,
        })
        return
      }

      // Check if scan is in progress
      if (data.scanInProgress) {
        setScanId(data.scanId)
        setShowProgressModal(true)
        setStatus('success')
        return
      }

      setScanId(data.scanId)
      setShowProgressModal(true)
      setStatus('success')

      // Track successful scan submission
      trackEvent(ANALYTICS_EVENTS.SCAN_SUBMITTED, {
        user_type: session ? 'logged_in' : 'anonymous',
        user_tier: session?.tier || 'none',
        domain: cleanDomain,
        source: 'homepage_modal',
      })

      // Track LinkedIn conversion
      trackLinkedInConversion(LINKEDIN_CONVERSIONS.FREE_REPORT_SIGNUP)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleProgressModalClose = () => {
    setShowProgressModal(false)
    onClose()
  }

  // Don't render until mounted (SSR safety) or when closed and not opening
  if (!mounted || (!isOpen && animationState === 'closed')) return null

  // Calculate morph animation styles
  const getModalStyles = () => {
    // Initial state when isOpen becomes true but effect hasn't run yet
    // Also used for 'opening' state - start small and transparent
    if (animationState === 'opening' || (isOpen && animationState === 'closed')) {
      return {
        transform: 'scale(0.8)',
        opacity: 0,
        transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-out',
      }
    }
    if (animationState === 'closing') {
      return {
        transform: 'scale(0.9)',
        opacity: 0,
        transition: 'transform 300ms ease-in, opacity 200ms ease-in',
      }
    }
    return {
      transform: 'scale(1)',
      opacity: 1,
      transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-out',
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        zIndex: 9999,
        pointerEvents: animationState === 'closing' ? 'none' : 'auto',
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        style={{
          zIndex: 9999,
          opacity: animationState === 'opening' || animationState === 'closing' || (isOpen && animationState === 'closed') ? 0 : 1,
          transition: 'opacity 300ms ease-out',
        }}
      />

      {/* Modal Container */}
      <div
        className="relative flex min-h-full items-center justify-center"
        style={{ padding: '24px', zIndex: 10000 }}
      >
        {/* Modal */}
        <div
          ref={modalRef}
          className="relative w-full bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
          style={{
            maxWidth: '420px',
            ...getModalStyles(),
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            style={{ zIndex: 10 }}
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div style={{ padding: '32px 24px' }}>
            {/* Ghost mascot */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <Ghost size="sm" />
            </div>

            {/* Header */}
            <h2
              className="text-[var(--text)] text-center font-medium"
              style={{ fontSize: '1.25rem', marginBottom: '24px' }}
            >
              Let&apos;s see what AI knows about you
            </h2>

            {/* Loading state */}
            {(sessionLoading || loadingReport) && (
              <div className="flex justify-center" style={{ padding: '24px 0' }}>
                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-dim)]" />
              </div>
            )}

            {/* Logged-in user with report */}
            {!sessionLoading && !loadingReport && session && userReport && session.tier !== 'agency' && (
              <div className="text-center">
                <p className="text-[var(--text-mid)] text-sm" style={{ marginBottom: '8px' }}>
                  Welcome back!
                </p>
                <p className="font-mono text-[var(--green)]" style={{ marginBottom: '16px' }}>
                  {userReport.domain}
                </p>
                {userReport.reportToken ? (
                  <Link
                    href={`/report/${userReport.reportToken}`}
                    className="form-button inline-flex items-center justify-center gap-2 w-full"
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
            )}

            {/* Form */}
            {!sessionLoading && !loadingReport && (!session || !userReport || session.tier === 'agency') && !freeReportUsed && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Domain field */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="modal-domain" className="text-[var(--text-mid)] text-xs font-medium text-center">
                    Your website
                  </label>
                  <input
                    id="modal-domain"
                    type="text"
                    placeholder="e.g. google.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="form-input text-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', fontSize: '1rem' }}
                    autoFocus
                  />
                </div>

                {/* Email field */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="modal-email" className="text-[var(--text-mid)] text-xs font-medium text-center">
                    Your email
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    placeholder="you@company.com"
                    value={session ? session.email : email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === 'loading' || !!session}
                    className="form-input text-center"
                    style={session ? { opacity: 0.7, cursor: 'not-allowed' } : { backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                  />
                  <span className="text-[var(--text-dim)] text-[0.65rem] text-center">
                    We&apos;ll send a private link to your report here
                  </span>
                </div>

                {/* Terms checkbox */}
                <label className="flex items-start gap-3 cursor-pointer justify-center" style={{ padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    disabled={status === 'loading'}
                    className="mt-0.5 w-4 h-4 accent-[var(--green)] cursor-pointer"
                    style={{ flexShrink: 0 }}
                  />
                  <span className="text-[0.7rem] text-[var(--text-dim)] leading-tight">
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

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={status === 'loading' || !agreedToTerms}
                  className="form-button flex items-center justify-center gap-2"
                  title={!agreedToTerms ? 'Please agree to the Terms & Conditions' : undefined}
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      Scan Now
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Error message */}
                {error && (
                  <p className="text-[var(--red)] font-mono text-sm text-center">
                    {error}
                  </p>
                )}

                {/* Reassurance */}
                <p className="text-[var(--text-dim)] text-xs text-center font-mono">
                  Free &middot; No credit card &middot; Results emailed in ~10 min
                </p>
              </form>
            )}

            {/* Free report already used */}
            {freeReportUsed && (
              <div className="text-center">
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
                    ? 'Subscribe to unlock your report and add more domains.'
                    : 'Subscribe to monitor multiple domains with weekly updates and action plans.'}
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
          </div>
        </div>
      </div>

      {/* Progress Modal (appears after successful submission) */}
      {scanId && (
        <ScanProgressModal
          scanId={scanId}
          domain={cleanedDomain}
          email={session ? session.email : email.trim()}
          isOpen={showProgressModal}
          onClose={handleProgressModalClose}
        />
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
