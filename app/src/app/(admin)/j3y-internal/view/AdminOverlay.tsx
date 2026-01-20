'use client'

import { useState } from 'react'
import {
  User,
  Mail,
  Calendar,
  CheckCircle,
  CreditCard,
  MapPin,
  Clock,
  Eye,
  History,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface UserInfo {
  email: string
  leadId: string
  signedUpAt: string
  emailVerified: boolean
  termsAcceptedAt: string | null
  lastLoginAt: string | null
  hasPassword: boolean
  passwordSetAt: string | null
  stripeCustomerId: string | null
  marketingOptIn: boolean | null
  tier: string
  isSubscriber: boolean
  location: {
    country: string | null
    city: string | null
    region: string | null
    timezone: string | null
  }
  subscription: {
    id: string
    domain: string
    tier: string
    status: string
    stripeSubscriptionId: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    createdAt: string
  } | null
  reportViews: number
  scanHistory: {
    id: string
    created_at: string
    completed_at: string | null
    status: string
    domain: string | null
  }[]
}

interface AdminOverlayProps {
  userInfo: UserInfo
  reportToken: string
  onRescanComplete?: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

function InfoRow({ icon: Icon, label, value, isPositive, isNegative }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  isPositive?: boolean
  isNegative?: boolean
}) {
  return (
    <div className="flex items-start gap-3" style={{ padding: '8px 0' }}>
      <Icon
        size={14}
        className="flex-shrink-0"
        style={{ marginTop: '2px', color: 'var(--text-dim)' }}
      />
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs text-[var(--text-dim)] block">{label}</span>
        <span
          className="font-mono text-sm block"
          style={{
            color: isPositive ? 'var(--green)' : isNegative ? 'var(--red, #ef4444)' : 'var(--text)',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[var(--border)]" style={{ padding: '12px 0' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-mono text-xs text-[var(--text-mid)] uppercase tracking-wider">
          {title}
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {isOpen && <div style={{ marginTop: '8px' }}>{children}</div>}
    </div>
  )
}

export function AdminOverlay({ userInfo, reportToken, onRescanComplete }: AdminOverlayProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rescanState, setRescanState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rescanError, setRescanError] = useState<string | null>(null)
  const [rescanResult, setRescanResult] = useState<{ scanId: string } | null>(null)

  const tierColor = userInfo.isSubscriber ? 'var(--gold)' : 'var(--text-dim)'
  const tierLabel = userInfo.tier.charAt(0).toUpperCase() + userInfo.tier.slice(1)

  // Trigger a rescan for this subscription
  const handleRescan = async () => {
    if (!userInfo.subscription) return

    setRescanState('loading')
    setRescanError(null)
    setRescanResult(null)

    try {
      const response = await fetch('/api/admin/rescan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          domain: userInfo.subscription.domain,
          domainSubscriptionId: userInfo.subscription.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger rescan')
      }

      setRescanState('success')
      setRescanResult({ scanId: data.scanId })
      onRescanComplete?.()

      // Reset success state after 10 seconds
      setTimeout(() => {
        setRescanState('idle')
        setRescanResult(null)
      }, 10000)
    } catch (err) {
      setRescanState('error')
      setRescanError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const locationStr = [userInfo.location.city, userInfo.location.region, userInfo.location.country]
    .filter(Boolean)
    .join(', ') || 'Unknown'

  return (
    <>
      {/* Toggle button - top right under admin banner */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-40 bg-[var(--surface)] border border-[var(--border)] shadow-lg flex items-center gap-2 hover:border-[var(--green)] transition-colors"
        style={{
          top: '48px',
          right: '16px',
          padding: '8px 12px',
          borderRadius: '6px',
        }}
      >
        <User size={16} className="text-[var(--green)]" />
        <span className="font-mono text-xs text-[var(--text)]">User Info</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Slide-out panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed z-50 bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl overflow-y-auto"
            style={{
              top: '40px', // Below admin banner
              right: 0,
              bottom: 0,
              width: '380px',
              maxWidth: '100vw',
            }}
          >
            {/* Header */}
            <div
              className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between"
              style={{ padding: '16px' }}
            >
              <h2 className="font-mono text-sm text-[var(--text)]">Customer Details</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '0 16px 24px' }}>
              {/* User Identity */}
              <Section title="Identity">
                <InfoRow icon={Mail} label="Email" value={userInfo.email} />
                <InfoRow
                  icon={CreditCard}
                  label="Tier"
                  value={
                    <span style={{ color: tierColor, fontWeight: 500 }}>
                      {tierLabel}
                      {userInfo.subscription?.status && userInfo.subscription.status !== 'active' && (
                        <span className="text-[var(--text-dim)]"> ({userInfo.subscription.status})</span>
                      )}
                    </span>
                  }
                />
                <InfoRow
                  icon={CheckCircle}
                  label="Email Verified"
                  value={userInfo.emailVerified ? 'Yes' : 'No'}
                  isPositive={userInfo.emailVerified}
                  isNegative={!userInfo.emailVerified}
                />
                <InfoRow
                  icon={User}
                  label="Has Password"
                  value={userInfo.hasPassword ? 'Yes' : 'No (magic link only)'}
                  isPositive={userInfo.hasPassword}
                />
              </Section>

              {/* Timeline */}
              <Section title="Timeline">
                <InfoRow
                  icon={Calendar}
                  label="Signed Up"
                  value={formatDate(userInfo.signedUpAt)}
                />
                <InfoRow
                  icon={Clock}
                  label="Last Login"
                  value={userInfo.lastLoginAt ? formatRelativeTime(userInfo.lastLoginAt) : 'Never logged in'}
                  isNegative={!userInfo.lastLoginAt}
                />
                <InfoRow
                  icon={CheckCircle}
                  label="Terms Accepted"
                  value={formatDate(userInfo.termsAcceptedAt)}
                />
                {userInfo.hasPassword && (
                  <InfoRow
                    icon={User}
                    label="Password Set"
                    value={formatDate(userInfo.passwordSetAt)}
                  />
                )}
              </Section>

              {/* Engagement */}
              <Section title="Engagement">
                <InfoRow
                  icon={Eye}
                  label="Report Views"
                  value={userInfo.reportViews}
                  isPositive={userInfo.reportViews > 0}
                />
                <InfoRow
                  icon={Mail}
                  label="Marketing Opt-In"
                  value={
                    userInfo.marketingOptIn === null
                      ? 'Not answered'
                      : userInfo.marketingOptIn
                        ? 'Yes'
                        : 'No'
                  }
                  isPositive={userInfo.marketingOptIn === true}
                  isNegative={userInfo.marketingOptIn === false}
                />
              </Section>

              {/* Location */}
              <Section title="Location">
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={locationStr}
                />
                <InfoRow
                  icon={Clock}
                  label="Timezone"
                  value={userInfo.location.timezone || 'Unknown'}
                />
              </Section>

              {/* Subscription (if subscriber) */}
              {userInfo.subscription && (
                <Section title="Subscription">
                  <InfoRow
                    icon={CreditCard}
                    label="Status"
                    value={
                      <span
                        style={{
                          color: userInfo.subscription.status === 'active'
                            ? 'var(--green)'
                            : userInfo.subscription.status === 'canceled'
                              ? 'var(--red, #ef4444)'
                              : 'var(--gold)',
                        }}
                      >
                        {userInfo.subscription.status.charAt(0).toUpperCase() + userInfo.subscription.status.slice(1)}
                      </span>
                    }
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Subscribed"
                    value={formatDate(userInfo.subscription.createdAt)}
                  />
                  {userInfo.subscription.currentPeriodEnd && (
                    <InfoRow
                      icon={Calendar}
                      label="Current Period Ends"
                      value={formatDate(userInfo.subscription.currentPeriodEnd)}
                    />
                  )}
                  {userInfo.stripeCustomerId && (
                    <InfoRow
                      icon={ExternalLink}
                      label="Stripe Customer"
                      value={
                        <a
                          href={`https://dashboard.stripe.com/customers/${userInfo.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--green)] hover:underline flex items-center gap-1"
                        >
                          View in Stripe
                          <ExternalLink size={12} />
                        </a>
                      }
                    />
                  )}

                  {/* Rescan Button */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={handleRescan}
                      disabled={rescanState === 'loading'}
                      className="w-full flex items-center justify-center gap-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ padding: '10px 16px', borderRadius: '4px' }}
                    >
                      {rescanState === 'loading' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Triggering Rescan...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          Trigger Rescan
                        </>
                      )}
                    </button>

                    {/* Success message */}
                    {rescanState === 'success' && rescanResult && (
                      <div
                        className="flex items-center gap-2 text-[var(--green)] font-mono text-xs"
                        style={{ marginTop: '12px', padding: '8px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px' }}
                      >
                        <CheckCircle2 size={14} />
                        <div>
                          <p>Scan initiated successfully!</p>
                          <code className="text-[10px] opacity-70">{rescanResult.scanId}</code>
                        </div>
                      </div>
                    )}

                    {/* Error message */}
                    {rescanState === 'error' && rescanError && (
                      <div
                        className="flex items-center gap-2 text-red-400 font-mono text-xs"
                        style={{ marginTop: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}
                      >
                        <AlertCircle size={14} />
                        <span>{rescanError}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Scan History */}
              <Section title="Scan History" defaultOpen={false}>
                {userInfo.scanHistory.length === 0 ? (
                  <p className="text-[var(--text-dim)] font-mono text-xs" style={{ padding: '8px 0' }}>
                    No scans found
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {userInfo.scanHistory.map((scan, index) => (
                      <div
                        key={scan.id}
                        className="bg-[var(--bg)] border border-[var(--border)]"
                        style={{ padding: '10px 12px' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[var(--text-dim)]">
                            {index === 0 ? 'Current' : `Scan #${userInfo.scanHistory.length - index}`}
                          </span>
                          <span
                            className="font-mono text-xs"
                            style={{
                              color: scan.status === 'complete'
                                ? 'var(--green)'
                                : scan.status === 'failed'
                                  ? 'var(--red, #ef4444)'
                                  : 'var(--gold)',
                            }}
                          >
                            {scan.status}
                          </span>
                        </div>
                        <p className="font-mono text-sm text-[var(--text)]" style={{ marginTop: '4px' }}>
                          {scan.domain || 'Unknown domain'}
                        </p>
                        <p className="font-mono text-xs text-[var(--text-dim)]" style={{ marginTop: '4px' }}>
                          {formatRelativeTime(scan.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Debug Info */}
              <Section title="Debug" defaultOpen={false}>
                <InfoRow
                  icon={History}
                  label="Lead ID"
                  value={
                    <code className="text-xs bg-[var(--bg)] px-1">{userInfo.leadId}</code>
                  }
                />
                <InfoRow
                  icon={History}
                  label="Report Token"
                  value={
                    <code className="text-xs bg-[var(--bg)] px-1">{reportToken}</code>
                  }
                />
                {userInfo.stripeCustomerId && (
                  <InfoRow
                    icon={CreditCard}
                    label="Stripe Customer ID"
                    value={
                      <code className="text-xs bg-[var(--bg)] px-1">{userInfo.stripeCustomerId}</code>
                    }
                  />
                )}
                {userInfo.subscription?.stripeSubscriptionId && (
                  <InfoRow
                    icon={CreditCard}
                    label="Stripe Subscription ID"
                    value={
                      <code className="text-xs bg-[var(--bg)] px-1">{userInfo.subscription.stripeSubscriptionId}</code>
                    }
                  />
                )}
              </Section>
            </div>
          </div>
        </>
      )}
    </>
  )
}
