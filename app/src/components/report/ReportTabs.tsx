'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Lightbulb, FileCode } from 'lucide-react'

import { tabs } from './shared/constants'

import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import type { TabId, Analysis, Response, Prompt, Competitor, CrawlData, BrandAwarenessResult, CompetitiveSummary, PlatformData } from './shared/types'

import {
  StartHereTab,
  SetupTab,
  AIReadinessTab,
  ResponsesTab,
  MeasurementsTab,
  CompetitorsTab,
  BrandAwarenessTab,
  ActionsTab,
  PrdTab,
  LockedTab,
} from './tabs'

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

type Tier = 'free' | 'starter' | 'pro' | 'agency'

interface ReportTabsProps {
  analysis: Analysis | null
  responses: Response[] | null
  prompts?: Prompt[] | null
  brandAwareness?: BrandAwarenessResult[] | null
  competitiveSummary?: CompetitiveSummary | null
  visibilityScore: number
  platformScores: Record<string, number>
  competitors?: Competitor[]
  crawlData?: CrawlData
  platformData?: PlatformData | null
  domain: string
  domainSubscriptionId?: string | null
  onUpgradeClick: () => void
  isSubscriber?: boolean
  tier?: Tier
  customQuestionLimit?: number
  currentRunId?: string
  enrichmentStatus?: EnrichmentStatus
  /** Whether to blur competitor data (separate from isSubscriber for trial users) */
  blurCompetitors?: boolean
  /** Whether to show action plans (for trial users who have access) */
  showActionPlans?: boolean
  /** Whether to show PRD tasks (Pro/Agency only) */
  showPrdTasks?: boolean
  /** Whether user is on trial (for CTA messaging) */
  isTrial?: boolean
}

