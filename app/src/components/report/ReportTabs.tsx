'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Lightbulb, FileCode } from 'lucide-react'

import { tabs } from './shared/constants'
import type { TabId, Analysis, Response, Prompt, Competitor, CrawlData, BrandAwarenessResult } from './shared/types'

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

interface ReportTabsProps {
  analysis: Analysis | null
  responses: Response[] | null
  prompts?: Prompt[] | null
  brandAwareness?: BrandAwarenessResult[] | null
  visibilityScore: number
  platformScores: Record<string, number>
  competitors?: Competitor[]
  crawlData?: CrawlData
  domain: string
  onUpgradeClick: () => void
  isSubscriber?: boolean
  customQuestionLimit?: number
  currentRunId?: string
}

export function ReportTabs({
  analysis,
  responses,
  prompts,
  brandAwareness,
  visibilityScore,
  platformScores,
  competitors = [],
  crawlData,
  domain,
  onUpgradeClick,
  isSubscriber = false,
  customQuestionLimit = 0,
  currentRunId,
}: ReportTabsProps) {
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
      {/* Tab Navigation - Spread across full width */}
      <div
        className="border-b border-[var(--border)]"
        style={{ marginBottom: '40px' }}
      >
        <nav
          className="flex"
          style={{ marginBottom: '-1px' }}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLast = index === tabs.length - 1
            const showGoldLock = tab.premium || tab.locked

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 font-mono transition-all
                  border-b-2 cursor-pointer
                  ${isActive
                    ? 'text-[var(--text)] border-[var(--green)] bg-[var(--surface)]'
                    : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text-mid)] hover:bg-[var(--surface)]/50'
                  }
                  ${!isLast ? 'border-r border-r-[var(--border-subtle)]' : ''}
                `}
                style={{ fontSize: '11px', minWidth: 0, padding: '16px 8px' }}
              >
                <Icon size={18} className="flex-shrink-0" style={{ marginBottom: '8px' }} />
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

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'startHere' && (
          <StartHereTab
            analysis={analysis}
            domain={domain}
            onContinue={() => scrollToTabsAndNavigate('setup')}
          />
        )}
        {activeTab === 'setup' && (
          <SetupTab
            analysis={analysis}
            prompts={prompts}
            domain={domain}
            isSubscriber={isSubscriber}
            customQuestionLimit={customQuestionLimit}
          />
        )}
        {activeTab === 'responses' && (
          <ResponsesTab
            responses={responses}
            platformFilter={platformFilter}
            onFilterChange={setPlatformFilter}
          />
        )}
        {activeTab === 'readiness' && (
          <AIReadinessTab analysis={analysis} crawlData={crawlData} domain={domain} />
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
          />
        )}
        {activeTab === 'competitors' && (
          <CompetitorsTab
            competitors={competitors}
            onUpgradeClick={onUpgradeClick}
            isSubscriber={isSubscriber}
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
          />
        )}
        {activeTab === 'actions' && (
          isSubscriber ? (
            <ActionsTab />
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
          isSubscriber ? (
            <PrdTab />
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
