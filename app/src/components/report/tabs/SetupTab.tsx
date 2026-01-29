'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Globe, Lock, Sparkles, Lightbulb, Pencil, Plus, X, Check, Trash2, ChevronDown, RotateCcw, Bot, User, Library, CheckCircle, History } from 'lucide-react'
import type { Analysis, Prompt, PlatformData } from '../shared'
import { Monitor, Code, BarChart3, MessageSquare, FileText, AlertTriangle, Cpu, Info } from 'lucide-react'
import { handlePricingClick, categoryLabels, categoryColors, selectableCategories } from '../shared'

// Simple tooltip component
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={10} className="text-[var(--text-ghost)]" />
      {show && (
        <span
          className="absolute z-50 bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-mid)] text-xs"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '8px 12px',
            width: '220px',
            lineHeight: '1.5',
            whiteSpace: 'normal',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {text}
          {/* Arrow */}
          <span
            className="absolute border-[var(--border)]"
            style={{
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--surface-elevated)',
            }}
          />
        </span>
      )}
    </span>
  )
}

interface EditableQuestion {
  id: string
  prompt_text: string
  category: string
  source?: 'ai_generated' | 'user_created'
  isCustom?: boolean
  isEditing?: boolean
}

interface HistoryEntry {
  id: string
  question_id: string
  prompt_text: string
  version: number
  created_at: string
}

interface LibraryQuestion {
  id: string
  prompt_text: string
  category: string
  source: 'ai_generated' | 'user_created'
  is_active: boolean
  is_archived: boolean
  created_at: string
  source_run_id: string | null
}

