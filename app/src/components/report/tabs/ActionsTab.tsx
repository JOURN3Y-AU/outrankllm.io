'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Zap,
  Target,
  Archive,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Tag,
  RefreshCw,
  FileText,
  BookOpen,
  History,
} from 'lucide-react'
import { EnrichmentLoading } from '../shared/EnrichmentLoading'

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

interface ActionItem {
  id: string
  title: string
  description: string
  rationale: string | null
  source_insight: string | null
  priority: 'quick_win' | 'strategic' | 'backlog'
  category: string | null
  estimated_impact: string | null
  estimated_effort: string | null
  target_page: string | null
  target_element: string | null
  target_keywords: string[] | null
  consensus: string[] | null
  implementation_steps: string[] | null
  expected_outcome: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed'
  sort_order: number
}

interface PageEdit {
  page: string
  metaTitle: string | null
  metaDescription: string | null
  h1Change: string
  contentToAdd: string | null
}

interface KeywordEntry {
  keyword: string
  bestPage: string
  whereToAdd: string
  priority: string
}

interface ActionPlan {
  id: string
  run_id: string
  executive_summary: string | null
  total_actions: number
  quick_wins_count: number
  strategic_count: number
  backlog_count: number
  generated_at: string
  actions: ActionItem[]
  page_edits: PageEdit[] | null
  keyword_map: KeywordEntry[] | null
  key_takeaways: string[] | null
}

interface ActionHistoryItem {
  id: string
  title: string
  description: string
  category: string | null
  completed_at: string
}

interface ActionsTabProps {
  runId?: string
  enrichmentStatus?: EnrichmentStatus
}

