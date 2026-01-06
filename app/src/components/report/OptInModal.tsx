'use client'

import { useState } from 'react'
import { X, Gift } from 'lucide-react'

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
      <div className="modal-content">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[var(--green-glow)] flex items-center justify-center">
            <Gift className="w-8 h-8 text-[var(--green)]" />
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-medium text-center mb-2">
          You&apos;re almost there!
        </h2>

        {/* Subhead */}
        <p className="text-[var(--text-mid)] text-center mb-6">
          Want to improve your AI visibility? We&apos;re offering early
          supporters a special deal on our first month of monitoring.
        </p>

        {/* Email display */}
        <div className="bg-[var(--surface-elevated)] border border-[var(--border)] p-3 mb-4">
          <p className="font-mono text-sm text-[var(--text-dim)] mb-1">
            Your email
          </p>
          <p className="font-mono text-sm">{email}</p>
        </div>

        {/* Opt-in checkbox */}
        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[var(--green)]"
          />
          <span className="text-sm text-[var(--text-mid)]">
            Yes, send me updates about outrankllm including product news,
            special offers, and tips to improve my AI visibility.
          </span>
        </label>

        {/* CTA buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="form-button w-full text-center"
          >
            {isSubmitting ? 'Saving...' : optIn ? 'Claim My Spot →' : 'Continue to Report →'}
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] text-sm hover:text-[var(--text)] transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  )
}
