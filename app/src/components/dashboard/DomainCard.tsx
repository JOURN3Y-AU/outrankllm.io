'use client'

import { Globe, ExternalLink } from 'lucide-react'
import type { SubscriptionTier } from '@/lib/stripe-config'

interface DomainCardProps {
  domain: string
  tier: SubscriptionTier
  status: string
  isSelected: boolean
  onClick: () => void
}

const tierColors: Record<SubscriptionTier, { bg: string; text: string; border: string }> = {
  starter: {
    bg: 'var(--green)',
    text: 'var(--bg)',
    border: 'var(--green)',
  },
  pro: {
    bg: 'var(--gold)',
    text: 'var(--bg)',
    border: 'var(--gold)',
  },
  agency: {
    bg: 'var(--text)',
    text: 'var(--bg)',
    border: 'var(--text)',
  },
}

export function DomainCard({ domain, tier, status, isSelected, onClick }: DomainCardProps) {
  const colors = tierColors[tier] || tierColors.starter
  const isActive = status === 'active'
  const isCanceling = status === 'active' && false // Will be passed as prop later

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border transition-all ${
        isSelected
          ? 'border-[var(--green)] bg-[var(--green)]/5'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-dim)]'
      }`}
      style={{ padding: '16px 20px' }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-[var(--green)]/20' : 'bg-[var(--surface-hover)]'
          }`}
        >
          <Globe className={`w-5 h-5 ${isSelected ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
            <span className="font-medium truncate">{domain}</span>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {!isActive && (
            <span className="text-xs text-[var(--text-dim)]">
              {status === 'canceled' ? 'Canceled' : status === 'past_due' ? 'Payment due' : status}
            </span>
          )}
        </div>

        <span
          className="font-mono text-xs uppercase tracking-wider px-2 py-1 flex-shrink-0"
          style={{
            background: `${colors.bg}20`,
            color: colors.text === 'var(--bg)' ? colors.bg : colors.text,
            border: `1px solid ${colors.border}40`,
          }}
        >
          {tier}
        </span>
      </div>

      {isSelected && (
        <div
          className="flex items-center gap-1 text-xs text-[var(--green)]"
          style={{ marginTop: '8px', marginLeft: '52px' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
          Selected
        </div>
      )}
    </button>
  )
}
