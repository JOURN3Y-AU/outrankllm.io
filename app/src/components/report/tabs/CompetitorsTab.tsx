'use client'

import { Users, Lock, Sparkles } from 'lucide-react'
import type { Competitor } from '../shared'

export function CompetitorsTab({
  competitors,
  onUpgradeClick,
  isSubscriber = false
}: {
  competitors: Competitor[]
  onUpgradeClick: () => void
  isSubscriber?: boolean
}) {
  if (!competitors || competitors.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Users size={48} className="mx-auto mb-4 opacity-30" />
        <p>No competitors detected in AI responses</p>
      </div>
    )
  }

  // Show first competitor fully, mask the rest
  const [firstCompetitor, ...otherCompetitors] = competitors

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Users size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Competitor Analysis:</strong> These are businesses that AI assistants mentioned when answering questions relevant to your industry. Understanding who AI recommends helps identify what signals you need to compete for visibility.
            </p>
          </div>
        </div>
      </div>

      {/* First competitor - fully visible */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Top Competitor Mentioned
        </h3>

        <div className="flex items-center justify-between" style={{ gap: '16px' }}>
          <div className="flex items-center" style={{ gap: '16px' }}>
            <div
              className="font-mono font-bold text-[var(--green)]"
              style={{ fontSize: '24px', width: '40px' }}
            >
              #1
            </div>
            <div>
              <div className="font-medium text-[var(--text)] text-lg">
                {firstCompetitor.name}
              </div>
              <div className="text-[var(--text-dim)] text-sm font-mono">
                Mentioned {firstCompetitor.count} times by AI
              </div>
            </div>
          </div>
          <div
            className="bg-[var(--green)]/10 border border-[var(--green)]/20 px-4 py-2"
          >
            <span className="font-mono text-[var(--green)] text-lg">{firstCompetitor.count}</span>
            <span className="text-[var(--text-dim)] text-xs ml-2">mentions</span>
          </div>
        </div>
      </div>

      {/* Competitor Comparison - Show full list for subscribers, locked preview for free users */}
      {isSubscriber ? (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            All Competitors ({competitors.length})
          </h3>

          <div style={{ display: 'grid', gap: '12px' }}>
            {competitors.map((competitor, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '16px 20px' }}
              >
                <div className="flex items-center" style={{ gap: '16px' }}>
                  <div
                    className="font-mono font-bold text-[var(--text-dim)]"
                    style={{ fontSize: '16px', width: '32px' }}
                  >
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text)]">
                      {competitor.name}
                    </div>
                    <div className="text-[var(--text-dim)] text-sm font-mono">
                      Mentioned {competitor.count} times
                    </div>
                  </div>
                </div>
                <div
                  className="bg-[var(--surface)] border border-[var(--border)] px-3 py-1"
                >
                  <span className="font-mono text-[var(--text-mid)]">{competitor.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <div>
              <h3
                className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
                style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '4px' }}
              >
                Competitor Comparison
              </h3>
              <p className="text-[var(--text-ghost)] text-xs">
                {otherCompetitors.length + 1} competitors detected in AI responses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--gold)' }} />
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--gold)' }}
              >
                Subscribers Only
              </span>
            </div>
          </div>

          {/* Mocked Comparison Chart - Bright and visible */}
          <div
            className="relative"
            style={{ height: '280px', backgroundColor: 'var(--surface-elevated)', padding: '20px' }}
          >
            {/* Fake bar chart showing competitor mentions */}
            <svg
              viewBox="0 0 400 220"
              className="w-full h-full"
            >
              {/* Y-axis labels */}
              <text x="8" y="30" fontSize="11" fill="#888">100%</text>
              <text x="8" y="85" fontSize="11" fill="#888">75%</text>
              <text x="8" y="140" fontSize="11" fill="#888">50%</text>
              <text x="8" y="195" fontSize="11" fill="#888">25%</text>

              {/* Grid lines - visible */}
              {[30, 85, 140, 195].map((y) => (
                <line
                  key={y}
                  x1="45"
                  y1={y}
                  x2="380"
                  y2={y}
                  stroke="#333"
                  strokeWidth="1"
                />
              ))}

              {/* Competitor bars - BRIGHT with gradients */}
              {/* #1 Competitor - Highest */}
              <rect x="60" y="40" width="50" height="160" fill="#ef4444" rx="4" />
              <text x="85" y="35" fontSize="10" fill="#ef4444" textAnchor="middle" fontWeight="bold">72%</text>

              {/* #2 Competitor */}
              <rect x="130" y="70" width="50" height="130" fill="#f59e0b" rx="4" />
              <text x="155" y="65" fontSize="10" fill="#f59e0b" textAnchor="middle">58%</text>

              {/* #3 Competitor */}
              <rect x="200" y="95" width="50" height="105" fill="#8b5cf6" rx="4" />
              <text x="225" y="90" fontSize="10" fill="#8b5cf6" textAnchor="middle">47%</text>

              {/* #4 Competitor */}
              <rect x="270" y="130" width="50" height="70" fill="#6b7280" rx="4" />
              <text x="295" y="125" fontSize="10" fill="#6b7280" textAnchor="middle">31%</text>

              {/* You - Highlighted */}
              <rect x="340" y="155" width="50" height="45" fill="#22c55e" rx="4" />
              <text x="365" y="150" fontSize="10" fill="#22c55e" textAnchor="middle" fontWeight="bold">20%</text>

              {/* X-axis labels */}
              <text x="85" y="215" fontSize="11" fill="#888" textAnchor="middle">#1</text>
              <text x="155" y="215" fontSize="11" fill="#888" textAnchor="middle">#2</text>
              <text x="225" y="215" fontSize="11" fill="#888" textAnchor="middle">#3</text>
              <text x="295" y="215" fontSize="11" fill="#888" textAnchor="middle">#4</text>
              <text x="365" y="215" fontSize="11" fill="#22c55e" textAnchor="middle" fontWeight="bold">You</text>
            </svg>

            {/* Frosted overlay - lighter to show chart */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.7) 100%)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  marginBottom: '16px',
                }}
              >
                <Users size={24} style={{ color: 'var(--bg)' }} />
              </div>
              <p className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
                See All {otherCompetitors.length + 1} Competitors
              </p>
              <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '320px', marginBottom: '20px' }}>
                Compare your AI visibility against competitors and track changes over time
              </p>
              <button
                onClick={onUpgradeClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                Unlock Competitor Intel
              </button>
            </div>
          </div>

          {/* Preview of blurred competitor names */}
          <div className="flex flex-wrap gap-3" style={{ marginTop: '20px', opacity: 0.4 }}>
            {otherCompetitors.slice(0, 4).map((_, index) => (
              <span
                key={index}
                className="font-mono text-xs text-[var(--text-ghost)] bg-[var(--surface-elevated)] px-3 py-1"
                style={{ filter: 'blur(3px)' }}
              >
                Competitor {String.fromCharCode(65 + index)}
              </span>
            ))}
            {otherCompetitors.length > 4 && (
              <span className="font-mono text-xs text-[var(--text-ghost)]">
                +{otherCompetitors.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Why competitors matter */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why Competitors Matter
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          These are businesses that AI assistants mention when users ask questions relevant to your
          industry. Understanding who AI recommends instead of you helps identify what content and
          authority signals you need to compete for AI visibility.
        </p>
      </div>
    </div>
  )
}
