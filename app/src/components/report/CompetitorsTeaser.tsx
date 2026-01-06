'use client'

import { Lock, Sparkles } from 'lucide-react'

interface Competitor {
  name: string
  count: number
}

interface CompetitorsTeaserProps {
  competitors: Competitor[]
  showAll?: boolean // If true, show all competitors (paid tier)
  onUpgradeClick?: () => void
}

export function CompetitorsTeaser({
  competitors,
  showAll = false,
  onUpgradeClick
}: CompetitorsTeaserProps) {
  if (competitors.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Competitors Mentioned</h3>
        <p className="text-[var(--text-dim)] font-mono text-sm">
          No competitors were mentioned in AI responses. Good news - you have less competition!
        </p>
      </div>
    )
  }

  // If showAll is true, render all competitors without blur
  if (showAll) {
    return (
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Competitors Mentioned</h3>
        <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
          These brands are being recommended by AI instead of you:
        </p>

        <div className="space-y-2">
          {competitors.map((competitor, index) => (
            <div
              key={competitor.name}
              className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-dim)] font-mono text-xs w-5">
                  {index + 1}.
                </span>
                <span className="font-mono text-sm">{competitor.name}</span>
              </div>
              <span className="text-[var(--text-dim)] font-mono text-xs">
                {competitor.count} mention{competitor.count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Free tier: show first competitor, blur the rest
  const firstCompetitor = competitors[0]
  const hiddenCompetitors = competitors.slice(1)
  const hiddenCount = hiddenCompetitors.length

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4">Competitors Mentioned</h3>
      <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
        These brands are being recommended by AI instead of you:
      </p>

      <div className="space-y-2">
        {/* First competitor - fully visible */}
        <div
          className="flex items-center justify-between py-2 border-b border-[var(--border)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--green)] font-mono text-xs w-5">
              1.
            </span>
            <span className="font-mono text-sm text-[var(--text)]">{firstCompetitor.name}</span>
          </div>
          <span className="text-[var(--text-dim)] font-mono text-xs">
            {firstCompetitor.count} mention{firstCompetitor.count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Hidden competitors - blurred */}
        {hiddenCount > 0 && (
          <div className="relative">
            {/* Blurred competitor list */}
            <div className="space-y-2 select-none" style={{ filter: 'blur(6px)' }}>
              {hiddenCompetitors.slice(0, 4).map((competitor, index) => (
                <div
                  key={competitor.name}
                  className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-dim)] font-mono text-xs w-5">
                      {index + 2}.
                    </span>
                    <span className="font-mono text-sm">{competitor.name}</span>
                  </div>
                  <span className="text-[var(--text-dim)] font-mono text-xs">
                    {competitor.count} mentions
                  </span>
                </div>
              ))}
            </div>

            {/* Overlay with upgrade CTA */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, var(--surface) 40%)'
              }}
            >
              <div className="text-center p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lock size={16} className="text-[var(--amber)]" />
                  <span className="font-mono text-sm text-[var(--text-mid)]">
                    +{hiddenCount} more competitor{hiddenCount !== 1 ? 's' : ''} hidden
                  </span>
                </div>

                <button
                  onClick={onUpgradeClick}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm font-medium rounded hover:opacity-90 transition-opacity"
                >
                  <Sparkles size={14} />
                  Unlock all competitors
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teaser note */}
      <div
        className="mt-4 p-3 bg-[var(--green)]/5 border border-[var(--green)]/20 rounded text-xs text-[var(--text-mid)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <strong className="text-[var(--green)]">Pro tip:</strong> Knowing your competitors helps you optimize your content to stand out in AI recommendations.
      </div>
    </div>
  )
}
