'use client'

import Link from 'next/link'
import { Check, ExternalLink } from 'lucide-react'
import { LocalDate } from '@/components/LocalDate'
import type { SubscriptionReport } from '@/lib/subscriptions'

interface ReportHistoryProps {
  reports: SubscriptionReport[]
}

// Platform display config
const platformConfig: Record<string, { name: string; color: string }> = {
  chatgpt: { name: 'GPT', color: '#ef4444' },
  perplexity: { name: 'Perp', color: '#1FB8CD' },
  gemini: { name: 'Gem', color: '#3b82f6' },
  claude: { name: 'Claude', color: '#22c55e' },
}

const QUESTIONS_PER_PLATFORM = 7

export function ReportHistory({ reports }: ReportHistoryProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '24px' }}>
        <p>No reports yet. Your first scan will appear here.</p>
      </div>
    )
  }

  return (
    <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
      {reports.map((report, index) => {
        const isLatest = index === 0

        return (
          <Link
            key={report.id}
            href={`/report/${report.url_token}`}
            className={`flex items-center justify-between transition-colors ${
              isLatest
                ? 'bg-[var(--green)]/5 hover:bg-[var(--green)]/10'
                : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
            }`}
            style={{ padding: '12px 16px' }}
          >
            <div className="flex items-center gap-3">
              {/* Current indicator */}
              {isLatest && (
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--green)',
                  }}
                  title="Latest report"
                >
                  <Check className="w-3 h-3 text-[var(--bg)]" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
                  <LocalDate date={report.created_at} className="text-sm font-medium" />
                  {isLatest && (
                    <span className="font-mono text-xs text-[var(--green)] uppercase">
                      Latest
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--text-dim)]">
                  Score: {report.visibility_score !== null ? `${report.visibility_score}%` : '—'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Platform mention scores */}
              {report.platform_scores && (
                <div className="flex items-center gap-3">
                  {Object.entries(platformConfig).map(([platform, config]) => {
                    const score = report.platform_scores?.[platform]
                    if (score === undefined) return null
                    const mentions = Math.round((score / 100) * QUESTIONS_PER_PLATFORM)
                    return (
                      <div
                        key={platform}
                        className="flex items-center gap-1 font-mono text-xs"
                        title={`${config.name}: ${mentions}/${QUESTIONS_PER_PLATFORM} mentions`}
                      >
                        <span style={{ color: config.color }}>{config.name}</span>
                        <span className="text-[var(--text-dim)]">{mentions}/{QUESTIONS_PER_PLATFORM}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <ExternalLink className="w-4 h-4 text-[var(--text-dim)]" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
