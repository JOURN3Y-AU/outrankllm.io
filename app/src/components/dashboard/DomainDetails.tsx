'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Globe,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { ScheduleSettings } from './ScheduleSettings'
import { ReportHistory } from './ReportHistory'
import { SubscriptionActions } from './SubscriptionActions'
import type { DomainSubscriptionWithReports, SubscriptionReport } from '@/lib/subscriptions'
import type { PricingRegion } from '@/lib/stripe-config'

interface DomainDetailsProps {
  subscription: DomainSubscriptionWithReports
  reports: SubscriptionReport[]
  onUpdate: () => void
  region: PricingRegion
}

// Platform display config
const platformConfig: Record<string, { name: string; color: string }> = {
  chatgpt: { name: 'GPT', color: '#ef4444' },
  perplexity: { name: 'Perp', color: '#1FB8CD' },
  gemini: { name: 'Gem', color: '#3b82f6' },
  claude: { name: 'Claude', color: '#22c55e' },
}

const QUESTIONS_PER_PLATFORM = 7

export function DomainDetails({ subscription, reports, onUpdate, region }: DomainDetailsProps) {
  const [expandedSections, setExpandedSections] = useState({
    latestReport: true,
    schedule: false,
    history: false,
    subscription: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const latestReport = subscription.latest_report

  return (
    <div
      className="border border-[var(--border)] bg-[var(--surface)]"
      style={{ marginTop: '24px' }}
    >
      {/* Header */}
      <div
        className="border-b border-[var(--border)] flex items-center justify-between"
        style={{ padding: '16px 20px' }}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-[var(--green)]" />
          <span className="font-medium">{subscription.domain}</span>
          <span
            className="font-mono text-xs uppercase tracking-wider px-2 py-0.5"
            style={{
              background: subscription.tier === 'pro' ? 'var(--gold)20' : 'var(--green)20',
              color: subscription.tier === 'pro' ? 'var(--gold)' : 'var(--green)',
              border: `1px solid ${subscription.tier === 'pro' ? 'var(--gold)' : 'var(--green)'}40`,
            }}
          >
            {subscription.tier}
          </span>
        </div>

        {latestReport && (
          <Link
            href={`/report/${latestReport.url_token}`}
            className="flex items-center gap-2 font-mono text-sm text-[var(--green)] hover:underline"
          >
            View Latest Report
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Latest Report Section */}
      <CollapsibleSection
        title="Latest Report"
        isOpen={expandedSections.latestReport}
        onToggle={() => toggleSection('latestReport')}
      >
        {latestReport ? (
          <div>
            <div className="flex items-center gap-4" style={{ marginBottom: '8px' }}>
              <span className="text-2xl font-medium">
                {latestReport.visibility_score !== null ? `${latestReport.visibility_score}%` : '—'}
              </span>
              <span className="text-sm text-[var(--text-dim)]">Visibility Score</span>
            </div>

            {latestReport.platform_scores && (
              <div className="flex items-center gap-4">
                {Object.entries(platformConfig).map(([platform, config]) => {
                  const score = latestReport.platform_scores?.[platform]
                  if (score === undefined) return null
                  const mentions = Math.round((score / 100) * QUESTIONS_PER_PLATFORM)
                  return (
                    <div
                      key={platform}
                      className="flex items-center gap-1.5 font-mono text-sm"
                      title={`${config.name}: ${mentions}/${QUESTIONS_PER_PLATFORM} mentions`}
                    >
                      <span style={{ color: config.color }}>{config.name}</span>
                      <span className="text-[var(--text-dim)]">
                        {mentions}/{QUESTIONS_PER_PLATFORM}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center" style={{ padding: '24px' }}>
            <Loader2 className="w-6 h-6 animate-spin text-[var(--green)]" style={{ margin: '0 auto 12px' }} />
            <p className="text-[var(--text-mid)]" style={{ marginBottom: '4px' }}>
              Your first scan is in progress
            </p>
            <p className="text-sm text-[var(--text-dim)]">
              Results typically ready in 5-10 minutes — we&apos;ll email you when it&apos;s done
            </p>
          </div>
        )}
      </CollapsibleSection>

      {/* Schedule Section */}
      <CollapsibleSection
        title="Weekly Scan Schedule"
        isOpen={expandedSections.schedule}
        onToggle={() => toggleSection('schedule')}
      >
        <ScheduleSettings
          subscriptionId={subscription.id}
          initialDay={subscription.scan_schedule_day}
          initialHour={subscription.scan_schedule_hour}
          initialTimezone={subscription.scan_timezone}
          compact
        />
      </CollapsibleSection>

      {/* Report History Section */}
      <CollapsibleSection
        title={`Report History (${subscription.report_count})`}
        isOpen={expandedSections.history}
        onToggle={() => toggleSection('history')}
      >
        <ReportHistory reports={reports} />
      </CollapsibleSection>

      {/* Subscription Section */}
      <CollapsibleSection
        title="Subscription"
        isOpen={expandedSections.subscription}
        onToggle={() => toggleSection('subscription')}
        noBorder
      >
        <SubscriptionActions subscription={subscription} onUpdate={onUpdate} region={region} />
      </CollapsibleSection>
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  noBorder?: boolean
}

function CollapsibleSection({ title, isOpen, onToggle, children, noBorder }: CollapsibleSectionProps) {
  return (
    <div className={noBorder ? '' : 'border-b border-[var(--border)]'}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left hover:bg-[var(--surface-hover)] transition-colors"
        style={{ padding: '12px 20px' }}
      >
        <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider">
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-dim)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-dim)]" />
        )}
      </button>

      {isOpen && (
        <div style={{ padding: '0 20px 20px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
