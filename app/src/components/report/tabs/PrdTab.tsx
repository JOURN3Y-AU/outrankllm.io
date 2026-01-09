'use client'

import { useState, useEffect } from 'react'
import {
  FileCode,
  Zap,
  Target,
  Archive,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  Code,
  RefreshCw,
  Download,
} from 'lucide-react'

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
  sort_order: number
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

export function PrdTab({ runId }: { runId?: string }) {
  const [prd, setPrd] = useState<PrdDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'quick_wins' | 'strategic' | 'backlog'>('all')

  useEffect(() => {
    fetchPrd()
  }, [runId])

  const fetchPrd = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = runId ? `/api/prd?run_id=${runId}` : '/api/prd'
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch PRD')
      }
      const data = await res.json()
      setPrd(data.prd)
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
        body: JSON.stringify({ run_id: runId }),
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
                <strong className="text-[var(--text)]">Claude Code / Cursor Ready PRDs:</strong> Generate technical specifications that can be directly used with AI coding assistants to implement improvements.
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
            <FileCode size={28} className="text-[var(--green)]" />
          </div>
          <h3 className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
            Generate Your PRD
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ maxWidth: '400px', marginBottom: '24px' }}>
            Create a detailed product requirements document with implementation tasks ready for Claude Code, Cursor, or other AI coding tools.
          </p>
          {error && (
            <p className="text-[var(--red)] text-sm" style={{ marginBottom: '16px' }}>
              {error}
            </p>
          )}
          <button
            onClick={generatePrd}
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
                <FileCode size={16} />
                Generate PRD
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // Filter tasks
  const filteredTasks = filter === 'all'
    ? prd.tasks
    : prd.tasks.filter(t => t.section === filter)

  // Group by section
  const quickWins = filteredTasks.filter(t => t.section === 'quick_wins')
  const strategic = filteredTasks.filter(t => t.section === 'strategic')
  const backlog = filteredTasks.filter(t => t.section === 'backlog')

  // Calculate totals
  const totalHours = prd.tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0)

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
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
          <button
            onClick={exportAsMarkdown}
            className="flex-shrink-0 flex items-center gap-2 font-mono text-xs border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--green)] hover:border-[var(--green)] transition-colors"
            style={{ padding: '8px 12px' }}
          >
            <Download size={14} />
            Export .md
          </button>
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

      {/* Stats */}
      <div className="grid sm:grid-cols-4" style={{ gap: '16px' }}>
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
    </div>
  )
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
}: {
  task: PrdTask
  isExpanded: boolean
  onToggleExpand: () => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
  accentColor?: string
}) {
  return (
    <div
      className="bg-[var(--surface-elevated)] border border-[var(--border)]"
      style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        style={{ padding: '16px 20px' }}
        onClick={onToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-[var(--text)]">
            {task.title}
          </h4>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '6px' }}>
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
        {isExpanded ? (
          <ChevronUp size={16} className="text-[var(--text-dim)]" />
        ) : (
          <ChevronDown size={16} className="text-[var(--text-dim)]" />
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '20px' }}
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
                    style={{ padding: '12px', margin: 0 }}
                  >
                    <code>{code}</code>
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
              <p className="text-[var(--text-mid)] text-sm bg-[var(--surface)]" style={{ padding: '12px', lineHeight: '1.6' }}>
                {task.prompt_context}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