export function ActionsTab({ runId, enrichmentStatus = 'not_applicable' }: ActionsTabProps) {
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [history, setHistory] = useState<ActionHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'quick_win' | 'strategic' | 'backlog'>('all')

  useEffect(() => {
    fetchPlan()
  }, [runId])

  const fetchPlan = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = runId ? `/api/actions?run_id=${runId}` : '/api/actions'
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch action plan')
      }
      const data = await res.json()
      setPlan(data.plan)
      setHistory(data.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load action plan')
    } finally {
      setIsLoading(false)
    }
  }

  const updateActionStatus = async (actionId: string, status: ActionItem['status']) => {
    // Optimistically update UI first
    setPlan(prev => {
      if (!prev) return null
      return {
        ...prev,
        actions: prev.actions.map(a =>
          a.id === actionId ? { ...a, status } : a
        ),
      }
    })

    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update action')
      }
    } catch (err) {
      console.error('Error updating action:', err)
      // Revert on error
      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          actions: prev.actions.map(a =>
            a.id === actionId ? { ...a, status: status === 'completed' ? 'pending' : 'completed' } : a
          ),
        }
      })
      // Could add toast notification here
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Show enrichment loading states (takes precedence over local loading)
  if (enrichmentStatus === 'processing' || enrichmentStatus === 'pending') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status={enrichmentStatus}
          title="Generating Action Plan"
          description="We're analyzing your scan data with Claude's extended thinking to create comprehensive, prioritized recommendations."
          processingMessage="This usually takes 30-60 seconds as Claude reasons through your data."
          pendingMessage="Your AI-powered action plan will be generated shortly."
        />
      </div>
    )
  }

  if (enrichmentStatus === 'failed') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status="failed"
          title="Action Plan Generation"
          description="We encountered an issue generating your action plan."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: '12px' }} />
        Loading action plan...
      </div>
    )
  }

  if (!plan) {
    return (
      <div style={{ display: 'grid', gap: '32px' }}>
        {/* Header */}
        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '20px 24px' }}
        >
          <div className="flex items-start" style={{ gap: '16px' }}>
            <Lightbulb size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
            <div>
              <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
                <strong className="text-[var(--text)]">Personalized Action Plans:</strong> Get specific, prioritized recommendations based on your scan results to improve your AI visibility.
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div
          className="card flex flex-col items-center justify-center text-center"
          style={{ padding: '60px 40px' }}
        >
          <div
            className="flex items-center justify-center bg-[var(--gold)]/10 border border-[var(--gold)]/20"
            style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '24px' }}
          >
            <Clock size={28} className="text-[var(--gold)]" />
          </div>
          <h3 className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
            Action Plan Coming Soon
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ maxWidth: '420px', marginBottom: '16px', lineHeight: '1.6' }}>
            Your personalized action plan will be generated automatically on your next weekly scan.
            Action plans use AI to analyze your site data and create prioritized, specific recommendations.
          </p>
          <p className="text-[var(--text-ghost)] text-xs font-mono">
            Check back after your next scheduled scan
          </p>
          {error && (
            <p className="text-[var(--red)] text-sm" style={{ marginTop: '16px' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Filter actions
  const filteredActions = filter === 'all'
    ? plan.actions
    : plan.actions.filter(a => a.priority === filter)

  // Group by priority
  const quickWins = filteredActions.filter(a => a.priority === 'quick_win')
  const strategic = filteredActions.filter(a => a.priority === 'strategic')
  const backlog = filteredActions.filter(a => a.priority === 'backlog')

  // Calculate completion stats
  const completedCount = plan.actions.filter(a => a.status === 'completed').length
  const progressPercent = plan.actions.length > 0
    ? Math.round((completedCount / plan.actions.length) * 100)
    : 0

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Executive Summary */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Lightbulb size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div className="flex-1">
            <h3 className="text-[var(--text)] font-medium" style={{ marginBottom: '8px' }}>
              Executive Summary
            </h3>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7' }}>
              {plan.executive_summary}
            </p>
          </div>
        </div>
      </div>

      {/* How it works tip */}
      <div
        className="bg-[var(--gold)]/5 border border-[var(--gold)]/20"
        style={{ padding: '16px 20px', borderRadius: '4px' }}
      >
        <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
          <strong className="text-[var(--gold)]">Tip:</strong> Tick off actions as you complete them using the checkbox on the right.
          On your next weekly scan, we'll measure the impact of your changes and generate fresh recommendations based on what's improved.
          {history.length > 0
            ? ' Your progress is tracked in the Completed Actions section at the bottom of this page.'
            : ' Completed actions will be archived after your next scan so you can track your progress over time.'}
        </p>
      </div>

      {/* Stats & Progress */}
      <div className="grid sm:grid-cols-4" style={{ gap: '16px' }}>
        {/* Progress */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Progress</span>
            <span className="text-[var(--green)] font-mono">{progressPercent}%</span>
          </div>
          <div
            className="bg-[var(--border)]"
            style={{ height: '6px', borderRadius: '3px', overflow: 'hidden' }}
          >
            <div
              className="bg-[var(--green)]"
              style={{ height: '100%', width: `${progressPercent}%`, transition: 'width 0.3s' }}
            />
          </div>
          <p className="text-[var(--text-ghost)] text-xs" style={{ marginTop: '8px' }}>
            {completedCount} of {plan.actions.length} completed
          </p>
        </div>

        {/* Quick Wins */}
        <div
          className={`card cursor-pointer transition-all ${filter === 'quick_win' ? 'border-[var(--green)]' : ''}`}
          style={{ padding: '20px' }}
          onClick={() => setFilter(filter === 'quick_win' ? 'all' : 'quick_win')}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Zap size={16} className="text-[var(--green)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Quick Wins</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">{plan.quick_wins_count}</p>
        </div>

        {/* Strategic */}
        <div
          className={`card cursor-pointer transition-all ${filter === 'strategic' ? 'border-[var(--blue)]' : ''}`}
          style={{ padding: '20px' }}
          onClick={() => setFilter(filter === 'strategic' ? 'all' : 'strategic')}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Target size={16} className="text-[var(--blue)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Strategic</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">{plan.strategic_count}</p>
        </div>

        {/* Backlog */}
        <div
          className={`card cursor-pointer transition-all ${filter === 'backlog' ? 'border-[var(--text-dim)]' : ''}`}
          style={{ padding: '20px' }}
          onClick={() => setFilter(filter === 'backlog' ? 'all' : 'backlog')}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Archive size={16} className="text-[var(--text-dim)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Backlog</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">{plan.backlog_count}</p>
        </div>
      </div>

      {/* Action Items */}
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            {filter === 'all' ? 'All Actions' : filter === 'quick_win' ? 'Quick Wins' : filter === 'strategic' ? 'Strategic Actions' : 'Backlog'}
          </h3>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-[var(--text-dim)] text-xs font-mono hover:text-[var(--text)] transition-colors"
            >
              Show All
            </button>
          )}
        </div>

        {/* Quick Wins Section */}
        {quickWins.length > 0 && filter === 'all' && (
          <ActionSection
            title="Quick Wins"
            icon={<Zap size={16} className="text-[var(--green)]" />}
            color="var(--green)"
            actions={quickWins}
            expandedItems={expandedItems}
            onToggleExpand={toggleExpanded}
            onUpdateStatus={updateActionStatus}
          />
        )}

        {/* Strategic Section */}
        {strategic.length > 0 && filter === 'all' && (
          <ActionSection
            title="Strategic"
            icon={<Target size={16} className="text-[var(--blue)]" />}
            color="var(--blue)"
            actions={strategic}
            expandedItems={expandedItems}
            onToggleExpand={toggleExpanded}
            onUpdateStatus={updateActionStatus}
            style={{ marginTop: quickWins.length > 0 ? '32px' : '0' }}
          />
        )}

        {/* Backlog Section */}
        {backlog.length > 0 && filter === 'all' && (
          <ActionSection
            title="Backlog"
            icon={<Archive size={16} className="text-[var(--text-dim)]" />}
            color="var(--text-dim)"
            actions={backlog}
            expandedItems={expandedItems}
            onToggleExpand={toggleExpanded}
            onUpdateStatus={updateActionStatus}
            style={{ marginTop: (quickWins.length > 0 || strategic.length > 0) ? '32px' : '0' }}
          />
        )}

        {/* Filtered view */}
        {filter !== 'all' && (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filteredActions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                isExpanded={expandedItems.has(action.id)}
                onToggleExpand={() => toggleExpanded(action.id)}
                onUpdateStatus={updateActionStatus}
              />
            ))}
          </div>
        )}

        {filteredActions.length === 0 && (
          <p className="text-[var(--text-dim)] text-sm text-center" style={{ padding: '40px 0' }}>
            No actions in this category.
          </p>
        )}
      </div>

      {/* Page Edits Section */}
      {plan.page_edits && plan.page_edits.length > 0 && (
        <CollapsibleSection
          title="Suggested Page Updates"
          icon={<FileText size={16} className="text-[var(--gold)]" />}
          count={plan.page_edits.length}
        >
          {/* Explanation for business owners */}
          <div
            className="bg-[var(--surface)] border-l-2 border-[var(--gold)]"
            style={{ marginBottom: '20px', padding: '12px 16px' }}
          >
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              These are specific text changes you can make to improve how AI assistants understand and recommend your pages.
              Copy these suggestions directly or use them as a guide when updating your content.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {plan.page_edits.map((edit, idx) => (
              <div
                key={idx}
                className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '16px 20px' }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                  <span className="text-sm font-medium text-[var(--text)]">Page: </span>
                  <span className="text-sm text-[var(--gold)]">{edit.page}</span>
                </div>
                {edit.metaTitle && (
                  <div className="bg-[var(--surface)]" style={{ marginBottom: '12px', padding: '12px', borderRadius: '4px' }}>
                    <p className="text-xs text-[var(--text-dim)]" style={{ marginBottom: '4px' }}>
                      Page title (appears in browser tab and search results)
                    </p>
                    <p className="text-sm text-[var(--text)]">{edit.metaTitle}</p>
                  </div>
                )}
                {edit.metaDescription && (
                  <div className="bg-[var(--surface)]" style={{ marginBottom: '12px', padding: '12px', borderRadius: '4px' }}>
                    <p className="text-xs text-[var(--text-dim)]" style={{ marginBottom: '4px' }}>
                      Meta description (summary shown in search results)
                    </p>
                    <p className="text-sm text-[var(--text)]">{edit.metaDescription}</p>
                  </div>
                )}
                {edit.h1Change && edit.h1Change !== 'keep' && (
                  <div className="bg-[var(--surface)]" style={{ marginBottom: '12px', padding: '12px', borderRadius: '4px' }}>
                    <p className="text-xs text-[var(--text-dim)]" style={{ marginBottom: '4px' }}>
                      Main heading (the largest text on the page)
                    </p>
                    <p className="text-sm text-[var(--text)]">{edit.h1Change}</p>
                  </div>
                )}
                {edit.contentToAdd && (
                  <div className="bg-[var(--green)]/5 border border-[var(--green)]/20" style={{ padding: '12px', borderRadius: '4px' }}>
                    <p className="text-xs text-[var(--green)]" style={{ marginBottom: '4px' }}>
                      Content to add to this page
                    </p>
                    <p className="text-sm text-[var(--text)]" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{edit.contentToAdd}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Keyword Map Section */}
      {plan.keyword_map && plan.keyword_map.length > 0 && (
        <CollapsibleSection
          title="Where to Add Keywords"
          icon={<Tag size={16} className="text-[var(--gold)]" />}
          count={plan.keyword_map.length}
        >
          {/* Explanation for business owners */}
          <div
            className="bg-[var(--surface)] border-l-2 border-[var(--gold)]"
            style={{ marginBottom: '20px', padding: '12px 16px' }}
          >
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              AI assistants look for specific phrases and keywords when deciding which businesses to recommend.
              This table shows which keywords to add to your website and exactly where to put them for maximum visibility.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="text-left text-xs text-[var(--text-dim)]">
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Keyword to add</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Which page</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Where on the page</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {plan.keyword_map.map((entry, idx) => (
                  <tr key={idx} className="text-sm">
                    <td className="text-[var(--text)] font-medium" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      "{entry.keyword}"
                    </td>
                    <td className="text-[var(--text-mid)]" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      {entry.bestPage}
                    </td>
                    <td className="text-[var(--text-mid)]" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      {entry.whereToAdd}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`text-xs px-2 py-1 ${
                        entry.priority === 'high' ? 'text-[var(--green)] bg-[var(--green)]/10' :
                        entry.priority === 'medium' ? 'text-[var(--gold)] bg-[var(--gold)]/10' :
                        'text-[var(--text-dim)] bg-[var(--surface)]'
                      }`} style={{ borderRadius: '4px' }}>
                        {entry.priority === 'high' ? 'Do first' : entry.priority === 'medium' ? 'Important' : 'Nice to have'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Key Takeaways Section */}
      {plan.key_takeaways && plan.key_takeaways.length > 0 && (
        <CollapsibleSection
          title="Key Takeaways"
          icon={<BookOpen size={16} className="text-[var(--green)]" />}
          count={plan.key_takeaways.length}
          defaultOpen
        >
          <ul style={{ display: 'grid', gap: '12px' }}>
            {plan.key_takeaways.map((takeaway, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-sm text-[var(--text-mid)]"
                style={{ lineHeight: '1.6' }}
              >
                <span className="text-[var(--green)] font-mono flex-shrink-0">{idx + 1}.</span>
                {takeaway}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Completed History Section */}
      {history.length > 0 && (
        <CollapsibleSection
          title="Completed Actions"
          icon={<History size={16} className="text-[var(--green)]" />}
          count={history.length}
        >
          {/* Explanation for business owners */}
          <div
            className="bg-[var(--green)]/5 border-l-2 border-[var(--green)]"
            style={{ marginBottom: '20px', padding: '12px 16px' }}
          >
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              These are actions you've completed in previous scans. We remember your progress so you won't see the same recommendations again.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--surface)] border border-[var(--green)]/20"
                style={{ padding: '12px 16px', borderLeftWidth: '3px', borderLeftColor: 'var(--green)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 flex items-center justify-center bg-[var(--green)] text-[var(--bg)]"
                    style={{ width: '20px', height: '20px', borderRadius: '4px', marginTop: '2px' }}
                  >
                    <Check size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text)] text-sm font-medium line-through opacity-60">
                      {item.title}
                    </p>
                    {item.completed_at && (
                      <p className="text-[var(--text-ghost)] text-xs" style={{ marginTop: '4px' }}>
                        Completed {formatDate(item.completed_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

function ActionSection({
  title,
  icon,
  color,
  actions,
  expandedItems,
  onToggleExpand,
  onUpdateStatus,
  style = {},
}: {
  title: string
  icon: React.ReactNode
  color: string
  actions: ActionItem[]
  expandedItems: Set<string>
  onToggleExpand: (id: string) => void
  onUpdateStatus: (id: string, status: ActionItem['status']) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
        {icon}
        <span className="text-[var(--text-mid)] font-mono text-sm">{title}</span>
        <span className="text-[var(--text-ghost)] text-xs">({actions.length})</span>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {actions.map(action => (
          <ActionCard
            key={action.id}
            action={action}
            isExpanded={expandedItems.has(action.id)}
            onToggleExpand={() => onToggleExpand(action.id)}
            onUpdateStatus={onUpdateStatus}
            accentColor={color}
          />
        ))}
      </div>
    </div>
  )
}

function ActionCard({
  action,
  isExpanded,
  onToggleExpand,
  onUpdateStatus,
  accentColor = 'var(--green)',
}: {
  action: ActionItem
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateStatus: (id: string, status: ActionItem['status']) => void
  accentColor?: string
}) {
  const isCompleted = action.status === 'completed'

  // Format effort for business owners
  const formatEffort = (effort: string | null) => {
    if (!effort) return null
    const effortMap: Record<string, string> = {
      'low': 'Quick task',
      'medium': 'A few hours',
      'high': 'Larger project',
    }
    return effortMap[effort] || effort
  }

  // Format impact for business owners
  const formatImpact = (impact: string | null) => {
    if (!impact) return null
    const impactMap: Record<string, { label: string, color: string }> = {
      'high': { label: 'High impact', color: 'var(--green)' },
      'medium': { label: 'Medium impact', color: 'var(--gold)' },
      'low': { label: 'Lower impact', color: 'var(--text-dim)' },
    }
    return impactMap[impact] || { label: impact, color: 'var(--text-dim)' }
  }

  const impactInfo = formatImpact(action.estimated_impact)

  return (
    <div
      className={`bg-[var(--surface-elevated)] border transition-all ${
        isCompleted ? 'border-[var(--green)]/30 opacity-60' : 'border-[var(--border)]'
      }`}
      style={{ borderLeftWidth: '3px', borderLeftColor: isCompleted ? 'var(--green)' : accentColor }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        style={{ padding: '16px 20px' }}
        onClick={onToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-[var(--text-dim)]' : 'text-[var(--text)]'}`}>
            {action.title}
          </h4>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '6px' }}>
            {impactInfo && (
              <span className="text-xs" style={{ color: impactInfo.color }}>
                {impactInfo.label}
              </span>
            )}
            {action.estimated_effort && (
              <span className="text-xs text-[var(--text-dim)]">
                {formatEffort(action.estimated_effort)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Expand/collapse chevron */}
          {isExpanded ? (
            <ChevronUp size={16} className="text-[var(--text-dim)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--text-dim)]" />
          )}

          {/* Completion checkbox - on the right */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUpdateStatus(action.id, isCompleted ? 'pending' : 'completed')
            }}
            className={`flex-shrink-0 flex items-center justify-center border transition-all ${
              isCompleted
                ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]'
                : 'border-[var(--border)] hover:border-[var(--green)] text-transparent hover:text-[var(--green)]/50'
            }`}
            style={{ width: '24px', height: '24px', borderRadius: '4px' }}
            title={isCompleted ? 'Mark as not done' : 'Mark as done'}
          >
            <Check size={14} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '20px' }}
        >
          {/* What we found - the proof point from scan data */}
          {action.source_insight && (
            <div style={{ marginBottom: '20px' }}>
              <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
                What we found
              </h5>
              <p className="text-[var(--text)] text-sm" style={{ lineHeight: '1.6' }}>
                {action.source_insight}
              </p>
            </div>
          )}

          {/* What to do - main task description */}
          <div style={{ marginBottom: '20px' }}>
            <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
              What to do
            </h5>
            <p className="text-[var(--text)] text-sm" style={{ lineHeight: '1.6' }}>
              {action.description}
            </p>
          </div>

          {/* How to do it - implementation steps */}
          {action.implementation_steps && action.implementation_steps.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '12px' }}>
                How to do it
              </h5>
              <div style={{ display: 'grid', gap: '10px' }}>
                {action.implementation_steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="text-[var(--green)] font-mono text-sm flex-shrink-0" style={{ minWidth: '20px' }}>
                      {idx + 1}.
                    </span>
                    <span className="text-sm text-[var(--text-mid)]" style={{ lineHeight: '1.6' }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected result - highlighted as the payoff */}
          {action.expected_outcome && (
            <div
              className="bg-[var(--green)]/5 border-l-2 border-[var(--green)]"
              style={{ padding: '12px 16px' }}
            >
              <h5 className="text-[var(--green)] text-xs font-mono uppercase" style={{ marginBottom: '6px' }}>
                Expected result
              </h5>
              <p className="text-[var(--text)] text-sm" style={{ lineHeight: '1.5' }}>
                {action.expected_outcome}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="card" style={{ padding: '0' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-[var(--text)] font-medium">{title}</span>
          <span className="text-[var(--text-ghost)] text-xs">({count})</span>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-[var(--text-dim)]" />
        ) : (
          <ChevronDown size={16} className="text-[var(--text-dim)]" />
        )}
      </button>
      {isOpen && (
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '20px 24px' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// Helper to format dates for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'today'
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}
