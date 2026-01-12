'use client'

import { useState, useEffect } from 'react'
import { Plus, CreditCard, FileText, Crown, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { DomainCard } from './DomainCard'
import { DomainDetails } from './DomainDetails'
import { AddDomainModal } from './AddDomainModal'
import type { DomainSubscriptionWithReports, SubscriptionReport } from '@/lib/subscriptions'
import type { PricingRegion } from '@/lib/stripe-config'

interface DashboardClientProps {
  initialSubscriptions: DomainSubscriptionWithReports[]
  email: string
  region: PricingRegion
}

export function DashboardClient({ initialSubscriptions, email, region }: DashboardClientProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubscriptions.length > 0 ? initialSubscriptions[0].id : null
  )
  const [selectedReports, setSelectedReports] = useState<SubscriptionReport[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [loadingReports, setLoadingReports] = useState(false)

  const selectedSubscription = subscriptions.find((s) => s.id === selectedId)
  const hasSubscriptions = subscriptions.length > 0

  // Fetch reports for selected subscription
  useEffect(() => {
    if (!selectedId) {
      setSelectedReports([])
      return
    }

    const fetchReports = async () => {
      setLoadingReports(true)
      try {
        const response = await fetch(`/api/subscriptions/${selectedId}`)
        if (response.ok) {
          const data = await response.json()
          setSelectedReports(data.reports || [])
        }
      } catch (error) {
        console.error('Error fetching reports:', error)
      } finally {
        setLoadingReports(false)
      }
    }

    fetchReports()
  }, [selectedId])

  // Refresh subscriptions list
  const refreshSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions')
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])

        // If selected subscription was updated, refresh its reports too
        if (selectedId) {
          const reportResponse = await fetch(`/api/subscriptions/${selectedId}`)
          if (reportResponse.ok) {
            const reportData = await reportResponse.json()
            setSelectedReports(reportData.reports || [])
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing subscriptions:', error)
    }
  }

  return (
    <>
      {/* Domain Cards */}
      {hasSubscriptions ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <h2 className="font-mono text-sm text-[var(--text-dim)] uppercase tracking-wider">
              Your Domains
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2" style={{ marginBottom: '16px' }}>
            {subscriptions.map((subscription) => (
              <DomainCard
                key={subscription.id}
                domain={subscription.domain}
                tier={subscription.tier}
                status={subscription.status}
                isSelected={selectedId === subscription.id}
                onClick={() => setSelectedId(subscription.id)}
              />
            ))}
          </div>

          {/* Add Domain Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--green)] transition-colors"
            style={{ padding: '16px' }}
          >
            <Plus className="w-5 h-5" />
            <span className="font-mono text-sm">Monitor Another Domain</span>
          </button>

          {/* Selected Domain Details */}
          {selectedSubscription && (
            <DomainDetails
              subscription={selectedSubscription}
              reports={selectedReports}
              onUpdate={refreshSubscriptions}
            />
          )}
        </>
      ) : (
        /* No Subscriptions - Prompt to add first domain */
        <div
          className="border border-[var(--border)] bg-[var(--surface)] text-center"
          style={{ padding: '48px 24px' }}
        >
          <FileText className="w-12 h-12 text-[var(--text-dim)]" style={{ margin: '0 auto 16px' }} />
          <h3 className="text-lg font-medium" style={{ marginBottom: '8px' }}>
            No domains being monitored
          </h3>
          <p className="text-[var(--text-mid)]" style={{ marginBottom: '24px' }}>
            Start tracking your AI visibility by monitoring your first domain.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all"
            style={{ padding: '12px 24px' }}
          >
            <Plus className="w-4 h-4" />
            Monitor Your First Domain
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: '32px' }}>
        {/* Manage Billing */}
        <form action="/api/stripe/portal" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-4 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--green)] transition-colors text-left"
            style={{ padding: '20px' }}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--gold)]/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-[var(--gold)]" />
            </div>
            <div>
              <div className="font-medium" style={{ marginBottom: '2px' }}>Manage Billing</div>
              <div className="text-sm text-[var(--text-dim)]">Invoices, payment methods & cancel subscriptions</div>
            </div>
          </button>
        </form>

        {/* View Pricing */}
        <Link
          href="/pricing"
          className="flex items-center gap-4 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--green)] transition-colors"
          style={{ padding: '20px' }}
        >
          <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-[var(--green)]" />
          </div>
          <div>
            <div className="font-medium" style={{ marginBottom: '2px' }}>View Plans</div>
            <div className="text-sm text-[var(--text-dim)]">Compare features & pricing</div>
          </div>
        </Link>
      </div>

      {/* Add Domain Modal */}
      <AddDomainModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        region={region}
      />
    </>
  )
}
