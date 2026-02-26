'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, CheckCircle, Loader2 } from 'lucide-react'

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

  return (
    <div
      className="border border-[var(--border)] bg-[var(--surface)]"
      style={{ padding: '24px', marginTop: '24px' }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
        <RotateCcw size={16} className="text-[var(--green)]" />
        <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider">
          Rescan Now
        </span>
      </div>

      {status === 'ready' && (
        <>
          <p className="text-sm text-[var(--text-mid)]" style={{ marginBottom: '16px' }}>
            Your changes are saved automatically. Trigger a new scan to see their impact on your AI visibility.
          </p>
          <button
            onClick={handleRescan}
            className="flex items-center gap-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm transition-all hover:opacity-90"
            style={{ padding: '10px 20px' }}
          >
            <RotateCcw size={14} />
            Rescan Now
          </button>
        </>
      )}

      {status === 'triggering' && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-mid)]">
          <Loader2 size={16} className="animate-spin text-[var(--green)]" />
          Triggering rescan...
        </div>
      )}

      {status === 'triggered' && (
        <div className="flex items-center gap-2 text-sm text-[var(--green)]">
          <CheckCircle size={16} />
          Rescan triggered! You&apos;ll receive an email when your updated report is ready.
        </div>
      )}

      {status === 'in_progress' && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-mid)]">
          <Loader2 size={16} className="animate-spin text-[var(--green)]" />
          Scan in progress... You&apos;ll receive an email when your updated report is ready.
        </div>
      )}

      {status === 'cooldown' && (
        <>
          <p className="text-sm text-[var(--text-mid)]" style={{ marginBottom: '16px' }}>
            Your changes are saved automatically. Trigger a new scan to see their impact on your AI visibility.
          </p>
          <button
            disabled
            className="flex items-center gap-2 bg-[var(--surface)] text-[var(--text-dim)] font-mono text-sm border border-[var(--border)] cursor-not-allowed"
            style={{ padding: '10px 20px', opacity: 0.6 }}
          >
            <RotateCcw size={14} />
            Rescan Now
          </button>
          {countdownDisplay && (
            <p className="text-xs text-[var(--text-dim)] font-mono" style={{ marginTop: '8px' }}>
              Next rescan available in {countdownDisplay}
            </p>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <p className="text-sm text-red-400" style={{ marginBottom: '12px' }}>
            {errorMessage}
          </p>
          <button
            onClick={checkStatus}
            className="text-xs font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Try again
          </button>
        </>
      )}
    </div>
  )
}
