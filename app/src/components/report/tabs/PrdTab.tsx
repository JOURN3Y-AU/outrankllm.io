'use client'

import { useState, useEffect } from 'react'
import {
  FileCode,
  Zap,
  Target,
  Archive,
  Copy,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  Code,
  RefreshCw,
  Download,
  FileText,
  AlertCircle,
  History,
} from 'lucide-react'
import { EnrichmentLoading } from '../shared/EnrichmentLoading'

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

interface ContentPrompt {
  type: string
  prompt: string
  usedIn: string
  wordCount: number
}

interface PrdTask {
  id: string
  title: string
  description: string
  acceptance_criteria: string[] | null
  section: 'quick_wins' | 'strategic' | 'backlog'
  category: string | null
  priority: number
  estimated_hours: number | null
  file_paths: string[] | null
  code_snippets: Record<string, string> | null
  prompt_context: string | null
  implementation_notes: string | null
  requires_content?: boolean
  content_prompts?: ContentPrompt[] | null
  sort_order: number
  status?: 'pending' | 'completed' | 'dismissed'
  completed_at?: string | null
}

interface PrdDocument {
  id: string
  run_id: string
  title: string
  overview: string | null
  goals: string[] | null
  tech_stack: string[] | null
  target_platforms: string[] | null
  generated_at: string
  tasks: PrdTask[]
}

interface PrdHistoryItem {
  id: string
  original_task_id?: string | null  // The actual task ID this history entry refers to
  title: string
  description: string
  section: string
  category: string | null
  completed_at: string
}

interface PrdTabProps {
  runId?: string
  domainSubscriptionId?: string | null
  enrichmentStatus?: EnrichmentStatus
}