export function ReportTabs({
  analysis,
  responses,
  prompts,
  brandAwareness,
  competitiveSummary,
  visibilityScore,
  platformScores,
  competitors = [],
  crawlData,
  platformData,
  domain,
  domainSubscriptionId,
  onUpgradeClick,
  isSubscriber = false,
  tier = 'free',
  customQuestionLimit = 0,
  currentRunId,
  enrichmentStatus = 'not_applicable',
  blurCompetitors,
  showActionPlans,
  showPrdTasks,
  isTrial = false,
}: ReportTabsProps) {
  // Default blurCompetitors based on isSubscriber if not explicitly provided
  const shouldBlurCompetitors = blurCompetitors ?? !isSubscriber
  // Default showActionPlans - show if subscriber OR explicitly set (for trial users)
  const shouldShowActionPlans = showActionPlans ?? isSubscriber
  // Default showPrdTasks - only for Pro/Agency subscribers
  const shouldShowPrdTasks = showPrdTasks ?? isSubscriber
  // Always start with default tab on server/initial render to avoid hydration mismatch
  const [activeTab, setActiveTab] = useState<TabId>('startHere')
  const [isTabRestored, setIsTabRestored] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [brandPlatformFilter, setBrandPlatformFilter] = useState<string>('all')
  const tabsRef = useRef<HTMLDivElement>(null)

  // Restore active tab from sessionStorage after hydration (for back button restoration)
  useEffect(() => {
    const savedTab = sessionStorage.getItem('report_active_tab')
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTab(savedTab as TabId)
      // Clear the saved tab after restoring (one-time use)
      sessionStorage.removeItem('report_active_tab')
    }
    setIsTabRestored(true)
  }, [])

  // Save active tab to sessionStorage whenever it changes (but only after initial restoration)
  useEffect(() => {
    if (isTabRestored) {
      sessionStorage.setItem('report_active_tab', activeTab)
    }
  }, [activeTab, isTabRestored])

  const scrollToTabsAndNavigate = (tabId: TabId) => {
    setActiveTab(tabId)
    // Scroll to tabs with a small offset from top
    setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <div ref={tabsRef} style={{ marginTop: '48px', scrollMarginTop: '24px' }}>
      {/* Tab Navigation - Sticky container with header and tabs */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: 'var(--bg)',
          paddingTop: '12px',
          marginTop: '-12px',
          marginBottom: '40px',
        }}
      >
        {/* Tab Navigation Header */}
        <div
          className="font-mono text-[var(--text-dim)]"
          style={{ fontSize: '11px', marginBottom: '12px', letterSpacing: '0.05em' }}
        >
          <span style={{ textTransform: 'uppercase' }}>Click to explore each section</span>
          <span style={{ marginLeft: '8px', color: 'var(--text-ghost)' }}>↓</span>
        </div>

        {/* Tab buttons */}
        <div
          className="border-b border-[var(--border)]"
        >
          <nav
            className="flex"
            style={{ marginBottom: '-1px' }}
          >
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLast = index === tabs.length - 1
            // Determine if tab should show lock based on user's actual access
            // Trial users have access to competitors, brand awareness, and actions but NOT prd
            let showGoldLock = false
            if (tab.id === 'competitors' || tab.id === 'brandAwareness') {
              showGoldLock = shouldBlurCompetitors
            } else if (tab.id === 'actions') {
              showGoldLock = !shouldShowActionPlans
            } else if (tab.id === 'prd') {
              showGoldLock = !shouldShowPrdTasks
            }

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  // Scroll window so tab content starts at top (just below sticky header)
                  window.scrollTo({ top: tabsRef.current?.offsetTop ?? 0, behavior: 'smooth' })
                  trackEvent(ANALYTICS_EVENTS.REPORT_TAB_CLICK, {
                    tab_name: tab.id,
                    user_tier: tier,
                    is_subscriber: isSubscriber,
                  })
                }}
                className={`
                  group relative flex flex-col items-center justify-center flex-1 font-mono
                  border-b-2 cursor-pointer
                  transition-all duration-150 ease-out
                  ${isActive
                    ? 'text-[var(--text)] border-[var(--green)] bg-[var(--surface)]'
                    : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--text-ghost)]'
                  }
                  ${!isLast ? 'border-r border-r-[var(--border-subtle)]' : ''}
                `}
                style={{ fontSize: '11px', minWidth: 0, padding: '16px 8px' }}
              >
                <Icon
                  size={18}
                  className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
                  style={{ marginBottom: '8px' }}
                />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                {showGoldLock && (
                  <Lock
                    size={10}
                    className="absolute"
                    style={{
                      top: '8px',
                      right: '8px',
                      color: 'var(--gold)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'startHere' && (
          <StartHereTab
            analysis={analysis}
            domain={domain}
            onContinue={() => scrollToTabsAndNavigate('setup')}
            isSubscriber={isSubscriber}
            responses={responses}
            crawlData={crawlData}
            competitors={competitors}
            platformScores={platformScores}
          />
        )}
        {activeTab === 'setup' && (
          <SetupTab
            analysis={analysis}
            prompts={prompts}
            domain={domain}
            domainSubscriptionId={domainSubscriptionId}
            isSubscriber={isSubscriber}
            customQuestionLimit={customQuestionLimit}
            platformData={platformData}
          />
        )}
        {activeTab === 'responses' && (
          <ResponsesTab
            responses={responses}
            platformFilter={platformFilter}
            onFilterChange={setPlatformFilter}
            domain={domain}
            tier={tier}
            analysis={analysis}
          />
        )}
        {activeTab === 'readiness' && (
          <AIReadinessTab analysis={analysis} crawlData={crawlData} domain={domain} tier={tier} />
        )}
        {activeTab === 'measurements' && (
          <MeasurementsTab
            visibilityScore={visibilityScore}
            platformScores={platformScores}
            responses={responses}
            analysis={analysis}
            brandAwareness={brandAwareness}
            isSubscriber={isSubscriber}
            currentRunId={currentRunId}
            domain={domain}
            domainSubscriptionId={domainSubscriptionId}
            tier={tier}
            isTrial={isTrial}
          />
        )}
        {activeTab === 'competitors' && (
          <CompetitorsTab
            competitors={competitors}
            responses={responses}
            brandAwareness={brandAwareness}
            competitiveSummary={competitiveSummary}
            analysis={analysis}
            domain={domain}
            domainSubscriptionId={domainSubscriptionId}
            onUpgradeClick={onUpgradeClick}
            isSubscriber={isSubscriber}
            blurCompetitors={shouldBlurCompetitors}
          />
        )}
        {activeTab === 'brandAwareness' && (
          <BrandAwarenessTab
            brandAwareness={brandAwareness}
            analysis={analysis}
            domain={domain}
            platformFilter={brandPlatformFilter}
            onFilterChange={setBrandPlatformFilter}
            onUpgradeClick={onUpgradeClick}
            isSubscriber={isSubscriber}
            enrichmentStatus={enrichmentStatus}
            runId={currentRunId}
            blurContent={shouldBlurCompetitors}
          />
        )}
        {activeTab === 'actions' && (
          shouldShowActionPlans ? (
            <ActionsTab
              runId={currentRunId}
              domainSubscriptionId={domainSubscriptionId}
              enrichmentStatus={enrichmentStatus}
              tier={tier}
              onUpgradeClick={onUpgradeClick}
            />
          ) : (
            <LockedTab
              icon={Lightbulb}
              title="Personalized Action Plans"
              description="Get specific, prioritized recommendations to improve your AI visibility."
              features={[
                'Content gap recommendations',
                'Technical SEO for AI crawlers',
                'Schema markup suggestions',
                'Citation-building strategies'
              ]}
              onUpgrade={onUpgradeClick}
            />
          )
        )}
        {activeTab === 'prd' && (
          shouldShowPrdTasks ? (
            <PrdTab runId={currentRunId} domainSubscriptionId={domainSubscriptionId} enrichmentStatus={enrichmentStatus} />
          ) : (
            <LockedTab
              icon={FileCode}
              title="PRD & Technical Specs"
              description="Ready-to-ship product requirements for your AI coding tools."
              features={[
                'Cursor/Claude Code ready PRDs',
                'Implementation task breakdown',
                'Code snippets and examples',
                'Integration specifications'
              ]}
              onUpgrade={onUpgradeClick}
            />
          )
        )}
      </div>
    </div>
  )
}