// Custom dropdown component that matches site styling
function CategoryDropdown({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = selectableCategories.find(c => c.value === value)?.label || 'Select type'

  return (
    <div ref={dropdownRef} className="relative" style={{ minWidth: '160px' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] text-[var(--text-mid)] text-xs font-mono transition-colors hover:border-[var(--text-dim)] disabled:opacity-50"
        style={{ padding: '8px 12px' }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-[var(--text-dim)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg"
          style={{ top: '100%', left: 0, marginTop: '4px' }}
        >
          {selectableCategories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => {
                onChange(cat.value)
                setIsOpen(false)
              }}
              className={`w-full text-left text-xs font-mono transition-colors ${
                value === cat.value
                  ? 'bg-[var(--green)]/10 text-[var(--green)]'
                  : 'text-[var(--text-mid)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
              }`}
              style={{ padding: '10px 12px' }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Question Library modal - shows all questions grouped by category with source badges
// Can be used as a picker (mode='pick') or browser (mode='browse')
function QuestionLibraryModal({
  activeQuestionIds,
  onClose,
  onRestoreQuestion,
  onSelectQuestion,
  mode = 'browse',
}: {
  activeQuestionIds: string[]
  onClose: () => void
  onRestoreQuestion?: (question: LibraryQuestion) => void
  onSelectQuestion?: (question: LibraryQuestion) => void
  mode?: 'browse' | 'pick'
}) {
  const [library, setLibrary] = useState<Record<string, LibraryQuestion[]>>({})
  const [counts, setCounts] = useState({ total: 0, active: 0, archived: 0, aiGenerated: 0, userCreated: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ai_generated' | 'user_created' | 'archived'>('all')
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Fetch library on mount
  useEffect(() => {
    async function fetchLibrary() {
      try {
        const res = await fetch('/api/questions/library')
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to fetch library')
        }
        const data = await res.json()
        setLibrary(data.questions || {})
        setCounts(data.counts || { total: 0, active: 0, archived: 0, aiGenerated: 0, userCreated: 0 })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load library')
      } finally {
        setIsLoading(false)
      }
    }
    fetchLibrary()
  }, [])

  const handleRestore = async (question: LibraryQuestion) => {
    if (!onRestoreQuestion) return

    setIsRestoring(true)
    setError(null)

    try {
      const res = await fetch(`/api/questions/${question.id}/restore`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to restore')
      }

      onRestoreQuestion(question)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore')
    } finally {
      setIsRestoring(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Filter questions based on selected filter
  const getFilteredQuestions = () => {
    const allQuestions: LibraryQuestion[] = Object.values(library).flat()

    switch (filter) {
      case 'ai_generated':
        return allQuestions.filter(q => q.source === 'ai_generated')
      case 'user_created':
        return allQuestions.filter(q => q.source === 'user_created')
      case 'archived':
        return allQuestions.filter(q => q.is_archived)
      default:
        return allQuestions
    }
  }

  // Group filtered questions by category
  const getGroupedQuestions = () => {
    const filtered = getFilteredQuestions()
    const grouped: Record<string, LibraryQuestion[]> = {}

    for (const q of filtered) {
      const category = q.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(q)
    }

    return grouped
  }

  const groupedQuestions = getGroupedQuestions()
  const categoryOrder = ['finding_provider', 'product_specific', 'service', 'comparison', 'review', 'how_to', 'other', 'custom', 'general']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: '24px', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        ref={modalRef}
        className="bg-[var(--surface)] border border-[var(--border)] w-full shadow-xl"
        style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-[var(--border)]"
          style={{ padding: '20px 24px' }}
        >
          <div className="flex items-center gap-3">
            <Library size={20} className="text-[var(--green)]" />
            <div>
              <h3 className="font-medium text-[var(--text)]">
                {mode === 'pick' ? 'Select a Question' : 'Question Library'}
              </h3>
              <p className="text-xs text-[var(--text-dim)]" style={{ marginTop: '2px' }}>
                {mode === 'pick'
                  ? 'Click on a question to use it'
                  : `${counts.total} questions • ${counts.aiGenerated} AI-generated • ${counts.userCreated} custom`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-2 border-b border-[var(--border)]"
          style={{ padding: '12px 24px' }}
        >
          {[
            { id: 'all', label: 'All', count: counts.total },
            { id: 'ai_generated', label: 'AI Generated', count: counts.aiGenerated },
            { id: 'user_created', label: 'Custom', count: counts.userCreated },
            { id: 'archived', label: 'Archived', count: counts.archived },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`font-mono text-xs transition-colors ${
                filter === tab.id
                  ? 'text-[var(--green)] bg-[var(--green)]/10'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              style={{ padding: '6px 12px' }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              className="bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] text-sm"
              style={{ padding: '12px 16px', marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center text-[var(--text-dim)]" style={{ padding: '40px 0' }}>
              <div className="animate-pulse">Loading library...</div>
            </div>
          ) : Object.keys(groupedQuestions).length === 0 ? (
            <div className="text-center text-[var(--text-dim)]" style={{ padding: '40px 0' }}>
              <Library size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No questions found.</p>
              <p className="text-xs mt-2">Questions will appear here as you create and edit them.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '24px' }}>
              {categoryOrder
                .filter(cat => groupedQuestions[cat]?.length > 0)
                .map((category) => (
                  <div key={category}>
                    {/* Category header */}
                    <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
                      <span
                        className="font-mono text-xs uppercase tracking-wider"
                        style={{ color: categoryColors[category] || 'var(--text-dim)' }}
                      >
                        {categoryLabels[category] || category}
                      </span>
                      <span className="text-xs text-[var(--text-ghost)]">
                        ({groupedQuestions[category].length})
                      </span>
                    </div>

                    {/* Questions in category */}
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {groupedQuestions[category].map((question) => {
                        const isActive = activeQuestionIds.includes(question.id)
                        const isClickable = mode === 'pick' && !question.is_archived

                        return (
                          <div
                            key={question.id}
                            onClick={isClickable ? () => {
                              onSelectQuestion?.(question)
                              onClose()
                            } : undefined}
                            className={`bg-[var(--surface-elevated)] border ${
                              isActive ? 'border-[var(--green)]/30' : 'border-[var(--border)]'
                            } ${question.is_archived ? 'opacity-60' : ''} ${
                              isClickable ? 'cursor-pointer hover:border-[var(--green)] hover:bg-[var(--green)]/5 transition-colors' : ''
                            }`}
                            style={{ padding: '12px 16px' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[var(--text-mid)]" style={{ lineHeight: '1.5' }}>
                                  {question.prompt_text}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '8px' }}>
                                  {/* Source badge */}
                                  {question.source === 'ai_generated' ? (
                                    <span
                                      className="flex items-center gap-1 font-mono text-xs bg-[var(--blue)]/10 text-[var(--blue)]"
                                      style={{ padding: '2px 6px' }}
                                    >
                                      <Bot size={10} />
                                      AI Generated
                                    </span>
                                  ) : (
                                    <span
                                      className="flex items-center gap-1 font-mono text-xs bg-[var(--green)]/10 text-[var(--green)]"
                                      style={{ padding: '2px 6px' }}
                                    >
                                      <User size={10} />
                                      Custom
                                    </span>
                                  )}

                                  {/* Active badge */}
                                  {isActive && (
                                    <span
                                      className="flex items-center gap-1 font-mono text-xs text-[var(--green)]"
                                      style={{ padding: '2px 6px' }}
                                    >
                                      <CheckCircle size={10} />
                                      Active
                                    </span>
                                  )}

                                  {/* Archived badge */}
                                  {question.is_archived && (
                                    <span
                                      className="font-mono text-xs text-[var(--text-ghost)]"
                                      style={{ padding: '2px 6px' }}
                                    >
                                      Archived
                                    </span>
                                  )}

                                  {/* Date */}
                                  <span className="text-xs text-[var(--text-ghost)]">
                                    {formatDate(question.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Restore button for archived questions (only in browse mode) */}
                              {mode === 'browse' && question.is_archived && onRestoreQuestion && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRestore(question)
                                  }}
                                  disabled={isRestoring}
                                  className="flex items-center gap-1 font-mono text-xs text-[var(--text-dim)] hover:text-[var(--green)] transition-colors disabled:opacity-50 flex-shrink-0"
                                  title="Restore this question"
                                >
                                  <RotateCcw size={14} />
                                  Restore
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '16px 24px' }}
        >
          <button
            onClick={onClose}
            className="w-full font-mono text-sm text-[var(--text-dim)] border border-[var(--border)] transition-colors hover:text-[var(--text)] hover:border-[var(--text-dim)]"
            style={{ padding: '12px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Question History modal - shows version history for a specific question
function QuestionHistoryModal({
  questionId,
  currentText,
  onClose,
  onRevert,
}: {
  questionId: string
  currentText: string
  onClose: () => void
  onRevert: (newText: string) => void
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReverting, setIsReverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Fetch history on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/questions/${questionId}/history`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to fetch history')
        }
        const data = await res.json()
        setHistory(data.history || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        setIsLoading(false)
      }
    }
    fetchHistory()
  }, [questionId])

  const handleRevert = async (version: number, promptText: string) => {
    setIsReverting(true)
    setError(null)

    try {
      const res = await fetch(`/api/questions/${questionId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to revert')
      }

      onRevert(promptText)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert')
    } finally {
      setIsReverting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: '24px', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        ref={modalRef}
        className="bg-[var(--surface)] border border-[var(--border)] w-full shadow-xl"
        style={{ maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-[var(--border)]"
          style={{ padding: '20px 24px' }}
        >
          <div className="flex items-center gap-3">
            <History size={20} className="text-[var(--green)]" />
            <h3 className="font-medium text-[var(--text)]">Question History</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              className="bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] text-sm"
              style={{ padding: '12px 16px', marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center text-[var(--text-dim)]" style={{ padding: '40px 0' }}>
              <div className="animate-pulse">Loading history...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-[var(--text-dim)]" style={{ padding: '40px 0' }}>
              <History size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No previous versions yet.</p>
              <p className="text-xs mt-2">Edit this question to create history.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Current version */}
              <div
                className="bg-[var(--surface-elevated)] border border-[var(--green)]/30"
                style={{ padding: '16px' }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                  <span className="font-mono text-xs text-[var(--green)]">Current Version</span>
                </div>
                <p className="text-sm text-[var(--text-mid)]" style={{ lineHeight: '1.5' }}>
                  {currentText}
                </p>
              </div>

              {/* Previous versions */}
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                  style={{ padding: '16px' }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      Version {entry.version} • {formatDate(entry.created_at)}
                    </span>
                    <button
                      onClick={() => handleRevert(entry.version, entry.prompt_text)}
                      disabled={isReverting}
                      className="flex items-center gap-1 font-mono text-xs text-[var(--text-dim)] hover:text-[var(--green)] transition-colors disabled:opacity-50"
                      title="Revert to this version"
                    >
                      <RotateCcw size={14} />
                      Revert
                    </button>
                  </div>
                  <p className="text-sm text-[var(--text-mid)]" style={{ lineHeight: '1.5' }}>
                    {entry.prompt_text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="border-t border-[var(--border)]"
          style={{ padding: '16px 24px' }}
        >
          <button
            onClick={onClose}
            className="w-full font-mono text-sm text-[var(--text-dim)] border border-[var(--border)] transition-colors hover:text-[var(--text)] hover:border-[var(--text-dim)]"
            style={{ padding: '12px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function SetupTab({
  analysis,
  prompts,
  domain,
  domainSubscriptionId,
  isSubscriber = false,
  customQuestionLimit = 0,
  platformData,
}: {
  analysis: Analysis | null
  prompts?: Prompt[] | null
  domain: string
  domainSubscriptionId?: string | null
  isSubscriber?: boolean
  customQuestionLimit?: number
  platformData?: PlatformData | null
}) {
  // Suppress unused variable warnings
  void domain
  // State for editable questions
  const [questions, setQuestions] = useState<EditableQuestion[]>(() =>
    (prompts || []).map(p => ({
      id: p.id,
      prompt_text: p.prompt_text,
      category: p.category,
      isCustom: false,
    }))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newQuestionCategory, setNewQuestionCategory] = useState('other')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState<'edit' | 'add' | null>(null)

  // Fetch fresh questions from API when component mounts (for subscribers)
  // This ensures we have the latest data after tab switches, not stale SSR data
  useEffect(() => {
    if (!isSubscriber) return

    const fetchQuestions = async () => {
      try {
        // Pass domain_subscription_id for multi-domain isolation
        const url = domainSubscriptionId
          ? `/api/questions?domain_subscription_id=${domainSubscriptionId}`
          : '/api/questions'
        const res = await fetch(url)
        if (!res.ok) return

        const data = await res.json()
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions.map((q: { id: string; prompt_text: string; category: string; source?: string }) => ({
            id: q.id,
            prompt_text: q.prompt_text,
            category: q.category,
            source: q.source,
            isCustom: q.source === 'user_created',
          })))
        }
      } catch (err) {
        // Silently fail - we still have the SSR data as fallback
        console.error('Failed to fetch fresh questions:', err)
      }
    }

    fetchQuestions()
  }, [isSubscriber, domainSubscriptionId])

  if (!analysis) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Settings size={48} className="mx-auto mb-4 opacity-30" />
        <p>No analysis data available</p>
      </div>
    )
  }

  const canAddMore = questions.length < customQuestionLimit

  const handleStartEdit = (question: EditableQuestion) => {
    setEditingId(question.id)
    setEditText(question.prompt_text)
    setEditCategory(question.category)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditCategory('')
    setError(null)
  }

  const handleSaveEdit = async (questionId: string) => {
    if (!editText.trim()) {
      setError('Question cannot be empty')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_text: editText.trim(),
          category: editCategory,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      // Update local state
      setQuestions(prev =>
        prev.map(q =>
          q.id === questionId
            ? { ...q, prompt_text: editText.trim(), category: editCategory }
            : q
        )
      )
      setEditingId(null)
      setEditText('')
      setEditCategory('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) {
      setError('Question cannot be empty')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_text: newQuestionText.trim(),
          category: newQuestionCategory,
          domain_subscription_id: domainSubscriptionId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add question')
      }

      const data = await res.json()

      // Add to local state
      setQuestions(prev => [
        ...prev,
        {
          id: data.question.id,
          prompt_text: data.question.prompt_text,
          category: data.question.category,
          isCustom: true,
        },
      ])
      setNewQuestionText('')
      setNewQuestionCategory('other')
      setIsAddingNew(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }

      // Remove from local state
      setQuestions(prev => prev.filter(q => q.id !== questionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Settings size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Your Report Configuration:</strong> We crawled your website and extracted key information about your business. This data powers the questions we ask AI assistants.
              {isSubscriber
                ? ' You can customize these questions below.'
                : ' Subscribers can edit and customize these settings.'}
            </p>
          </div>
        </div>
      </div>

      {/* What We Detected */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          What We Detected
        </h3>

        {/* AI Readability Warning - shown prominently at top if issues */}
        {platformData?.has_ai_readability_issues && (
          <div
            className="bg-[var(--red)]/10 border border-[var(--red)]/30"
            style={{ padding: '16px 20px', marginBottom: '24px' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-[var(--red)] flex-shrink-0" style={{ marginTop: '2px' }} />
              <div>
                <p className="text-[var(--red)] text-sm font-medium">AI Readability Issue Detected</p>
                <p className="text-[var(--text-dim)] text-sm" style={{ marginTop: '6px', lineHeight: '1.5' }}>
                  {platformData.ai_readability_issues?.[0] || 'Your site may not be fully readable by AI assistants due to client-side rendering.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Business Identity - Featured at top */}
        {analysis.business_name && (
          <div style={{ marginBottom: '28px' }}>
            <p className="text-[var(--text)] font-medium" style={{ fontSize: '1.5rem', lineHeight: '1.3' }}>
              {analysis.business_name}
            </p>
            <p className="text-[var(--text-mid)]" style={{ marginTop: '6px' }}>
              {analysis.business_type}
            </p>
          </div>
        )}

        {!analysis.business_name && (
          <div style={{ marginBottom: '28px' }}>
            <p className="text-[var(--text)] font-medium" style={{ fontSize: '1.25rem' }}>
              {analysis.business_type}
            </p>
          </div>
        )}

        {/* Detection Grid - 2 column layout for balance */}
        <div
          className="border-t border-[var(--border)] grid sm:grid-cols-2"
          style={{ paddingTop: '24px', gap: '20px 40px' }}
        >
          {/* Left Column - Business Info */}
          <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
            {/* Location */}
            {analysis.location && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider block" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  Location
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {analysis.location}
                </p>
              </div>
            )}

            {/* Industry */}
            {analysis.industry && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider block" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  Industry
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {analysis.industry}
                </p>
              </div>
            )}

            {/* Target Audience */}
            {analysis.target_audience && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider block" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  Target Audience
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {analysis.target_audience}
                </p>
              </div>
            )}

            {/* E-commerce indicator */}
            {platformData?.is_ecommerce && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider block" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  Business Model
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  E-commerce
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Tech Info */}
          <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
            {/* Platform */}
            <div>
              <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '6px' }}>
                <Monitor size={10} />
                Platform
                <InfoTooltip text={
                  platformData?.detected_cms === 'unknown'
                    ? "We couldn't detect your website's platform. This may be due to bot protection, the site being temporarily unavailable, or using a custom-built solution."
                    : platformData?.detected_cms
                    ? `Your site is built with ${platformData.detected_cms}.`
                    : "The CMS or website builder used to create your site (e.g., WordPress, Webflow, Squarespace). 'Custom-built' means we didn't detect a known platform."
                } />
              </label>
              <p className="text-[var(--text-mid)] text-sm">
                {platformData?.detected_cms === 'unknown'
                  ? 'Unknown'
                  : platformData?.detected_cms || 'Custom-built'}
              </p>
            </div>

            {/* Tech Stack */}
            {(platformData?.detected_framework || platformData?.detected_css_framework || platformData?.detected_hosting) && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  <Code size={10} />
                  Tech Stack
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {[
                    platformData?.detected_framework,
                    platformData?.detected_css_framework,
                    platformData?.detected_hosting,
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Analytics */}
            {platformData?.detected_analytics && platformData.detected_analytics.length > 0 && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  <BarChart3 size={10} />
                  Analytics
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {platformData.detected_analytics.join(', ')}
                </p>
              </div>
            )}

            {/* Lead Capture */}
            {platformData?.detected_lead_capture && platformData.detected_lead_capture.length > 0 && (
              <div>
                <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '6px' }}>
                  <MessageSquare size={10} />
                  Lead Capture
                </label>
                <p className="text-[var(--text-mid)] text-sm">
                  {platformData.detected_lead_capture.join(', ')}
                </p>
              </div>
            )}

            {/* AI Readability Status */}
            <div>
              <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '6px' }}>
                <Bot size={10} />
                AI Readability
                <InfoTooltip text={
                  platformData?.renders_client_side
                    ? "Your site loads content via JavaScript, which AI assistants like ChatGPT and Claude cannot read. This significantly limits your AI visibility."
                    : platformData?.has_ai_readability_issues
                    ? "We detected potential issues that may affect how AI assistants read your site. Some content may not be fully visible."
                    : "Your site's content is server-rendered, which means AI assistants like ChatGPT and Claude can read and understand it. This is ideal for AI visibility."
                } />
              </label>
              {platformData?.renders_client_side ? (
                <p className="text-[var(--red)] text-sm flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Client-side only
                </p>
              ) : platformData?.has_ai_readability_issues ? (
                <p className="text-[var(--yellow)] text-sm">
                  Potential issues
                </p>
              ) : (
                <p className="text-[var(--green)] text-sm flex items-center gap-1.5">
                  <Check size={12} />
                  Good
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content Sections - Tag cloud */}
        {(() => {
          const sections = [
            platformData?.has_blog && 'Blog',
            platformData?.has_case_studies && 'Case Studies',
            platformData?.has_resources && 'Resources',
            platformData?.has_faq && 'FAQ',
            platformData?.has_about_page && 'About',
            platformData?.has_team_page && 'Team',
            platformData?.has_testimonials && 'Testimonials',
          ].filter(Boolean) as string[]

          if (sections.length === 0) return null

          return (
            <div
              className="border-t border-[var(--border)]"
              style={{ paddingTop: '20px', marginTop: '24px' }}
            >
              <label className="text-[var(--text-dim)] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: '10px', marginBottom: '12px' }}>
                <FileText size={10} />
                Content Found
              </label>
              <div className="flex flex-wrap" style={{ gap: '8px' }}>
                {sections.map((section) => (
                  <span
                    key={section}
                    className="bg-[var(--green)]/10 text-[var(--green)] font-mono"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )
        })()}

        {/* AI-Generated Badge */}
        {platformData?.likely_ai_generated && (
          <div
            className="border-t border-[var(--border)]"
            style={{ paddingTop: '20px', marginTop: '24px' }}
          >
            <span
              className="inline-flex items-center gap-2 font-mono text-xs bg-[var(--blue)]/10 text-[var(--blue)]"
              style={{ padding: '6px 12px' }}
            >
              <Cpu size={12} />
              AI-assisted build detected
            </span>
          </div>
        )}
      </div>

      {/* Services */}
      {analysis.services && analysis.services.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <h3
              className="text-[var(--green)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Products & Services
            </h3>
            <span className="text-[var(--text-dim)] font-mono text-xs">
              {analysis.services.length} detected
            </span>
          </div>

          <div className="flex flex-wrap" style={{ gap: '12px' }}>
            {analysis.services.map((service, index) => (
              <span
                key={index}
                className="bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-mid)] font-mono"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Phrases */}
      {analysis.key_phrases && analysis.key_phrases.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            Key Phrases We Identified
          </h3>

          <div className="flex flex-wrap" style={{ gap: '12px' }}>
            {analysis.key_phrases.map((phrase, index) => (
              <span
                key={index}
                className="bg-[var(--green)]/10 border border-[var(--green)]/20 text-[var(--green)] font-mono"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Your AI Questions */}
      {questions.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '16px' }}
          >
            Questions We Ask AI
          </h3>

          {isSubscriber ? (
            // Subscriber view: combined explanation with editing instructions
            <div style={{ marginBottom: '24px' }}>
              <p
                className="text-[var(--text-dim)] text-sm"
                style={{ lineHeight: '1.7' }}
              >
                We generated these initial questions by analyzing your website as {analysis?.business_name ? <strong className="text-[var(--text-mid)]">{analysis.business_name}</strong> : 'your company'}
                {analysis?.business_type && analysis.business_type !== 'Business website' && <>, a <strong className="text-[var(--text-mid)]">{analysis.business_type.toLowerCase()}</strong></>}
                {analysis?.location && <> in <strong className="text-[var(--text-mid)]">{analysis.location}</strong></>}.
                Now they're yours to adapt, tweak, and refine as you learn what resonates with AI.
              </p>
              <p
                className="text-[var(--text-dim)] text-sm"
                style={{ marginTop: '12px', lineHeight: '1.7' }}
              >
                Click any question to edit it, add your own, or use <strong className="text-[var(--text-mid)]">Browse</strong> to select from your Question Library.
                You can have up to {customQuestionLimit} questions. Changes will be used in your next scan.
              </p>
            </div>
          ) : (
            // Free user view: explanation with upgrade CTA
            <>
              <p
                className="text-[var(--text-dim)] text-sm"
                style={{ marginBottom: '16px', lineHeight: '1.6' }}
              >
                We generated these questions by analyzing your website as {analysis?.business_name ? <strong className="text-[var(--text-mid)]">{analysis.business_name}</strong> : 'your company'}
                {analysis?.business_type && analysis.business_type !== 'Business website' && <>, a <strong className="text-[var(--text-mid)]">{analysis.business_type.toLowerCase()}</strong></>}
                {analysis?.location && <> in <strong className="text-[var(--text-mid)]">{analysis.location}</strong></>}.
                These are based on real search queries people use for businesses like yours.
              </p>
              <div
                className="flex items-center justify-between"
                style={{
                  marginBottom: '24px',
                  padding: '16px 20px',
                  gap: '16px',
                  background: 'var(--gold-glow)',
                  border: '1px dashed var(--gold-dim)',
                }}
              >
                <div className="flex items-center" style={{ gap: '12px' }}>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                    }}
                  >
                    <Lock size={14} style={{ color: 'var(--bg)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--gold)' }}>
                      Want to customize these questions?
                    </p>
                    <p className="text-[var(--text-dim)] text-xs" style={{ marginTop: '2px' }}>
                      Edit questions, add your own, and track changes over time.
                    </p>
                  </div>
                </div>
                <a
                  href="/pricing?from=report"
                  onClick={handlePricingClick}
                  className="flex-shrink-0 font-mono text-xs flex items-center gap-2 transition-all hover:opacity-80"
                  style={{
                    padding: '8px 14px',
                    background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                    color: 'var(--bg)',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  <Sparkles size={14} />
                  Subscribe to Unlock
                </a>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <div
              className="bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] text-sm"
              style={{ padding: '12px 16px', marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          {/* Questions list */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '16px 20px', gap: '16px' }}
              >
                <span
                  className="flex-shrink-0 font-mono text-[var(--text-ghost)]"
                  style={{ fontSize: '12px', width: '24px', paddingTop: '2px' }}
                >
                  {index + 1}.
                </span>

                {editingId === question.id ? (
                  // Edit mode
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm"
                        style={{
                          padding: '12px',
                          paddingRight: '120px',
                          minHeight: '80px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        }}
                        autoFocus
                        disabled={isSaving}
                        placeholder="Type a question or browse the library..."
                      />
                      <button
                        onClick={() => setShowPicker('edit')}
                        disabled={isSaving}
                        className="absolute top-2 right-2 flex items-center gap-1 font-mono text-xs bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--green)] hover:border-[var(--green)] transition-colors"
                        style={{ padding: '6px 10px' }}
                        title="Browse question library"
                      >
                        <Library size={12} />
                        Browse
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '12px' }}>
                      <div className="flex items-center gap-2">
                        <label className="text-[var(--text-dim)] text-xs font-mono">Type:</label>
                        <CategoryDropdown
                          value={editCategory}
                          onChange={setEditCategory}
                          disabled={isSaving}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveEdit(question.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1 font-mono text-xs bg-[var(--green)] text-[var(--bg)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ padding: '8px 12px' }}
                        >
                          <Check size={14} />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="flex items-center gap-1 font-mono text-xs text-[var(--text-dim)] border border-[var(--border)] transition-colors hover:text-[var(--text)] hover:border-[var(--text-dim)]"
                          style={{ padding: '8px 12px' }}
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[var(--text-mid)]"
                        style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '8px' }}
                      >
                        {question.prompt_text}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-mono text-xs"
                          style={{ color: categoryColors[question.category] || 'var(--text-ghost)' }}
                        >
                          {categoryLabels[question.category] || question.category}
                        </span>
                        {/* Source badge */}
                        {question.source === 'ai_generated' ? (
                          <span
                            className="flex items-center gap-1 font-mono text-xs bg-[var(--blue)]/10 text-[var(--blue)]"
                            style={{ padding: '2px 6px' }}
                          >
                            <Bot size={10} />
                            AI
                          </span>
                        ) : question.isCustom ? (
                          <span
                            className="flex items-center gap-1 font-mono text-xs bg-[var(--green)]/10 text-[var(--green)]"
                            style={{ padding: '2px 6px' }}
                          >
                            <User size={10} />
                            Custom
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Edit/Delete buttons for subscribers */}
                    {isSubscriber && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(question)}
                          className="p-2 text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
                          title="Edit question"
                        >
                          <Pencil size={16} />
                        </button>
                        {question.isCustom && (
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="p-2 text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"
                            title="Delete question"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Add new question form */}
            {isSubscriber && isAddingNew && (
              <div
                className="bg-[var(--surface-elevated)] border border-dashed border-[var(--green)]"
                style={{ padding: '16px 20px' }}
              >
                <div className="relative">
                  <textarea
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Type a new question or browse the library..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-ghost)]"
                    style={{
                      padding: '12px',
                      paddingRight: '120px',
                      minHeight: '80px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                    autoFocus
                    disabled={isSaving}
                  />
                  <button
                    onClick={() => setShowPicker('add')}
                    disabled={isSaving}
                    className="absolute top-2 right-2 flex items-center gap-1 font-mono text-xs bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--green)] hover:border-[var(--green)] transition-colors"
                    style={{ padding: '6px 10px' }}
                    title="Browse question library"
                  >
                    <Library size={12} />
                    Browse
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '12px' }}>
                  <div className="flex items-center gap-2">
                    <label className="text-[var(--text-dim)] text-xs font-mono">Type:</label>
                    <CategoryDropdown
                      value={newQuestionCategory}
                      onChange={setNewQuestionCategory}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddQuestion}
                      disabled={isSaving || !newQuestionText.trim()}
                      className="flex items-center gap-1 font-mono text-xs bg-[var(--green)] text-[var(--bg)] transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ padding: '8px 12px' }}
                    >
                      <Check size={14} />
                      Add Question
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingNew(false)
                        setNewQuestionText('')
                        setNewQuestionCategory('other')
                        setError(null)
                      }}
                      disabled={isSaving}
                      className="flex items-center gap-1 font-mono text-xs text-[var(--text-dim)] border border-[var(--border)] transition-colors hover:text-[var(--text)] hover:border-[var(--text-dim)]"
                      style={{ padding: '8px 12px' }}
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add question button */}
            {isSubscriber && !isAddingNew && canAddMore && (
              <button
                onClick={() => {
                  setIsAddingNew(true)
                  setError(null)
                }}
                className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] text-[var(--text-dim)] font-mono text-sm transition-all hover:border-[var(--green)] hover:text-[var(--green)]"
                style={{ padding: '16px 20px' }}
              >
                <Plus size={16} />
                Add Custom Question
              </button>
            )}
          </div>
        </div>
      )}

      {/* Question Library Modal */}
      {showLibrary && (
        <QuestionLibraryModal
          activeQuestionIds={questions.map(q => q.id)}
          onClose={() => setShowLibrary(false)}
          onRestoreQuestion={(question) => {
            // Add restored question back to the list
            setQuestions(prev => [
              ...prev,
              {
                id: question.id,
                prompt_text: question.prompt_text,
                category: question.category,
                source: question.source,
                isCustom: question.source === 'user_created',
              },
            ])
          }}
        />
      )}

      {/* Question History Modal */}
      {historyQuestionId && (
        <QuestionHistoryModal
          questionId={historyQuestionId}
          currentText={questions.find(q => q.id === historyQuestionId)?.prompt_text || ''}
          onClose={() => setHistoryQuestionId(null)}
          onRevert={(newText) => {
            // Update the question with the reverted text
            setQuestions(prev =>
              prev.map(q =>
                q.id === historyQuestionId
                  ? { ...q, prompt_text: newText }
                  : q
              )
            )
          }}
        />
      )}

      {/* Question Picker Modal (for edit/add flows) */}
      {showPicker && (
        <QuestionLibraryModal
          activeQuestionIds={questions.map(q => q.id)}
          onClose={() => setShowPicker(null)}
          mode="pick"
          onSelectQuestion={(question) => {
            if (showPicker === 'edit') {
              // Fill the edit textarea with selected question
              setEditText(question.prompt_text)
              setEditCategory(question.category)
            } else if (showPicker === 'add') {
              // Fill the add textarea with selected question
              setNewQuestionText(question.prompt_text)
              setNewQuestionCategory(question.category)
            }
          }}
        />
      )}
    </div>
  )
}
