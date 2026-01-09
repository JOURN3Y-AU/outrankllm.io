'use client'

import { useState } from 'react'
import { X, Bell } from 'lucide-react'

interface OptInModalProps {
  email: string
  onClose: () => void
  onOptIn: (optedIn: boolean) => void
}

export function OptInModal({ email, onClose, onOptIn }: OptInModalProps) {
  const [optIn, setOptIn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    // Call API to update opt-in status
    try {
      await fetch('/api/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, optIn }),
      })
    } catch (error) {
      console.error('Failed to save opt-in preference:', error)
    }

    onOptIn(optIn)
    onClose()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content" style={{ padding: '40px 32px' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          style={{ top: '16px', right: '16px' }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center" style={{ marginBottom: '24px' }}>
          <div
            className="rounded-full bg-[var(--green-glow)] flex items-center justify-center"
            style={{ width: '64px', height: '64px' }}
          >
            <Bell className="w-7 h-7 text-[var(--green)]" />
          </div>
        </div>

        {/* Headline */}
        <h2
          className="font-medium text-center text-[var(--text)]"
          style={{ fontSize: '1.375rem', marginBottom: '12px' }}
        >
          Stay Ahead of the Curve
        </h2>

        {/* Subhead */}
        <p
          className="text-[var(--text-mid)] text-center"
          style={{ lineHeight: '1.6', marginBottom: '28px' }}
        >
          Get notified when AI search algorithms change and learn what it means for your visibility.
        </p>

        {/* Email display */}
        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '14px 16px', marginBottom: '20px' }}
        >
          <p
            className="font-mono text-[var(--text-dim)]"
            style={{ fontSize: '12px', marginBottom: '4px' }}
          >
            Your email
          </p>
          <p className="font-mono text-sm text-[var(--text)]">{email}</p>
        </div>

        {/* Opt-in checkbox */}
        <label
          className="flex items-start cursor-pointer"
          style={{ gap: '12px', marginBottom: '28px' }}
        >
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="w-4 h-4 accent-[var(--green)] flex-shrink-0"
            style={{ marginTop: '2px' }}
          />
          <span className="text-sm text-[var(--text-mid)]" style={{ lineHeight: '1.5' }}>
            Yes, send me AI visibility updates, algorithm changes, and tips to improve my rankings.
          </span>
        </label>

        {/* CTA buttons */}
        <div className="flex flex-col" style={{ gap: '12px' }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="form-button w-full text-center"
          >
            {isSubmitting ? 'Saving...' : 'Continue to Report'}
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] text-sm hover:text-[var(--text)] transition-colors"
            style={{ padding: '8px' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  )
}