export function PrdTab({ runId, domainSubscriptionId, enrichmentStatus = 'not_applicable' }: PrdTabProps) {
  const [prd, setPrd] = useState<PrdDocument | null>(null)
  const [history, setHistory] = useState<PrdHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'quick_wins' | 'strategic' | 'backlog'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set())
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [taskExportDropdown, setTaskExportDropdown] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetchPrd()
  }, [runId, domainSubscriptionId])

  const fetchPrd = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (runId) params.set('run_id', runId)
      if (domainSubscriptionId) params.set('domain_subscription_id', domainSubscriptionId)
      const url = `/api/prd?${params}`
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch PRD')
      }
      const data = await res.json()
      setPrd(data.prd)
      setHistory(data.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PRD')
    } finally {
      setIsLoading(false)
    }
  }

  const generatePrd = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, domain_subscription_id: domainSubscriptionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate PRD')
      }
      await fetchPrd()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PRD')
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const exportAsMarkdown = () => {
    if (!prd) return

    let md = `# ${prd.title}\n\n`
    md += `## Overview\n\n${prd.overview}\n\n`

    if (prd.goals && prd.goals.length > 0) {
      md += `## Goals\n\n`
      prd.goals.forEach(goal => {
        md += `- ${goal}\n`
      })
      md += '\n'
    }

    if (prd.tech_stack && prd.tech_stack.length > 0) {
      md += `## Tech Stack\n\n${prd.tech_stack.join(', ')}\n\n`
    }

    const sections = [
      { key: 'quick_wins', title: 'Quick Wins' },
      { key: 'strategic', title: 'Strategic' },
      { key: 'backlog', title: 'Backlog' },
    ]

    sections.forEach(({ key, title }) => {
      const tasks = prd.tasks.filter(t => t.section === key)
      if (tasks.length > 0) {
        md += `## ${title}\n\n`
        tasks.forEach((task, i) => {
          md += `### ${i + 1}. ${task.title}\n\n`
          md += `${task.description}\n\n`

          if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
            md += `**Acceptance Criteria:**\n`
            task.acceptance_criteria.forEach(c => {
              md += `- [ ] ${c}\n`
            })
            md += '\n'
          }

          if (task.estimated_hours) {
            md += `**Estimated Time:** ${task.estimated_hours} hours\n\n`
          }

          if (task.file_paths && task.file_paths.length > 0) {
            md += `**Files:** \`${task.file_paths.join('`, `')}\`\n\n`
          }

          if (task.code_snippets) {
            Object.entries(task.code_snippets).forEach(([filename, code]) => {
              md += `**${filename}:**\n\`\`\`\n${code}\n\`\`\`\n\n`
            })
          }

          if (task.implementation_notes) {
            md += `> **Note:** ${task.implementation_notes}\n\n`
          }

          if (task.prompt_context) {
            md += `**AI Coding Context:**\n${task.prompt_context}\n\n`
          }

          // Content prompts section
          if (task.content_prompts && task.content_prompts.length > 0) {
            md += `**⚠️ Content Required:**\n`
            md += `This task requires the following content to be created before implementation:\n\n`
            task.content_prompts.forEach((prompt, i) => {
              md += `${i + 1}. **${prompt.type}** (~${prompt.wordCount} words)\n`
              md += `   - Prompt: ${prompt.prompt}\n`
              md += `   - Used in: ${prompt.usedIn}\n\n`
            })
          }

          md += '---\n\n'
        })
      }
    })

    // Download
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prd-${prd.id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export a single task as markdown
  const exportTaskAsMarkdown = (task: PrdTask) => {
    let md = `# ${task.title}\n\n`
    md += `${task.description}\n\n`

    if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
      md += `## Acceptance Criteria\n\n`
      task.acceptance_criteria.forEach(c => {
        md += `- [ ] ${c}\n`
      })
      md += '\n'
    }

    if (task.estimated_hours) {
      md += `**Estimated Time:** ${task.estimated_hours} hours\n\n`
    }

    if (task.file_paths && task.file_paths.length > 0) {
      md += `## Files to Modify\n\n`
      task.file_paths.forEach(path => {
        md += `- \`${path}\`\n`
      })
      md += '\n'
    }

    if (task.code_snippets) {
      md += `## Code Examples\n\n`
      Object.entries(task.code_snippets).forEach(([filename, code]) => {
        md += `### ${filename}\n\`\`\`\n${code}\n\`\`\`\n\n`
      })
    }

    if (task.implementation_notes) {
      md += `## Implementation Notes\n\n${task.implementation_notes}\n\n`
    }

    if (task.prompt_context) {
      md += `## AI Coding Context\n\n${task.prompt_context}\n\n`
    }

    // Content prompts section
    if (task.content_prompts && task.content_prompts.length > 0) {
      md += `## ⚠️ Content Required\n\n`
      md += `This task requires the following content to be created before implementation:\n\n`
      task.content_prompts.forEach((prompt, i) => {
        md += `### ${i + 1}. ${prompt.type}\n\n`
        md += `- **Word count:** ~${prompt.wordCount} words\n`
        md += `- **Used in:** ${prompt.usedIn}\n\n`
        md += `**Content prompt:**\n> ${prompt.prompt}\n\n`
      })
    }

    // Create filename from task title
    const safeTitle = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-${safeTitle}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Update task status
  const updateTaskStatus = async (taskId: string, status: 'pending' | 'completed' | 'dismissed') => {
    if (!prd) return

    // Find the task to get its details for history
    const task = prd.tasks.find(t => t.id === taskId)
    if (!task) return

    setUpdatingTasks(prev => new Set(prev).add(taskId))
    try {
      const res = await fetch(`/api/prd/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        throw new Error('Failed to update task')
      }

      // Update local prd state
      setPrd({
        ...prd,
        tasks: prd.tasks.map(t =>
          t.id === taskId
            ? { ...t, status, completed_at: status === 'completed' ? new Date().toISOString() : null }
            : t
        ),
      })

      // If marking as completed, add to local history for immediate feedback
      // (The API also adds it to the database)
      if (status === 'completed') {
        setHistory(prev => {
          // Check if already in history - check both id and original_task_id
          // (id matches locally-added items, original_task_id matches DB-fetched items)
          if (prev.some(h => h.id === taskId || h.original_task_id === taskId)) return prev
          return [
            {
              id: taskId,
              original_task_id: taskId,  // Set this so future checks work
              title: task.title,
              description: task.description,
              section: task.section,
              category: task.category,
              completed_at: new Date().toISOString(),
            },
            ...prev,
          ]
        })
      } else if (status === 'pending') {
        // If reopening a task, remove from local history - check both id and original_task_id
        setHistory(prev => prev.filter(h => h.id !== taskId && h.original_task_id !== taskId))
      }
    } catch (err) {
      console.error('Failed to update task:', err)
    } finally {
      setUpdatingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  // Mark all tasks as complete
  const markAllComplete = async () => {
    if (!prd) return

    try {
      const res = await fetch('/api/prd', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prd_id: prd.id,
          status: 'completed',
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to mark all complete')
      }

      const completedAt = new Date().toISOString()

      // Update local prd state
      setPrd({
        ...prd,
        tasks: prd.tasks.map(t => ({
          ...t,
          status: 'completed',
          completed_at: completedAt,
        })),
      })

      // Add all tasks to local history for immediate feedback
      const newHistoryItems = prd.tasks
        .filter(t => t.status !== 'completed') // Only add tasks that weren't already completed
        .filter(t => !history.some(h => h.id === t.id || h.original_task_id === t.id)) // Skip if already in history
        .map(t => ({
          id: t.id,
          original_task_id: t.id,  // Set this so future checks work
          title: t.title,
          description: t.description,
          section: t.section,
          category: t.category,
          completed_at: completedAt,
        }))

      if (newHistoryItems.length > 0) {
        setHistory(prev => [...newHistoryItems, ...prev])
      }

      setShowExportOptions(false)
    } catch (err) {
      console.error('Failed to mark all complete:', err)
    }
  }

  // Export and optionally mark all complete
  const handleExport = async (markComplete: boolean) => {
    exportAsMarkdown()
    if (markComplete) {
      await markAllComplete()
    }
    setShowExportOptions(false)
  }

  // Export a single task and optionally mark it complete
  const handleTaskExport = async (task: PrdTask, markComplete: boolean) => {
    exportTaskAsMarkdown(task)
    if (markComplete && task.status !== 'completed') {
      await updateTaskStatus(task.id, 'completed')
    }
    setTaskExportDropdown(null)
  }

  // Show enrichment loading states (takes precedence over local loading)
  if (enrichmentStatus === 'processing' || enrichmentStatus === 'pending') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status={enrichmentStatus}
          title="Generating Technical PRD"
          description="We're creating Claude Code / Cursor-ready implementation specs from your action plan. Each task includes code snippets and acceptance criteria."
          runId={runId}
        />
      </div>
    )
  }

  if (enrichmentStatus === 'failed') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status="failed"
          title="PRD Generation"
          description="We encountered an issue generating your PRD."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: '12px' }} />
        Loading PRD...
      </div>
    )
  }

  if (!prd) {
    return (
      <div style={{ display: 'grid', gap: '32px' }}>
        {/* Header */}
        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '20px 24px' }}
        >
          <div className="flex items-start" style={{ gap: '16px' }}>
            <FileCode size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
            <div>
              <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
                <strong className="text-[var(--text)]">Claude Code / Cursor Ready PRDs:</strong> Technical specifications are automatically generated from your action plan during scan enrichment.
              </p>
            </div>
          </div>
        </div>

        {/* Empty State - PRD will be generated automatically during enrichment */}
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
            PRD Coming Soon
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ maxWidth: '420px', marginBottom: '24px', lineHeight: '1.6' }}>
            Your PRD will be automatically generated on your next weekly scan. PRDs transform your action plan into ready-to-use implementation specs for Claude Code, Cursor, or other AI coding tools.
          </p>
          {error && (
            <p className="text-[var(--red)] text-sm" style={{ marginBottom: '16px' }}>
              {error}
            </p>
          )}
          <button
            onClick={generatePrd}
            disabled={isGenerating}
            className="flex items-center gap-2 font-mono text-sm border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--green)] transition-all"
            style={{ padding: '12px 24px' }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileCode size={16} />
                Generate Now
              </>
            )}
          </button>
          <p className="text-[var(--text-ghost)] text-xs font-mono" style={{ marginTop: '12px' }}>
            Or wait for your next scheduled scan
          </p>
        </div>
      </div>
    )
  }

  // Filter tasks by section and status
  let filteredTasks = filter === 'all'
    ? prd.tasks
    : prd.tasks.filter(t => t.section === filter)

  if (statusFilter !== 'all') {
    filteredTasks = filteredTasks.filter(t => (t.status || 'pending') === statusFilter)
  }

  // Group by section
  const quickWins = filteredTasks.filter(t => t.section === 'quick_wins')
  const strategic = filteredTasks.filter(t => t.section === 'strategic')
  const backlog = filteredTasks.filter(t => t.section === 'backlog')

  // Calculate totals
  const totalHours = prd.tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
  const completedCount = prd.tasks.filter(t => t.status === 'completed').length

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Context Section - What this is based on */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <FileCode size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Technical PRD & Specs:</strong> These implementation tasks are generated from your AI responses, competitor analysis, brand awareness data, and action plans. Designed to be pasted directly into Claude Code, Cursor, or other AI coding tools.
            </p>
          </div>
        </div>
      </div>

      {/* Header with title and export */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '24px' }}
      >
        <div className="flex items-start justify-between" style={{ gap: '16px' }}>
          <div className="flex items-start" style={{ gap: '16px' }}>
            <FileCode size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
            <div>
              <h2 className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
                {prd.title}
              </h2>
              <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7' }}>
                {prd.overview}
              </p>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              className="flex items-center gap-2 font-mono text-xs border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--green)] hover:border-[var(--green)] transition-colors"
              style={{ padding: '8px 12px' }}
            >
              <Download size={14} />
              Export .md
              <ChevronDown size={12} />
            </button>
            {showExportOptions && (
              <div
                className="absolute right-0 bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg z-10"
                style={{ top: '100%', marginTop: '4px', minWidth: '200px' }}
              >
                <button
                  onClick={() => handleExport(false)}
                  className="w-full text-left font-mono text-xs text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
                  style={{ padding: '12px 16px' }}
                >
                  <Download size={14} />
                  Export Only
                </button>
                <button
                  onClick={() => handleExport(true)}
                  className="w-full text-left font-mono text-xs text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
                  style={{ padding: '12px 16px' }}
                >
                  <CheckCircle size={14} className="text-[var(--green)]" />
                  Export & Mark All Complete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Goals */}
        {prd.goals && prd.goals.length > 0 && (
          <div style={{ marginTop: '20px', paddingLeft: '36px' }}>
            <h4 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
              Goals
            </h4>
            <ul className="text-[var(--text-mid)] text-sm" style={{ paddingLeft: '16px' }}>
              {prd.goals.map((goal, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>{goal}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tech stack */}
        {prd.tech_stack && prd.tech_stack.length > 0 && (
          <div className="flex items-center gap-2" style={{ marginTop: '16px', paddingLeft: '36px' }}>
            <span className="text-[var(--text-dim)] text-xs font-mono">Tech:</span>
            {prd.tech_stack.map(tech => (
              <span
                key={tech}
                className="text-xs font-mono bg-[var(--surface)] text-[var(--text-mid)] px-2 py-0.5"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tip Callout - matches ActionsTab style */}
      <div
        className="bg-[var(--gold)]/5 border border-[var(--gold)]/20"
        style={{ padding: '16px 20px', borderRadius: '4px' }}
      >
        <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
          <strong className="text-[var(--gold)]">How to use:</strong> Tick off tasks as you complete them using the checkbox.
          Export the full PRD or individual tasks as markdown to paste directly into Claude Code or Cursor.
          {history.length > 0
            ? ' Your progress is tracked in the Completed Tasks section below.'
            : ' Completed tasks will be archived after your next scan.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-5" style={{ gap: '16px' }}>
        {/* Progress */}
        <div
          className="card cursor-pointer transition-all"
          style={{ padding: '20px' }}
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'pending' : statusFilter === 'pending' ? 'completed' : 'all')}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <CheckCircle size={16} className="text-[var(--green)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Progress</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">
            {completedCount}/{prd.tasks.length}
          </p>
          {statusFilter !== 'all' && (
            <span className="text-[var(--text-ghost)] text-xs font-mono" style={{ marginTop: '4px', display: 'block' }}>
              Showing: {statusFilter}
            </span>
          )}
        </div>

        {/* Total Hours */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Clock size={16} className="text-[var(--text-dim)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Est. Hours</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">{totalHours}</p>
        </div>

        {/* Quick Wins */}
        <div
          className={`card cursor-pointer transition-all ${filter === 'quick_wins' ? 'border-[var(--green)]' : ''}`}
          style={{ padding: '20px' }}
          onClick={() => setFilter(filter === 'quick_wins' ? 'all' : 'quick_wins')}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Zap size={16} className="text-[var(--green)]" />
            <span className="text-[var(--text-dim)] text-xs font-mono uppercase">Quick Wins</span>
          </div>
          <p className="text-[var(--text)] font-mono text-2xl">
            {prd.tasks.filter(t => t.section === 'quick_wins').length}
          </p>
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
          <p className="text-[var(--text)] font-mono text-2xl">
            {prd.tasks.filter(t => t.section === 'strategic').length}
          </p>
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
          <p className="text-[var(--text)] font-mono text-2xl">
            {prd.tasks.filter(t => t.section === 'backlog').length}
          </p>
        </div>
      </div>

      {/* Tasks */}
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            {filter === 'all' ? 'All Tasks' : filter === 'quick_wins' ? 'Quick Wins' : filter === 'strategic' ? 'Strategic' : 'Backlog'}
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
          <TaskSection
            title="Quick Wins"
            icon={<Zap size={16} className="text-[var(--green)]" />}
            color="var(--green)"
            tasks={quickWins}
            expandedTasks={expandedTasks}
            onToggleExpand={toggleExpanded}
            onCopy={copyToClipboard}
            copiedId={copiedId}
            onStatusChange={updateTaskStatus}
            onTaskExport={handleTaskExport}
            updatingTasks={updatingTasks}
            taskExportDropdown={taskExportDropdown}
            setTaskExportDropdown={setTaskExportDropdown}
          />
        )}

        {/* Strategic Section */}
        {strategic.length > 0 && filter === 'all' && (
          <TaskSection
            title="Strategic"
            icon={<Target size={16} className="text-[var(--blue)]" />}
            color="var(--blue)"
            tasks={strategic}
            expandedTasks={expandedTasks}
            onToggleExpand={toggleExpanded}
            onCopy={copyToClipboard}
            copiedId={copiedId}
            onStatusChange={updateTaskStatus}
            onTaskExport={handleTaskExport}
            updatingTasks={updatingTasks}
            taskExportDropdown={taskExportDropdown}
            setTaskExportDropdown={setTaskExportDropdown}
            style={{ marginTop: quickWins.length > 0 ? '32px' : '0' }}
          />
        )}

        {/* Backlog Section */}
        {backlog.length > 0 && filter === 'all' && (
          <TaskSection
            title="Backlog"
            icon={<Archive size={16} className="text-[var(--text-dim)]" />}
            color="var(--text-dim)"
            tasks={backlog}
            expandedTasks={expandedTasks}
            onToggleExpand={toggleExpanded}
            onCopy={copyToClipboard}
            copiedId={copiedId}
            onStatusChange={updateTaskStatus}
            onTaskExport={handleTaskExport}
            updatingTasks={updatingTasks}
            taskExportDropdown={taskExportDropdown}
            setTaskExportDropdown={setTaskExportDropdown}
            style={{ marginTop: (quickWins.length > 0 || strategic.length > 0) ? '32px' : '0' }}
          />
        )}

        {/* Filtered view */}
        {filter !== 'all' && (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedTasks.has(task.id)}
                onToggleExpand={() => toggleExpanded(task.id)}
                onCopy={copyToClipboard}
                copiedId={copiedId}
                onStatusChange={updateTaskStatus}
                onTaskExport={handleTaskExport}
                isUpdating={updatingTasks.has(task.id)}
                showExportDropdown={taskExportDropdown === task.id}
                setShowExportDropdown={(show) => setTaskExportDropdown(show ? task.id : null)}
              />
            ))}
          </div>
        )}

        {filteredTasks.length === 0 && (
          <p className="text-[var(--text-dim)] text-sm text-center" style={{ padding: '40px 0' }}>
            No tasks in this category.
          </p>
        )}
      </div>

      {/* Completed Tasks History Section */}
      {history.length > 0 && (
        <div className="card" style={{ padding: '24px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <History size={16} className="text-[var(--green)]" />
              <span className="text-[var(--text-mid)] font-mono text-sm">Completed Tasks</span>
              <span className="text-[var(--text-ghost)] text-xs">({history.length})</span>
            </div>
            {showHistory ? (
              <ChevronUp size={16} className="text-[var(--text-dim)]" />
            ) : (
              <ChevronDown size={16} className="text-[var(--text-dim)]" />
            )}
          </button>

          {showHistory && (
            <div style={{ marginTop: '20px' }}>
              {/* Explanation */}
              <div
                className="bg-[var(--green)]/5 border-l-2 border-[var(--green)]"
                style={{ marginBottom: '20px', padding: '12px 16px' }}
              >
                <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
                  Tasks you've completed are tracked here. Similar tasks won't be regenerated in future scans.
                </p>
              </div>

              {/* History items */}
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
                        {item.description && (
                          <p className="text-[var(--text-dim)] text-xs" style={{ marginTop: '4px', lineHeight: '1.5' }}>
                            {item.description.length > 120 ? `${item.description.slice(0, 120)}...` : item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                          {item.section && (
                            <span className="text-xs font-mono text-[var(--text-ghost)] bg-[var(--surface-elevated)] px-2 py-0.5">
                              {item.section === 'quick_wins' ? 'Quick Win' : item.section === 'strategic' ? 'Strategic' : 'Backlog'}
                            </span>
                          )}
                          {item.category && (
                            <span className="text-xs font-mono text-[var(--text-ghost)] bg-[var(--surface-elevated)] px-2 py-0.5">
                              {item.category}
                            </span>
                          )}
                          {item.completed_at && (
                            <span className="text-[var(--text-ghost)] text-xs">
                              Completed {formatDate(item.completed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`

  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TaskSection({
  title,
  icon,
  color,
  tasks,
  expandedTasks,
  onToggleExpand,
  onCopy,
  copiedId,
  onStatusChange,
  onTaskExport,
  updatingTasks,
  taskExportDropdown,
  setTaskExportDropdown,
  style = {},
}: {
  title: string
  icon: React.ReactNode
  color: string
  tasks: PrdTask[]
  expandedTasks: Set<string>
  onToggleExpand: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
  onStatusChange: (taskId: string, status: 'pending' | 'completed' | 'dismissed') => void
  onTaskExport: (task: PrdTask, markComplete: boolean) => void
  updatingTasks: Set<string>
  taskExportDropdown: string | null
  setTaskExportDropdown: (id: string | null) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
        {icon}
        <span className="text-[var(--text-mid)] font-mono text-sm">{title}</span>
        <span className="text-[var(--text-ghost)] text-xs">({tasks.length})</span>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isExpanded={expandedTasks.has(task.id)}
            onToggleExpand={() => onToggleExpand(task.id)}
            onCopy={onCopy}
            copiedId={copiedId}
            accentColor={color}
            onStatusChange={onStatusChange}
            onTaskExport={onTaskExport}
            isUpdating={updatingTasks.has(task.id)}
            showExportDropdown={taskExportDropdown === task.id}
            setShowExportDropdown={(show) => setTaskExportDropdown(show ? task.id : null)}
          />
        ))}
      </div>
    </div>
  )
}

function TaskCard({
  task,
  isExpanded,
  onToggleExpand,
  onCopy,
  copiedId,
  accentColor = 'var(--green)',
  onStatusChange,
  onTaskExport,
  isUpdating = false,
  showExportDropdown = false,
  setShowExportDropdown,
}: {
  task: PrdTask
  isExpanded: boolean
  onToggleExpand: () => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
  accentColor?: string
  onStatusChange?: (taskId: string, status: 'pending' | 'completed' | 'dismissed') => void
  onTaskExport?: (task: PrdTask, markComplete: boolean) => void
  isUpdating?: boolean
  showExportDropdown?: boolean
  setShowExportDropdown?: (show: boolean) => void
}) {
  const isCompleted = task.status === 'completed'

  return (
    <div
      className={`bg-[var(--surface-elevated)] border border-[var(--border)] ${isCompleted ? 'opacity-60' : ''}`}
      style={{ borderLeftWidth: '3px', borderLeftColor: isCompleted ? 'var(--green)' : accentColor, minWidth: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        style={{ padding: '16px 20px' }}
        onClick={onToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${isCompleted ? 'text-[var(--text-dim)] line-through' : 'text-[var(--text)]'}`}>
            {task.title}
          </h4>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '6px' }}>
            {task.requires_content && (
              <span className="text-xs font-mono text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-2 py-0.5 flex items-center gap-1">
                <FileText size={10} />
                Requires Content
              </span>
            )}
            {task.category && (
              <span className="text-xs font-mono text-[var(--text-ghost)] bg-[var(--surface)] px-2 py-0.5">
                {task.category}
              </span>
            )}
            {task.estimated_hours && (
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                <Clock size={12} />
                {task.estimated_hours}h
              </span>
            )}
            {task.file_paths && task.file_paths.length > 0 && (
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                <FolderOpen size={12} />
                {task.file_paths.length} file{task.file_paths.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Export single task dropdown */}
          {onTaskExport && setShowExportDropdown && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowExportDropdown(!showExportDropdown)
                }}
                className="text-[var(--text-ghost)] hover:text-[var(--green)] transition-colors"
                title="Export this task as .md"
              >
                <Download size={14} />
              </button>
              {showExportDropdown && (
                <div
                  className="absolute right-0 bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg z-10"
                  style={{ top: '100%', marginTop: '4px', minWidth: '180px' }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskExport(task, false)
                    }}
                    className="w-full text-left font-mono text-xs text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
                    style={{ padding: '10px 12px' }}
                  >
                    <Download size={12} />
                    Export Only
                  </button>
                  {!isCompleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskExport(task, true)
                      }}
                      className="w-full text-left font-mono text-xs text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
                      style={{ padding: '10px 12px' }}
                    >
                      <CheckCircle size={12} className="text-[var(--green)]" />
                      Export & Complete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expand/collapse chevron */}
          {isExpanded ? (
            <ChevronUp size={16} className="text-[var(--text-dim)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--text-dim)]" />
          )}

          {/* Completion checkbox - on the right, matches ActionsTab style */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onStatusChange) {
                onStatusChange(task.id, isCompleted ? 'pending' : 'completed')
              }
            }}
            disabled={isUpdating}
            className={`flex-shrink-0 flex items-center justify-center border transition-all ${
              isCompleted
                ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]'
                : 'border-[var(--border)] hover:border-[var(--green)] text-transparent hover:text-[var(--green)]/50'
            }`}
            style={{ width: '24px', height: '24px', borderRadius: '4px' }}
            title={isCompleted ? 'Mark as not done' : 'Mark as done'}
          >
            {isUpdating ? (
              <RefreshCw size={14} className="animate-spin text-[var(--text-dim)]" />
            ) : (
              <Check size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '20px', minWidth: 0, overflow: 'hidden' }}
        >
          <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7' }}>
            {task.description}
          </p>

          {/* Acceptance Criteria */}
          {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
                Acceptance Criteria
              </h5>
              <ul className="text-[var(--text-mid)] text-sm" style={{ paddingLeft: '20px' }}>
                {task.acceptance_criteria.map((criterion, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* File paths */}
          {task.file_paths && task.file_paths.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
                Files to Modify
              </h5>
              <div className="flex flex-wrap gap-2">
                {task.file_paths.map(path => (
                  <code
                    key={path}
                    className="text-xs bg-[var(--surface)] text-[var(--green)] px-2 py-1"
                  >
                    {path}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Code snippets */}
          {task.code_snippets && Object.keys(task.code_snippets).length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase" style={{ marginBottom: '8px' }}>
                Code Examples
              </h5>
              {Object.entries(task.code_snippets).map(([filename, code]) => (
                <div key={filename} style={{ marginTop: '12px' }}>
                  <div className="flex items-center justify-between bg-[var(--surface)] border-b border-[var(--border)]" style={{ padding: '8px 12px' }}>
                    <span className="text-xs font-mono text-[var(--text-mid)]">{filename}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCopy(code, `${task.id}-${filename}`)
                      }}
                      className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
                    >
                      {copiedId === `${task.id}-${filename}` ? (
                        <>
                          <Check size={12} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre
                    className="bg-[var(--surface)] text-[var(--text-mid)] text-xs overflow-x-auto"
                    style={{ padding: '12px', margin: 0, maxWidth: '100%' }}
                  >
                    <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Implementation notes */}
          {task.implementation_notes && (
            <div
              className="bg-[var(--surface)] border-l-2 border-[var(--green)]"
              style={{ marginTop: '20px', padding: '12px 16px' }}
            >
              <p className="text-[var(--text-dim)] text-xs" style={{ lineHeight: '1.6' }}>
                <strong className="text-[var(--text-mid)]">Implementation Note:</strong> {task.implementation_notes}
              </p>
            </div>
          )}

          {/* Content prompts - placeholder content that needs to be created */}
          {task.content_prompts && task.content_prompts.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div
                className="bg-[var(--gold)]/5 border border-[var(--gold)]/30"
                style={{ padding: '16px', borderRadius: '4px' }}
              >
                <div className="flex items-start gap-2" style={{ marginBottom: '12px' }}>
                  <AlertCircle size={16} className="text-[var(--gold)] flex-shrink-0" style={{ marginTop: '2px' }} />
                  <div>
                    <h5 className="text-[var(--gold)] font-medium text-sm" style={{ marginBottom: '4px' }}>
                      Content Required
                    </h5>
                    <p className="text-[var(--text-mid)] text-xs" style={{ lineHeight: '1.5' }}>
                      This task requires {task.content_prompts.length} content placeholder{task.content_prompts.length > 1 ? 's' : ''} to be created before implementation.
                      Generate the content below, then proceed with the code implementation.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {task.content_prompts.map((prompt, i) => (
                    <div
                      key={i}
                      className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                      style={{ padding: '12px 16px' }}
                    >
                      <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5">
                            {prompt.type}
                          </span>
                          <span className="text-xs text-[var(--text-ghost)]">
                            ~{prompt.wordCount} words
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onCopy(prompt.prompt, `${task.id}-content-${i}`)
                          }}
                          className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
                        >
                          {copiedId === `${task.id}-content-${i}` ? (
                            <>
                              <Check size={12} />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6', marginBottom: '8px' }}>
                        {prompt.prompt}
                      </p>
                      <p className="text-[var(--text-ghost)] text-xs">
                        <strong>Used in:</strong> {prompt.usedIn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prompt context for AI coding tools */}
          {task.prompt_context && (
            <div style={{ marginTop: '20px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <h5 className="text-[var(--text-dim)] text-xs font-mono uppercase flex items-center gap-1">
                  <Code size={12} />
                  AI Coding Context
                </h5>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy(task.prompt_context!, `${task.id}-context`)
                  }}
                  className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
                >
                  {copiedId === `${task.id}-context` ? (
                    <>
                      <Check size={12} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy for Claude/Cursor
                    </>
                  )}
                </button>
              </div>
              <p className="text-[var(--text-mid)] text-sm bg-[var(--surface)]" style={{ padding: '12px', lineHeight: '1.6', wordBreak: 'break-word' }}>
                {task.prompt_context}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
