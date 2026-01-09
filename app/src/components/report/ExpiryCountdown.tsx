'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface ExpiryCountdownProps {
  expiresAt: string | null
  onUpgradeClick: () => void
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(expiresAt: string): TimeLeft {
  const difference = new Date(expiresAt).getTime() - Date.now()

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  }
}

export function ExpiryCountdown({ expiresAt, onUpgradeClick }: ExpiryCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (!expiresAt) return

    // Initial calculation
    setTimeLeft(calculateTimeLeft(expiresAt))

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(expiresAt))
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt])

  // Don't render anything if no expiry or not mounted (avoid hydration mismatch)
  if (!expiresAt || !mounted || timeLeft === null) {
    return null
  }

  // Report has expired
  if (timeLeft.total <= 0) {
    return (
      <div
        className="border border-red-500/50 bg-red-500/10"
        style={{ padding: '16px 20px', marginBottom: '24px' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-400">This report has expired</p>
              <p className="text-sm text-red-400/70">Subscribe to restore access and get weekly updates</p>
            </div>
          </div>
          <button
            onClick={onUpgradeClick}
            className="bg-red-500 text-white font-mono text-sm hover:bg-red-600 transition-colors whitespace-nowrap"
            style={{ padding: '10px 20px' }}
          >
            Subscribe Now
          </button>
        </div>
      </div>
    )
  }

  // Determine urgency level
  // Urgent (red): less than 12 hours remaining
  // Warning (yellow): less than 24 hours but more than 12 hours
  // Normal (subtle): more than 24 hours
  const hoursRemaining = timeLeft.total / (1000 * 60 * 60)
  const isUrgent = hoursRemaining < 12
  const isWarning = hoursRemaining < 24 && !isUrgent

  return (
    <div
      className={`border ${
        isUrgent
          ? 'border-red-500/50 bg-red-500/5'
          : isWarning
          ? 'border-yellow-500/50 bg-yellow-500/5'
          : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
      style={{ padding: '16px 20px', marginBottom: '24px' }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Clock
            className={`w-5 h-5 flex-shrink-0 ${
              isUrgent ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-[var(--text-dim)]'
            }`}
          />
          <div>
            <p
              className={`font-mono text-sm ${
                isUrgent ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-[var(--text-mid)]'
              }`}
            >
              Report expires in
            </p>
            <div className="flex items-center gap-2 font-mono">
              {timeLeft.days > 0 && (
                <>
                  <span className="text-lg font-medium">{timeLeft.days}</span>
                  <span className="text-xs text-[var(--text-dim)]">days</span>
                </>
              )}
              <span className="text-lg font-medium">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-xs text-[var(--text-dim)]">hrs</span>
              <span className="text-lg font-medium">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-xs text-[var(--text-dim)]">min</span>
              {timeLeft.days === 0 && (
                <>
                  <span className="text-lg font-medium">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="text-xs text-[var(--text-dim)]">sec</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onUpgradeClick}
          className={`font-mono text-sm whitespace-nowrap transition-colors ${
            isUrgent
              ? 'bg-red-500 text-white hover:bg-red-600'
              : isWarning
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'bg-[var(--green)] text-[var(--bg)] hover:opacity-90'
          }`}
          style={{ padding: '10px 20px' }}
        >
          Subscribe to Keep Access
        </button>
      </div>
    </div>
  )
}
