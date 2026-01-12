'use client'

import { useState, useEffect } from 'react'
import { X, Globe, Check, Loader2, ArrowRight } from 'lucide-react'
import { TIER_PRICES, CURRENCY_SYMBOL, type PricingRegion } from '@/lib/stripe-config'

interface AddDomainModalProps {
  isOpen: boolean
  onClose: () => void
  region: PricingRegion
}

type SelectedTier = 'starter' | 'pro'

const tierFeatures: Record<SelectedTier, string[]> = {
  starter: ['Weekly scans', 'AI Readiness checks', 'Action Plans', 'Email alerts'],
  pro: [
    'Everything in Starter',
    'Competitor analysis',
    'Brand awareness tracking',
    'PRD generation',
  ],
}

export function AddDomainModal({ isOpen, onClose, region }: AddDomainModalProps) {
  const [domain, setDomain] = useState('')
  const [selectedTier, setSelectedTier] = useState<SelectedTier>('pro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDomain('')
      setSelectedTier('pro')
      setError(null)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) {
      setError('Please enter a domain')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.trim(),
          tier: selectedTier,
          region,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currencySymbol = CURRENCY_SYMBOL[region]
  const starterPrice = TIER_PRICES[region].starter
  const proPrice = TIER_PRICES[region].pro

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] border border-[var(--border)] shadow-xl w-full"
        style={{ maxWidth: '500px', margin: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-[var(--border)]"
          style={{ padding: '16px 20px' }}
        >
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-[var(--green)]" />
            <h2 className="text-lg font-medium">Monitor a New Domain</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            {/* Domain Input */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm text-[var(--text-dim)]" style={{ marginBottom: '8px' }}>
                Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono focus:border-[var(--green)] focus:outline-none transition-colors"
                style={{ padding: '12px' }}
                autoFocus
              />
            </div>

            {/* Tier Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm text-[var(--text-dim)]" style={{ marginBottom: '12px' }}>
                Select Plan
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Starter */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('starter')}
                  className={`text-left border transition-all ${
                    selectedTier === 'starter'
                      ? 'border-[var(--green)] bg-[var(--green)]/5'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-dim)]'
                  }`}
                  style={{ padding: '16px' }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <span className="font-medium">Starter</span>
                    {selectedTier === 'starter' && (
                      <Check className="w-4 h-4 text-[var(--green)]" />
                    )}
                  </div>
                  <div className="text-xl font-medium" style={{ marginBottom: '12px' }}>
                    {currencySymbol}{starterPrice}
                    <span className="text-sm text-[var(--text-dim)] font-normal">/mo</span>
                  </div>
                  <ul className="text-xs text-[var(--text-mid)]" style={{ lineHeight: '1.6' }}>
                    {tierFeatures.starter.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="text-[var(--green)]">+</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Pro */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('pro')}
                  className={`text-left border transition-all relative ${
                    selectedTier === 'pro'
                      ? 'border-[var(--gold)] bg-[var(--gold)]/5'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-dim)]'
                  }`}
                  style={{ padding: '16px' }}
                >
                  {/* Recommended badge */}
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[var(--gold)] text-[var(--bg)] font-mono text-xs uppercase px-2 py-0.5"
                  >
                    Recommended
                  </div>

                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <span className="font-medium">Pro</span>
                    {selectedTier === 'pro' && (
                      <Check className="w-4 h-4 text-[var(--gold)]" />
                    )}
                  </div>
                  <div className="text-xl font-medium" style={{ marginBottom: '12px' }}>
                    {currencySymbol}{proPrice}
                    <span className="text-sm text-[var(--text-dim)] font-normal">/mo</span>
                  </div>
                  <ul className="text-xs text-[var(--text-mid)]" style={{ lineHeight: '1.6' }}>
                    {tierFeatures.pro.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="text-[var(--gold)]">+</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="text-sm text-red-500 bg-red-500/10 border border-red-500/20"
                style={{ padding: '12px', marginBottom: '16px' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 border-t border-[var(--border)]"
            style={{ padding: '16px 20px' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              style={{ padding: '10px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="flex items-center gap-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '10px 20px' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Checkout
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
