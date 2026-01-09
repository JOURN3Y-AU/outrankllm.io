'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Zap,
  Target,
  Archive,
  Check,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Tag,
  RefreshCw,
} from 'lucide-react'

interface ActionItem {
  id: string
  title: string
  description: string
  rationale: string | null
  priority: 'quick_win' | 'strategic' | 'backlog'
  category: string | null
  estimated_impact: string | null
  estimated_effort: string | null
  target_page: string | null
  target_element: string | null
  target_keywords: string[] | null
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed'
  sort_order: number
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
}

export function ActionsTab({ runId }: { runId?: string }) {
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load action plan')
    } finally {
      setIsLoading(false)
    }
  }

  const generatePlan = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate action plan')
      }
      // Refresh the plan
      await fetchPlan()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate action plan')
    } finally {
      setIsGenerating(false)
    }
  }

  const updateActionStatus = async (actionId: string, status: ActionItem['status']) => {
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        throw new Error('Failed to update action')
      }
      // Update local state
      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          actions: prev.actions.map(a =>
            a.id === actionId ? { ...a, status } : a
          ),
        }
      })
    } catch (err) {
      console.error('Error updating action:', err)
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

        {/* Generate CTA */}
        <div
          className="card flex flex-col items-center justify-center text-center"
          style={{ padding: '60px 40px' }}
        >
          <div
            className="flex items-center justify-center bg-[var(--green)]/10 border border-[var(--green)]/20"
            style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '24px' }}
          >
            <Lightbulb size={28} className="text-[var(--green)]" />
          </div>
          <h3 className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
            Generate Your Action Plan
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ maxWidth: '400px', marginBottom: '24px' }}>
            We'll analyze your scan results and create a personalized list of actions to improve your AI visibility.
          </p>
          {error && (
            <p className="text-[var(--red)] text-sm" style={{ marginBottom: '16px' }}>
              {error}
            </p>
          )}
          <button
            onClick={generatePlan}
            disabled={isGenerating}
            className="flex items-center gap-2 font-mono text-sm bg-[var(--green)] text-[var(--bg)] transition-all hover:opacity-90 disabled:opacity-50"
            style={{ padding: '12px 24px' }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate Action Plan
              </>
            )}
          </button>
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
  const isDismissed = action.status === 'dismissed'

  return (
    <div
      className={`bg-[var(--surface-elevated)] border transition-all ${
        isCompleted ? 'border-[var(--green)]/30 opacity-60' :
        isDismissed ? 'border-[var(--border)] opacity-40' :
        'border-[var(--border)]'
      }`}
      style={{ borderLeftWidth: '3px', borderLeftColor: isCompleted ? 'var(--green)' : accentColor }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        style={{ padding: '16px 20px' }}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status toggle */}
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
            style={{ width: '20px', height: '20px', borderRadius: '4px' }}
          >
            <Check size={12} />
          </button>

          <div className="flex-1 min-w-0">
            <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-[var(--text-dim)]' : 'text-[var(--text)]'}`}>
              {action.title}
            </h4>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '4px' }}>
              {action.category && (
                <span className="text-xs font-mono text-[var(--text-ghost)] bg-[var(--surface)] px-2 py-0.5">
                  {action.category}
                </span>
              )}
              {action.estimated_impact && (
                <span className={`text-xs font-mono ${
                  action.estimated_impact === 'high' ? 'text-[var(--green)]' :
                  action.estimated_impact === 'medium' ? 'text-[var(--text-mid)]' :
                  'text-[var(--text-dim)]'
                }`}>
                  {action.estimated_impact} impact
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && !isDismissed && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUpdateStatus(action.id, 'dismissed')
              }}
              className="p-1 text-[var(--text-ghost)] hover:text-[var(--text-dim)] transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-[var(--text-dim)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--text-dim)]" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '16px 20px', paddingLeft: '51px' }}
        >
          <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7' }}>
            {action.description}
          </p>

          {action.rationale && (
            <div
              className="bg-[var(--surface)] border-l-2 border-[var(--text-dim)]"
              style={{ marginTop: '16px', padding: '12px 16px' }}
            >
              <p className="text-[var(--text-dim)] text-xs" style={{ lineHeight: '1.6' }}>
                <strong className="text-[var(--text-mid)]">Why this matters:</strong> {action.rationale}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4" style={{ marginTop: '16px' }}>
            {action.target_page && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <ExternalLink size={12} />
                <span className="font-mono">{action.target_page}</span>
              </div>
            )}
            {action.target_keywords && action.target_keywords.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <Tag size={12} />
                <span className="font-mono">{action.target_keywords.slice(0, 3).join(', ')}</span>
              </div>
            )}
            {action.estimated_effort && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <Clock size={12} />
                <span>{action.estimated_effort} effort</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
