'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, CheckCircle, Loader2, X } from 'lucide-react'

interface RescanSectionProps {
  domainSubscriptionId: string
  isSubscriber: boolean
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return ''
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function RescanSection({ domainSubscriptionId, isSubscriber }: RescanSectionProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'triggering' | 'triggered' | 'cooldown' | 'in_progress' | 'error'>('loading')
  const [cooldownEndsAt, setCooldownEndsAt] = useState<Date | null>(null)
  const [countdownDisplay, setCountdownDisplay] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/rescan/status?domain_subscription_id=${domainSubscriptionId}`)
      if (!res.ok) {
        setStatus('error')
        setErrorMessage('Could not check rescan availability')
        return
      }
      const data = await res.json()

      if (data.scanInProgress) {
        setStatus('in_progress')
      } else if (data.cooldownEndsAt) {
        setStatus('cooldown')
        setCooldownEndsAt(new Date(data.cooldownEndsAt))
      } else if (data.canRescan) {
        setStatus('ready')
      } else {
        setStatus('error')
        setErrorMessage(data.reason || 'Cannot rescan at this time')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Could not check rescan availability')
    }
  }, [domainSubscriptionId])

  useEffect(() => {
    if (!isSubscriber || !domainSubscriptionId) return
    checkStatus()
  }, [isSubscriber, domainSubscriptionId, checkStatus])

  // Cooldown countdown timer
  useEffect(() => {
    if (status !== 'cooldown' || !cooldownEndsAt) return

    const update = () => {
      const remaining = cooldownEndsAt.getTime() - Date.now()
      if (remaining <= 0) {
        setStatus('ready')
        setCooldownEndsAt(null)
        setCountdownDisplay('')
      } else {
        setCountdownDisplay(formatCountdown(remaining))
      }
    }

    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [status, cooldownEndsAt])

  const handleRescan = async () => {
    setStatus('triggering')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainSubscriptionId }),
      })

      if (res.ok) {
        setStatus('triggered')
      } else if (res.status === 429) {
        const data = await res.json()
        setStatus('cooldown')
        setCooldownEndsAt(new Date(data.cooldownEndsAt))
      } else if (res.status === 409) {
        setStatus('in_progress')
      } else {
        const data = await res.json()
        setStatus('error')
        setErrorMessage(data.error || 'Failed to trigger rescan')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please try again.')
    }
  }

  if (!isSubscriber || !domainSubscriptionId) return null
  if (status === 'loading') return null
  if (dismissed) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          maxWidth: '960px',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '12px 24px',
        }}
      >
        {/* Left side: icon + message */}
        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
          {status === 'ready' && (
            <>
              <RotateCcw size={16} className="text-[var(--green)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-mid)] truncate">
                Changes saved. Rescan to see their impact on your AI visibility.
              </span>
            </>
          )}

          {status === 'triggering' && (
            <>
              <Loader2 size={16} className="animate-spin text-[var(--green)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-mid)]">Triggering rescan...</span>
            </>
          )}

          {status === 'triggered' && (
            <>
              <CheckCircle size={16} className="text-[var(--green)] flex-shrink-0" />
              <span className="text-sm text-[var(--green)]">
                Rescan triggered! You&apos;ll receive an email when your updated report is ready.
              </span>
            </>
          )}

          {status === 'in_progress' && (
            <>
              <Loader2 size={16} className="animate-spin text-[var(--green)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-mid)]">
                Scan in progress... You&apos;ll receive an email when ready.
              </span>
            </>
          )}

          {status === 'cooldown' && (
            <>
              <RotateCcw size={16} className="text-[var(--text-dim)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-dim)]">
                Next rescan available{countdownDisplay ? ` in ${countdownDisplay}` : ' soon'}
              </span>
            </>
          )}

          {status === 'error' && (
            <>
              <RotateCcw size={16} className="text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{errorMessage}</span>
            </>
          )}
        </div>

        {/* Right side: action button + dismiss */}
        <div className="flex items-center gap-3 flex-shrink-0" style={{ marginLeft: '16px' }}>
          {status === 'ready' && (
            <button
              onClick={handleRescan}
              className="flex items-center gap-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm transition-all hover:opacity-90"
              style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
            >
              <RotateCcw size={14} />
              Rescan Now
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={checkStatus}
              className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              style={{ textDecoration: 'underline', textUnderlineOffset: '3px', whiteSpace: 'nowrap' }}
            >
              Try again
            </button>
          )}

          {(status === 'triggered' || status === 'in_progress' || status === 'cooldown') && (
            <button
              onClick={() => setDismissed(true)}
              className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
