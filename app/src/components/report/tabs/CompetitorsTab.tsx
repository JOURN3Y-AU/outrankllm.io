'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, Lock, Sparkles, CheckCircle2, XCircle, AlertCircle, Plus, Minus, Loader2, X, ChevronDown, Download } from 'lucide-react'
import type { Competitor, Analysis, Response, BrandAwarenessResult, CompetitiveSummary } from '../shared'
import { platformColors, platformNames, formatResponseText, FilterButton } from '../shared'
import { RescanSection } from '../RescanSection'

type PlatformFilter = 'all' | 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

interface SubscriberCompetitor {
  id: string
  lead_id: string
  name: string
  source: 'detected' | 'user_added'
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ChartEntry {
  name: string
  count: number
  isUser: boolean
}

function PositioningBadge({ positioning }: { positioning: string | null }) {
  const config = {
    stronger: { label: 'Stronger', color: 'var(--green)', bg: 'var(--green)' },
    weaker: { label: 'Weaker', color: 'var(--red)', bg: 'var(--red)' },
    equal: { label: 'Equal', color: 'var(--amber)', bg: 'var(--amber)' },
    not_compared: { label: 'Not Compared', color: 'var(--text-ghost)', bg: 'var(--text-ghost)' },
  }

  const style = config[positioning as keyof typeof config] || config.not_compared

  return (
    <span
      className="font-mono text-xs uppercase"
      style={{
        padding: '4px 10px',
        backgroundColor: `${style.bg}15`,
        color: style.color,
        border: `1px solid ${style.bg}30`,
      }}
    >
      {style.label}
    </span>
  )
}

// Positioning Matrix - visual grid showing competitive standing at a glance
function PositioningMatrix({
  resultsByCompetitor,
  brandRecognition,
}: {
  resultsByCompetitor: Map<string, BrandAwarenessResult[]>
  brandRecognition: Map<string, boolean>
}) {
  const matrixRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [animatedCells, setAnimatedCells] = useState<Set<string>>(new Set())

  const platforms = ['chatgpt', 'claude', 'gemini', 'perplexity'] as const
  const competitorNames = [...resultsByCompetitor.keys()]

  // Calculate summary stats
  const stats = { stronger: 0, weaker: 0, equal: 0, unknown: 0 }
  for (const results of resultsByCompetitor.values()) {
    for (const result of results) {
      const brandRecognized = brandRecognition.get(result.platform) ?? false
      if (!brandRecognized) {
        stats.unknown++
      } else if (result.positioning === 'stronger') {
        stats.stronger++
      } else if (result.positioning === 'weaker') {
        stats.weaker++
      } else if (result.positioning === 'equal') {
        stats.equal++
      } else {
        stats.unknown++
      }
    }
  }

  const totalComparisons = stats.stronger + stats.weaker + stats.equal

  // Observe when matrix becomes visible
  useEffect(() => {
    const element = matrixRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Animate cells with staggered timing when visible
  useEffect(() => {
    if (!isVisible) return

    const staggerDelay = 60 // ms between each cell
    let cellIndex = 0

    competitorNames.forEach((compName) => {
      platforms.forEach((platform) => {
        const delay = cellIndex * staggerDelay
        const cellKey = `${compName}-${platform}`
        setTimeout(() => {
          setAnimatedCells(prev => new Set(prev).add(cellKey))
        }, delay)
        cellIndex++
      })
    })
  }, [isVisible, competitorNames])

  if (competitorNames.length === 0) return null

  const getPositioningStyle = (positioning: string | null, brandRecognized: boolean) => {
    if (!brandRecognized) {
      return { bg: 'var(--surface)', color: 'var(--text-ghost)', icon: '?' }
    }
    switch (positioning) {
      case 'stronger':
        return { bg: 'var(--green)', color: 'var(--bg)', icon: '▲' }
      case 'weaker':
        return { bg: 'var(--red)', color: 'var(--bg)', icon: '▼' }
      case 'equal':
        return { bg: 'var(--amber)', color: 'var(--bg)', icon: '=' }
      default:
        return { bg: 'var(--surface)', color: 'var(--text-ghost)', icon: '—' }
    }
  }

  return (
    <div ref={matrixRef} className="card" style={{ padding: '32px' }}>
      <h3
        className="text-[var(--green)] font-mono uppercase tracking-wider"
        style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
      >
        Positioning At a Glance
      </h3>

      {/* Summary Stats */}
      <div
        className="flex items-center flex-wrap bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '16px 20px', marginBottom: '24px', gap: '24px' }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--green)',
              borderRadius: '2px',
            }}
          />
          <span className="font-mono text-lg text-[var(--text)]">{stats.stronger}</span>
          <span className="text-[var(--text-dim)] text-sm">Stronger</span>
        </div>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--amber)',
              borderRadius: '2px',
            }}
          />
          <span className="font-mono text-lg text-[var(--text)]">{stats.equal}</span>
          <span className="text-[var(--text-dim)] text-sm">Equal</span>
        </div>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--red)',
              borderRadius: '2px',
            }}
          />
          <span className="font-mono text-lg text-[var(--text)]">{stats.weaker}</span>
          <span className="text-[var(--text-dim)] text-sm">Weaker</span>
        </div>
        {totalComparisons > 0 && (
          <div className="text-[var(--text-dim)] text-sm" style={{ marginLeft: 'auto' }}>
            {Math.round((stats.stronger / totalComparisons) * 100)}% win rate across {totalComparisons} comparisons
          </div>
        )}
      </div>

      {/* Matrix Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                className="text-left font-mono text-xs text-[var(--text-ghost)] uppercase"
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
              >
                Competitor
              </th>
              {platforms.map((platform) => (
                <th
                  key={platform}
                  className="text-center font-mono text-xs uppercase"
                  style={{
                    padding: '12px 8px',
                    borderBottom: '1px solid var(--border)',
                    color: platformColors[platform],
                    minWidth: '80px',
                  }}
                >
                  {platformNames[platform]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competitorNames.map((compName) => {
              const results = resultsByCompetitor.get(compName) || []
              return (
                <tr key={compName} className="border-b border-[var(--border-subtle)]">
                  <td
                    className="text-[var(--text)] font-medium"
                    style={{ padding: '14px 16px', fontSize: '14px' }}
                  >
                    vs. {compName}
                  </td>
                  {platforms.map((platform) => {
                    const result = results.find(r => r.platform === platform)
                    const brandRecognized = brandRecognition.get(platform) ?? false
                    const style = getPositioningStyle(result?.positioning || null, brandRecognized)
                    const cellKey = `${compName}-${platform}`
                    const isAnimated = animatedCells.has(cellKey)

                    return (
                      <td key={platform} style={{ padding: '8px', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            backgroundColor: style.bg,
                            color: style.color,
                            fontWeight: 600,
                            fontSize: '14px',
                            borderRadius: '4px',
                            opacity: isAnimated ? 1 : 0,
                            transform: isAnimated ? 'scale(1)' : 'scale(0.5)',
                            transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                          }}
                          title={
                            !brandRecognized
                              ? 'Brand not recognized by this platform'
                              : result?.positioning
                                ? `${result.positioning.charAt(0).toUpperCase()}${result.positioning.slice(1)} than ${compName}`
                                : 'No data'
                          }
                        >
                          {style.icon}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        className="flex items-center flex-wrap text-xs text-[var(--text-ghost)]"
        style={{ marginTop: '16px', gap: '16px' }}
      >
        <span className="flex items-center" style={{ gap: '6px' }}>
          <span style={{ color: 'var(--green)' }}>▲</span> You&apos;re stronger
        </span>
        <span className="flex items-center" style={{ gap: '6px' }}>
          <span style={{ color: 'var(--amber)' }}>=</span> Equal footing
        </span>
        <span className="flex items-center" style={{ gap: '6px' }}>
          <span style={{ color: 'var(--red)' }}>▼</span> They&apos;re stronger
        </span>
        <span className="flex items-center" style={{ gap: '6px' }}>
          <span>?</span> Brand not recognized
        </span>
      </div>
    </div>
  )
}

function HorizontalBarChart({
  data,
  isBlurred = false,
}: {
  data: ChartEntry[]
  isBlurred?: boolean
}) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const chartRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [animatedWidths, setAnimatedWidths] = useState<number[]>(data.map(() => 0))

  // Observe when chart becomes visible
  useEffect(() => {
    const element = chartRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Animate bars with staggered timing when visible
  useEffect(() => {
    if (!isVisible) return

    const duration = 1200 // Total animation duration per bar
    const staggerDelay = 120 // Delay between each bar starting
    const steps = 60

    // Animate each bar with a stagger
    data.forEach((entry, index) => {
      const targetWidth = (entry.count / maxCount) * 100
      const startDelay = index * staggerDelay

      setTimeout(() => {
        let step = 0
        const interval = duration / steps

        const timer = setInterval(() => {
          step++
          if (step >= steps) {
            setAnimatedWidths(prev => {
              const next = [...prev]
              next[index] = targetWidth
              return next
            })
            clearInterval(timer)
          } else {
            const progress = step / steps
            // Ease-out cubic for natural deceleration
            const eased = 1 - Math.pow(1 - progress, 3)
            setAnimatedWidths(prev => {
              const next = [...prev]
              next[index] = targetWidth * eased
              return next
            })
          }
        }, interval)
      }, startDelay)
    })
  }, [isVisible, data, maxCount])

  return (
    <div ref={chartRef} style={{ display: 'grid', gap: '14px' }}>
      {data.map((entry, index) => {
        const currentWidth = isVisible ? animatedWidths[index] : 0
        const shouldBlur = isBlurred && index > 0

        return (
          <div
            key={`${entry.name}-${index}`}
            className="flex items-center"
            style={{
              filter: shouldBlur ? 'blur(4px)' : 'none',
              opacity: shouldBlur ? 0.6 : 1,
              transition: 'filter 0.2s, opacity 0.2s',
              gap: '24px',
            }}
          >
            {/* Left side: Name and mentions */}
            <div style={{ width: '200px', flexShrink: 0 }}>
              <div
                className={`font-medium ${entry.isUser ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}
                style={{ fontSize: '14px', marginBottom: '1px' }}
              >
                {entry.name}
              </div>
              <div className={`font-mono text-xs ${entry.isUser ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`}>
                {entry.count} Mentions by AI
              </div>
            </div>

            {/* Right side: Bar */}
            <div
              className="flex-1 bg-[var(--surface)]"
              style={{ height: '36px', borderRadius: '2px' }}
            >
              <div
                style={{
                  width: `${currentWidth}%`,
                  height: '100%',
                  backgroundColor: entry.isUser ? 'var(--green)' : 'var(--text-mid)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CompetitorManager({
  detectedCompetitors,
  trackedCompetitorNames,
  domainSubscriptionId,
  isSubscriber,
}: {
  detectedCompetitors: Competitor[]
  /** Names of competitors that already have positioning data (from brand awareness results) */
  trackedCompetitorNames: string[]
  domainSubscriptionId?: string | null
  isSubscriber: boolean
}) {
  const [trackedCompetitors, setTrackedCompetitors] = useState<SubscriberCompetitor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newCompetitorName, setNewCompetitorName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxCompetitors, setMaxCompetitors] = useState(5)
  const [tableExists, setTableExists] = useState(true)
  // Track virtual competitors that user has "removed" (just hidden from display)
  const [excludedVirtual, setExcludedVirtual] = useState<string[]>([])

  // Fetch tracked competitors on mount
  useEffect(() => {
    if (!isSubscriber) return

    async function fetchCompetitors() {
      try {
        const params = new URLSearchParams()
        if (domainSubscriptionId) {
          params.set('domain_subscription_id', domainSubscriptionId)
        }
        const res = await fetch(`/api/competitors?${params}`)
        if (res.ok) {
          const data = await res.json()
          setTrackedCompetitors(data.competitors || [])
          setMaxCompetitors(data.maxCompetitors || 5)
          setTableExists(true)
        } else if (res.status === 500) {
          // Table might not exist yet - show existing positioning data as "tracked"
          setTableExists(false)
        }
      } catch (err) {
        console.error('Failed to fetch competitors:', err)
        setTableExists(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompetitors()
  }, [isSubscriber, domainSubscriptionId])

  async function toggleCompetitor(id: string, currentActive: boolean) {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })

      if (res.ok) {
        const data = await res.json()
        setTrackedCompetitors(prev =>
          prev.map(c => c.id === id ? data.competitor : c)
        )
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update competitor')
      }
    } catch (err) {
      setError('Failed to update competitor')
    } finally {
      setIsSaving(false)
    }
  }

  async function addCompetitor(name: string, source: 'detected' | 'user_added' = 'user_added') {
    if (!name.trim()) return

    setIsSaving(true)
    setError(null)

    // Check if this competitor already exists in DB but is inactive
    const existingInactive = trackedCompetitors.find(
      c => c.name.toLowerCase() === name.trim().toLowerCase() && !c.is_active
    )

    try {
      if (existingInactive) {
        // Re-activate existing competitor
        const res = await fetch(`/api/competitors/${existingInactive.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        })

        if (res.ok) {
          const data = await res.json()
          setTrackedCompetitors(prev =>
            prev.map(c => c.id === existingInactive.id ? data.competitor : c)
          )
          setNewCompetitorName('')
          setShowAddForm(false)
        } else {
          const data = await res.json()
          setError(data.error || 'Failed to add competitor')
        }
      } else {
        // Create new competitor
        const res = await fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), source, domain_subscription_id: domainSubscriptionId }),
        })

        if (res.ok) {
          const data = await res.json()
          setTrackedCompetitors(prev => [...prev, data.competitor])
          setNewCompetitorName('')
          setShowAddForm(false)
        } else {
          const data = await res.json()
          setError(data.error || 'Failed to add competitor')
        }
      }
    } catch (err) {
      setError('Failed to add competitor')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeCompetitor(id: string) {
    setIsSaving(true)
    setError(null)

    // Find the competitor to determine how to remove it
    const competitor = trackedCompetitors.find(c => c.id === id)

    try {
      if (competitor?.source === 'user_added') {
        // User-added competitors can be fully deleted
        const res = await fetch(`/api/competitors/${id}`, {
          method: 'DELETE',
        })

        if (res.ok) {
          setTrackedCompetitors(prev => prev.filter(c => c.id !== id))
        } else {
          const data = await res.json()
          setError(data.error || 'Failed to remove competitor')
        }
      } else {
        // Detected competitors are toggled inactive (removes from list but can be re-added)
        const res = await fetch(`/api/competitors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        })

        if (res.ok) {
          const data = await res.json()
          // Update the competitor in state (keep it but mark inactive)
          setTrackedCompetitors(prev =>
            prev.map(c => c.id === id ? data.competitor : c)
          )
        } else {
          const data = await res.json()
          setError(data.error || 'Failed to remove competitor')
        }
      }
    } catch (err) {
      setError('Failed to remove competitor')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isSubscriber) return null

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-center text-[var(--text-dim)]" style={{ gap: '8px' }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="font-mono text-sm">Loading competitors...</span>
        </div>
      </div>
    )
  }

  // Only show active competitors from DB
  const activeTrackedCompetitors = trackedCompetitors.filter(c => c.is_active)

  // Combine active tracked competitors from DB with those that have existing positioning data
  // This ensures competitors with data always show up, even if table doesn't exist
  // Exclude any virtual competitors the user has "removed"
  const existingPositioningCompetitors: SubscriberCompetitor[] = trackedCompetitorNames
    .filter(name =>
      !activeTrackedCompetitors.some(c => c.name.toLowerCase() === name.toLowerCase()) &&
      !excludedVirtual.includes(name.toLowerCase())
    )
    .map(name => ({
      id: `existing-${name}`,
      lead_id: '',
      name,
      source: 'detected' as const,
      is_active: true,
      created_at: '',
      updated_at: '',
    }))

  const allTrackedCompetitors = [...activeTrackedCompetitors, ...existingPositioningCompetitors]
  const activeCount = allTrackedCompetitors.length
  const trackedNames = new Set(allTrackedCompetitors.map(c => c.name.toLowerCase()))

  // Detected competitors not yet tracked (or inactive)
  const availableToAdd = detectedCompetitors.filter(
    c => !trackedNames.has(c.name.toLowerCase())
  )

  return (
    <div className="card" style={{ padding: '32px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', letterSpacing: '0.1em' }}
        >
          Competitors to Track ({activeCount}/{maxCompetitors})
        </h3>
      </div>

      <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
        Select which competitors to include in positioning analysis. Changes apply on your next weekly scan.
      </p>

      {error && (
        <div
          className="flex items-center text-[var(--red)] text-sm bg-[var(--red)]/10 border border-[var(--red)]/20"
          style={{ padding: '10px 14px', marginBottom: '16px', gap: '8px' }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Currently tracked competitors - bright style, minus to remove */}
      {allTrackedCompetitors.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p
            className="text-[var(--text-ghost)] font-mono uppercase text-xs"
            style={{ marginBottom: '10px', letterSpacing: '0.05em' }}
          >
            Selected ({allTrackedCompetitors.length})
          </p>
          <div className="flex flex-wrap" style={{ gap: '8px' }}>
            {allTrackedCompetitors.map(competitor => {
              const isVirtual = competitor.id.startsWith('existing-')
              // Virtual competitors can be "removed" by adding them to excludedVirtual state
              const canRemove = (tableExists || isVirtual) && allTrackedCompetitors.length > 1
              const isLastOne = allTrackedCompetitors.length === 1
              return (
                <button
                  key={competitor.id}
                  onClick={() => {
                    if (!canRemove) return
                    if (isVirtual) {
                      // For virtual competitors, remove from display by updating state
                      setExcludedVirtual(prev => [...prev, competitor.name.toLowerCase()])
                    } else if (tableExists) {
                      removeCompetitor(competitor.id)
                    }
                  }}
                  disabled={isSaving || !canRemove}
                  className="flex items-center text-sm border transition-colors"
                  style={{
                    padding: '6px 12px',
                    gap: '6px',
                    backgroundColor: 'var(--green)15',
                    borderColor: 'var(--green)40',
                    color: 'var(--green)',
                    cursor: canRemove ? 'pointer' : 'default',
                    opacity: isLastOne ? 0.6 : 1,
                  }}
                  title={isLastOne ? 'At least one competitor required' : 'Click to remove'}
                >
                  {!isLastOne && <Minus size={12} />}
                  {competitor.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Available to add - dim style, plus to add */}
      {(() => {
        // Build list of available competitors to add
        // Include: detected competitors not tracked + excluded virtual competitors
        const excludedVirtualCompetitors = trackedCompetitorNames
          .filter(name => excludedVirtual.includes(name.toLowerCase()))
          .map(name => ({ name, isExcludedVirtual: true }))

        const availableItems = tableExists
          ? [...availableToAdd.map(c => ({ name: c.name, isExcludedVirtual: false })), ...excludedVirtualCompetitors]
          : excludedVirtualCompetitors

        if (allTrackedCompetitors.length >= maxCompetitors || availableItems.length === 0) return null

        return (
          <div style={{ marginBottom: '20px' }}>
            <p
              className="text-[var(--text-ghost)] font-mono uppercase text-xs"
              style={{ marginBottom: '10px', letterSpacing: '0.05em' }}
            >
              Available ({availableItems.length})
            </p>
            <div className="flex flex-wrap" style={{ gap: '8px' }}>
              {availableItems.slice(0, 8).map(item => (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.isExcludedVirtual) {
                      // Re-add virtual competitor by removing from excluded list
                      setExcludedVirtual(prev => prev.filter(n => n !== item.name.toLowerCase()))
                    } else if (tableExists) {
                      addCompetitor(item.name, 'detected')
                    }
                  }}
                  disabled={isSaving || allTrackedCompetitors.length >= maxCompetitors}
                  className="flex items-center text-[var(--text-dim)] text-sm bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--green)] hover:text-[var(--green)] transition-colors"
                  style={{ padding: '6px 12px', gap: '6px' }}
                >
                  <Plus size={12} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Add custom competitor form */}
      {tableExists && allTrackedCompetitors.length < maxCompetitors && (
        <div>
          <p
            className="text-[var(--text-ghost)] font-mono uppercase text-xs"
            style={{ marginBottom: '10px', letterSpacing: '0.05em' }}
          >
            Or add a custom competitor
          </p>
          {showAddForm ? (
            <div className="flex items-center" style={{ gap: '8px' }}>
              <input
                type="text"
                value={newCompetitorName}
                onChange={e => setNewCompetitorName(e.target.value)}
                placeholder="e.g. competitor.com or Company Name"
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm font-mono"
                style={{ padding: '8px 12px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') addCompetitor(newCompetitorName, 'user_added')
                  if (e.key === 'Escape') {
                    setShowAddForm(false)
                    setNewCompetitorName('')
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => addCompetitor(newCompetitorName, 'user_added')}
                disabled={isSaving || !newCompetitorName.trim()}
                className="bg-[var(--green)] text-[var(--bg)] font-mono text-sm"
                style={{ padding: '8px 16px' }}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewCompetitorName('')
                }}
                className="text-[var(--text-ghost)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center text-[var(--green)] font-mono text-sm hover:underline"
              style={{ gap: '6px' }}
            >
              <Plus size={14} />
              Add Custom Competitor
            </button>
          )}
          <p className="text-[var(--text-ghost)] text-xs" style={{ marginTop: '8px' }}>
            Tip: Use the business name or domain (e.g. &quot;acme.com&quot; or &quot;Acme Corp&quot;)
          </p>
        </div>
      )}

      {tableExists && allTrackedCompetitors.length >= maxCompetitors && (
        <p className="text-[var(--text-ghost)] text-sm">
          Maximum {maxCompetitors} competitors reached. Remove one to add another.
        </p>
      )}

      {/* Warning when no competitors selected */}
      {allTrackedCompetitors.length === 0 && (
        <div
          className="flex items-start bg-[var(--amber)]/10 border border-[var(--amber)]/20"
          style={{ padding: '12px 16px', gap: '10px', marginTop: '16px' }}
        >
          <AlertCircle size={16} className="text-[var(--amber)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <p className="text-[var(--text-dim)] text-sm">
            Select at least one competitor for positioning analysis. Your weekly scan will compare you against selected competitors.
          </p>
        </div>
      )}

      {!tableExists && (
        <div
          className="flex items-start bg-[var(--amber)]/10 border border-[var(--amber)]/20"
          style={{ padding: '12px 16px', gap: '10px', marginTop: '16px' }}
        >
          <AlertCircle size={16} className="text-[var(--amber)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <p className="text-[var(--text-dim)] text-sm">
            Competitor management will be available after your next scan. Your current competitor ({trackedCompetitorNames.join(', ')}) is shown above.
          </p>
        </div>
      )}
    </div>
  )
}

export function CompetitorsTab({
  competitors,
  responses,
  brandAwareness,
  competitiveSummary,
  analysis,
  domain,
  domainSubscriptionId,
  onUpgradeClick,
  isSubscriber = false,
  blurCompetitors,
}: {
  competitors: Competitor[]
  responses?: Response[] | null
  brandAwareness?: BrandAwarenessResult[] | null
  competitiveSummary?: CompetitiveSummary | null
  analysis?: Analysis | null
  domain: string
  domainSubscriptionId?: string | null
  onUpgradeClick: () => void
  isSubscriber?: boolean
  /** Whether to blur competitor data - defaults to !isSubscriber if not provided */
  blurCompetitors?: boolean
}) {
  // Resolve blur state - use explicit prop or fall back to subscriber check
  const shouldBlur = blurCompetitors ?? !isSubscriber
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')

  // Generate and download competitive analysis as markdown
  const downloadCompetitiveAnalysis = () => {
    const businessName = analysis?.business_name || domain
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    let markdown = `# Competitive Intelligence Report\n`
    markdown += `**${businessName}** | Generated ${date}\n\n`
    markdown += `---\n\n`

    // Add Competitive Summary if available
    if (competitiveSummary) {
      markdown += `## Your Competitive Position\n\n`

      if (competitiveSummary.overallPosition) {
        markdown += `### Summary\n${competitiveSummary.overallPosition}\n\n`
      }

      if (competitiveSummary.strengths.length > 0) {
        markdown += `### Your Perceived Strengths\n`
        competitiveSummary.strengths.forEach(s => {
          markdown += `- ${s}\n`
        })
        markdown += `\n`
      }

      if (competitiveSummary.weaknesses.length > 0) {
        markdown += `### Areas Where Competitors Excel\n`
        competitiveSummary.weaknesses.forEach(w => {
          markdown += `- ${w}\n`
        })
        markdown += `\n`
      }

      if (competitiveSummary.opportunities.length > 0) {
        markdown += `### Opportunities to Improve\n`
        competitiveSummary.opportunities.forEach(o => {
          markdown += `- ${o}\n`
        })
        markdown += `\n`
      }

      markdown += `---\n\n`
    }

    // Add per-competitor positioning from brand awareness
    const competitorCompareResults = brandAwareness?.filter(r => r.query_type === 'competitor_compare') || []
    const resultsByCompetitor = new Map<string, BrandAwarenessResult[]>()
    for (const result of competitorCompareResults) {
      const compName = result.compared_to || 'Unknown'
      if (!resultsByCompetitor.has(compName)) {
        resultsByCompetitor.set(compName, [])
      }
      resultsByCompetitor.get(compName)!.push(result)
    }

    if (resultsByCompetitor.size > 0) {
      markdown += `## Detailed Competitor Analysis\n\n`

      for (const [competitorName, results] of resultsByCompetitor) {
        markdown += `### ${businessName} vs. ${competitorName}\n\n`

        const platforms = ['chatgpt', 'claude', 'gemini', 'perplexity'] as const
        for (const platform of platforms) {
          const result = results.find(r => r.platform === platform)
          if (result?.response_text) {
            const platformLabel = platformNames[platform] || platform
            const positioning = result.positioning?.toUpperCase() || 'UNKNOWN'
            markdown += `#### ${platformLabel} (${positioning})\n\n`
            markdown += `${result.response_text}\n\n`
          }
        }

        markdown += `---\n\n`
      }
    }

    markdown += `*Generated by OutrankLLM - outrankllm.io*\n`

    // Create and trigger download
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `competitive-analysis-${domain.replace(/\./g, '-')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!competitors || competitors.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Users size={48} className="mx-auto mb-4 opacity-30" />
        <p>No competitors detected in AI responses</p>
      </div>
    )
  }

  // Calculate user's mention count from responses
  const domainMentionCount = responses?.filter(r => r.domain_mentioned).length || 0
  const businessName = analysis?.business_name || domain

  // Find if the business appears in competitors list (AI may extract business name separately from domain detection)
  // If so, combine the counts and exclude from competitors to avoid duplicate entries
  const businessNameLower = businessName.toLowerCase().trim()
  const matchingCompetitor = competitors.find(c => c.name.toLowerCase().trim() === businessNameLower)
  const competitorMentionCount = matchingCompetitor?.count || 0
  const userMentionCount = domainMentionCount + competitorMentionCount

  // Filter out the business from competitors list (it will be shown as the user's entry)
  const filteredCompetitors = competitors.filter(c => c.name.toLowerCase().trim() !== businessNameLower)

  // Build chart data: competitors + user's brand, sorted by count
  const chartData: ChartEntry[] = [
    ...filteredCompetitors.map(c => ({ name: c.name, count: c.count, isUser: false })),
    { name: businessName, count: userMentionCount, isUser: true }
  ].sort((a, b) => b.count - a.count)

  // Get competitor positioning results from brand awareness
  const competitorCompareResults = brandAwareness?.filter(r => r.query_type === 'competitor_compare') || []

  // Get brand recall results for checking if platform knows the brand
  const brandRecallResults = brandAwareness?.filter(r => r.query_type === 'brand_recall') || []
  const platformRecognition = new Map<string, boolean>()
  for (const result of brandRecallResults) {
    platformRecognition.set(result.platform, result.entity_recognized)
  }

  // Group competitor results by competitor name
  const resultsByCompetitor = new Map<string, BrandAwarenessResult[]>()
  for (const result of competitorCompareResults) {
    const compName = result.compared_to || 'Unknown'
    if (!resultsByCompetitor.has(compName)) {
      resultsByCompetitor.set(compName, [])
    }
    resultsByCompetitor.get(compName)!.push(result)
  }

  // Get unique competitor names that have positioning data
  const competitorNames = [...resultsByCompetitor.keys()]

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Users size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Competitor Analysis:</strong> These are businesses that AI assistants mentioned when answering questions relevant to your industry. Understanding who AI recommends helps identify what signals you need to compete for visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Bar Chart Section */}
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            All Competitors ({competitors.length})
          </h3>
          {shouldBlur && (
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--gold)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>
                Subscribers Only
              </span>
            </div>
          )}
        </div>

        {/* Chart with conditional blur for free/trial users */}
        <div
          className="relative bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '24px' }}
        >
          <HorizontalBarChart data={chartData} isBlurred={shouldBlur} />

          {/* Upgrade overlay for free/trial users - positioned over blurred area */}
          {shouldBlur && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                top: '80px', // Start below the first bar
                background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.9) 20%, rgba(10,10,10,0.95) 100%)',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  marginBottom: '12px',
                }}
              >
                <Users size={20} style={{ color: 'var(--bg)' }} />
              </div>
              <p className="text-[var(--text)] font-medium" style={{ marginBottom: '6px' }}>
                See Full Comparison
              </p>
              <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '280px', marginBottom: '16px' }}>
                Compare your AI visibility against all {competitors.length} competitors
              </p>
              <button
                onClick={onUpgradeClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                Unlock Full Intel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Competitor Management (Subscribers only) */}
      <CompetitorManager
        detectedCompetitors={competitors}
        trackedCompetitorNames={competitorNames}
        domainSubscriptionId={domainSubscriptionId}
        isSubscriber={isSubscriber}
      />

      {/* Positioning Matrix - Visual overview (Subscribers/Trial) */}
      {!shouldBlur && resultsByCompetitor.size > 0 && (
        <PositioningMatrix
          resultsByCompetitor={resultsByCompetitor}
          brandRecognition={platformRecognition}
        />
      )}

      {/* Competitive Summary Section (AI Synthesized) */}
      {!shouldBlur && competitiveSummary && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
          >
            Your Competitive Position
          </h3>

          {/* Overall Position */}
          {competitiveSummary.overallPosition && (
            <div
              className="bg-[var(--surface-elevated)] border border-[var(--border)]"
              style={{ padding: '20px', marginBottom: '24px' }}
            >
              <p className="text-[var(--text)] text-sm" style={{ lineHeight: '1.7' }}>
                {competitiveSummary.overallPosition}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Strengths */}
            {competitiveSummary.strengths.length > 0 && (
              <div>
                <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                  <CheckCircle2 size={16} className="text-[var(--green)]" />
                  <h4 className="font-medium text-[var(--text)]" style={{ fontSize: '14px' }}>
                    Your Perceived Strengths
                  </h4>
                </div>
                <ul className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7', paddingLeft: '24px' }}>
                  {competitiveSummary.strengths.map((strength, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {competitiveSummary.weaknesses.length > 0 && (
              <div>
                <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                  <XCircle size={16} className="text-[var(--red)]" />
                  <h4 className="font-medium text-[var(--text)]" style={{ fontSize: '14px' }}>
                    Areas Where Competitors Excel
                  </h4>
                </div>
                <ul className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7', paddingLeft: '24px' }}>
                  {competitiveSummary.weaknesses.map((weakness, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{weakness}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {competitiveSummary.opportunities.length > 0 && (
              <div>
                <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                  <Sparkles size={16} className="text-[var(--gold)]" />
                  <h4 className="font-medium text-[var(--text)]" style={{ fontSize: '14px' }}>
                    Opportunities to Improve
                  </h4>
                </div>
                <ul className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.7', paddingLeft: '24px' }}>
                  {competitiveSummary.opportunities.map((opp, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{opp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-[var(--text-ghost)] text-xs" style={{ marginTop: '20px' }}>
            This summary is synthesized by Claude from all AI platform responses comparing you to your competitors.
          </p>
        </div>
      )}

      {/* Competitive Intelligence Section */}
      <div className="card relative" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between flex-wrap" style={{ marginBottom: '16px', gap: '12px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            Competitive Intelligence
          </h3>
          {shouldBlur ? (
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--gold)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>
                Subscribers Only
              </span>
            </div>
          ) : (
            /* Platform filter buttons + download button */
            <div className="flex items-center flex-wrap" style={{ gap: '8px' }}>
              <FilterButton
                active={platformFilter === 'all'}
                onClick={() => setPlatformFilter('all')}
              >
                All
              </FilterButton>
              {(['chatgpt', 'claude', 'gemini', 'perplexity'] as const).map((p) => (
                <FilterButton
                  key={p}
                  active={platformFilter === p}
                  onClick={() => setPlatformFilter(p)}
                  color={platformColors[p]}
                >
                  {platformNames[p]}
                </FilterButton>
              ))}
              {/* Download button */}
              <button
                onClick={downloadCompetitiveAnalysis}
                className="flex items-center text-[var(--text-dim)] hover:text-[var(--green)] font-mono text-xs border border-[var(--border)] hover:border-[var(--green)] transition-colors"
                style={{ padding: '6px 12px', gap: '6px', marginLeft: '8px' }}
                title="Download as Markdown"
              >
                <Download size={12} />
                Export
              </button>
            </div>
          )}
        </div>

        {!shouldBlur ? (
          <>
            <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              What AI thinks about you vs your competitors. Use this to understand perceived strengths and weaknesses.
            </p>

            {competitorNames.length > 0 ? (
              <div style={{ display: 'grid', gap: '24px' }}>
                {competitorNames.map((competitorName) => {
                  const competitorResults = resultsByCompetitor.get(competitorName) || []
                  const platforms = ['chatgpt', 'claude', 'gemini', 'perplexity'] as const

                  // Filter results by selected platform
                  const filteredPlatforms = platformFilter === 'all'
                    ? platforms
                    : platforms.filter(p => p === platformFilter)

                  const filteredResults = competitorResults.filter(r =>
                    platformFilter === 'all' || r.platform === platformFilter
                  )

                  // Skip this competitor if no results match the filter
                  if (filteredResults.length === 0 && platformFilter !== 'all') {
                    return null
                  }

                  return (
                    <div
                      key={competitorName}
                      className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                      style={{ padding: '24px' }}
                    >
                      {/* Competitor name header */}
                      <div style={{ marginBottom: '20px' }}>
                        <h4 className="text-[var(--text)] font-medium text-lg">
                          You vs. {competitorName}
                        </h4>
                      </div>

                      {/* Platform responses - compact view with expandable details */}
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {filteredPlatforms.map((platform) => {
                          const result = competitorResults.find(r => r.platform === platform)
                          const brandRecognized = platformRecognition.get(platform) ?? false
                          const hasContent = result?.response_text && result.response_text.length > 10

                          const expandKey = `${competitorName}-${platform}`
                          const isExpanded = expandedResponse === expandKey

                          return (
                            <div
                              key={platform}
                              className="bg-[var(--surface)] border border-[var(--border-subtle)]"
                              style={{ padding: '12px 16px' }}
                            >
                              {/* Platform header with positioning badge - clickable to expand */}
                              <button
                                onClick={() => hasContent && brandRecognized ? setExpandedResponse(isExpanded ? null : expandKey) : undefined}
                                className="w-full flex items-center justify-between"
                                style={{ cursor: hasContent && brandRecognized ? 'pointer' : 'default' }}
                              >
                                <div className="flex items-center" style={{ gap: '10px' }}>
                                  <span
                                    style={{
                                      width: '10px',
                                      height: '10px',
                                      backgroundColor: platformColors[platform] || 'var(--text-dim)',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span className="font-mono text-sm text-[var(--text)]">
                                    {platformNames[platform] || platform}
                                  </span>
                                  {hasContent && brandRecognized && (
                                    <ChevronDown
                                      size={14}
                                      className="text-[var(--text-dim)]"
                                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                    />
                                  )}
                                </div>
                                <div className="flex items-center" style={{ gap: '8px' }}>
                                  {!result ? (
                                    <span className="text-[var(--text-ghost)] text-xs font-mono">NO DATA</span>
                                  ) : !brandRecognized ? (
                                    <span className="text-[var(--text-ghost)] text-xs font-mono">BRAND UNKNOWN</span>
                                  ) : (
                                    <PositioningBadge positioning={result.positioning} />
                                  )}
                                </div>
                              </button>

                              {/* Expandable response content - collapsed by default */}
                              {isExpanded && result && brandRecognized && hasContent && (
                                <div
                                  className="border-t border-[var(--border-subtle)]"
                                  style={{ marginTop: '12px', paddingTop: '12px' }}
                                >
                                  <div
                                    className="text-[var(--text-mid)] text-sm"
                                    style={{ lineHeight: '1.7' }}
                                  >
                                    {formatResponseText(result.response_text || '')}
                                  </div>
                                </div>
                              )}

                              {/* Show message when brand not recognized */}
                              {result && !brandRecognized && (
                                <p className="text-[var(--text-ghost)] text-sm" style={{ marginTop: '8px' }}>
                                  {platformNames[platform]} doesn&apos;t recognize your brand yet.
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center text-[var(--text-dim)]" style={{ padding: '40px 0' }}>
                <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
                <p>No competitive intelligence available yet</p>
                <p className="text-sm text-[var(--text-ghost)]" style={{ marginTop: '4px' }}>
                  Select competitors above and run your next scan to generate insights
                </p>
              </div>
            )}
          </>
        ) : (
          /* Free tier - blurred/locked view */
          <div className="relative" style={{ minHeight: '200px' }}>
            <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
              See how AI positions you against your top competitor
            </p>

            {/* Mocked positioning cards - blurred */}
            <div style={{ display: 'grid', gap: '12px', filter: 'blur(4px)', opacity: 0.5 }}>
              {['ChatGPT', 'Perplexity', 'Gemini', 'Claude'].map((platform) => (
                <div
                  key={platform}
                  className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                  style={{ padding: '16px 20px' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-[var(--text)]">{platform}</span>
                    <span className="font-mono text-xs text-[var(--green)]">EQUAL</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Upgrade overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.85) 30%, rgba(10,10,10,0.95) 100%)',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  marginBottom: '12px',
                }}
              >
                <Lock size={20} style={{ color: 'var(--bg)' }} />
              </div>
              <p className="text-[var(--text)] font-medium" style={{ marginBottom: '6px' }}>
                Unlock Positioning Analysis
              </p>
              <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '280px', marginBottom: '16px' }}>
                See how each AI platform positions you against competitors
              </p>
              <button
                onClick={onUpgradeClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                Upgrade Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Why competitors matter */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why Competitors Matter
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          These are businesses that AI assistants mention when users ask questions relevant to your
          industry. Understanding who AI recommends instead of you helps identify what content and
          authority signals you need to compete for AI visibility.
        </p>
      </div>

      {/* Rescan Now */}
      <RescanSection
        domainSubscriptionId={domainSubscriptionId || ''}
        isSubscriber={isSubscriber}
      />
    </div>
  )
}
