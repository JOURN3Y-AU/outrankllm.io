'use client'

/**
 * HiringBrand Trends Component
 * Shows historical score data and competitive ranking over time
 *
 * Features:
 * 1. Core scores over time (Desirability, Awareness, Differentiation)
 * 2. Competitive ranking line chart (all employers)
 * 3. Platform score trends
 */

import { useState, useMemo } from 'react'
import { hbColors, hbFonts, hbShadows, hbRadii, hbRoleFamilyConfig } from './shared/constants'
import type { HBTrendsData, HBScoreHistoryEntry, HBCompetitorHistorySnapshot, HBRoleFamily, HBJobFamily } from './shared/types'

interface HBTrendsProps {
  trends: HBTrendsData
  companyName: string
  currentCompetitorNames?: string[] // Names from current competitor analysis (frozen + researched)
  roleFamilies?: HBRoleFamily[]
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format date for longer display
function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Colors for different employers in the competitive chart
const employerChartColors = [
  hbColors.teal, // Target employer
  hbColors.coral,
  hbColors.gold,
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EF4444', // Red
  '#84CC16', // Lime
]

/**
 * Core Scores Line Chart
 * Shows Desirability, Awareness, Differentiation over time
 */
function CoreScoresChart({ history }: { history: HBScoreHistoryEntry[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: HBScoreHistoryEntry; metric: string } | null>(null)

  if (history.length < 2) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: hbColors.surfaceRaised,
        borderRadius: hbRadii.lg,
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
        <div style={{ fontFamily: hbFonts.display, fontSize: '16px', color: hbColors.slate, marginBottom: '8px' }}>
          Not Enough Data Yet
        </div>
        <div style={{ fontSize: '14px', color: hbColors.slateLight }}>
          Score trends will appear after your second scan.
        </div>
      </div>
    )
  }

  const width = 1200
  const height = 300
  const padding = { top: 30, right: 30, bottom: 50, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate scales
  const xScale = (index: number) => padding.left + (index / (history.length - 1)) * chartWidth
  const yScale = (value: number) => height - padding.bottom - (value / 100) * chartHeight

  // Generate path for a metric
  const generatePath = (metric: 'desirabilityScore' | 'awarenessScore' | 'differentiationScore') => {
    return history
      .map((h, i) => {
        const value = h[metric] ?? 50
        const x = xScale(i)
        const y = yScale(value)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')
  }

  const metrics = [
    { key: 'desirabilityScore' as const, label: 'Desirability', color: hbColors.teal },
    { key: 'awarenessScore' as const, label: 'Awareness', color: hbColors.gold },
    { key: 'differentiationScore' as const, label: 'Differentiation', color: hbColors.coral },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Y-axis grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              stroke={hbColors.surfaceDim}
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill={hbColors.slateLight}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {history.map((h, i) => {
          // Show every nth label to avoid crowding
          const showLabel = history.length <= 8 || i % Math.ceil(history.length / 8) === 0 || i === history.length - 1
          if (!showLabel) return null
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="10"
              fill={hbColors.slateLight}
            >
              {formatDate(h.scanDate)}
            </text>
          )
        })}

        {/* Lines for each metric */}
        {metrics.map((metric) => (
          <path
            key={metric.key}
            d={generatePath(metric.key)}
            fill="none"
            stroke={metric.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Data points for each metric */}
        {metrics.map((metric) =>
          history.map((h, i) => {
            const value = h[metric.key] ?? 50
            return (
              <circle
                key={`${metric.key}-${i}`}
                cx={xScale(i)}
                cy={yScale(value)}
                r="5"
                fill={metric.color}
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoveredPoint({ x: rect.left, y: rect.top, data: h, metric: metric.label })
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
        {metrics.map((metric) => (
          <div key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: metric.color }} />
            <span style={{ fontSize: '13px', color: hbColors.slateMid }}>{metric.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'fixed',
            left: hoveredPoint.x + 10,
            top: hoveredPoint.y - 60,
            padding: '10px 14px',
            background: hbColors.slate,
            color: 'white',
            borderRadius: hbRadii.md,
            boxShadow: hbShadows.lg,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontFamily: hbFonts.display, fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
            {formatDateLong(hoveredPoint.data.scanDate)}
          </div>
          <div style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600 }}>
            {hoveredPoint.metric}: {(() => {
              if (hoveredPoint.metric === 'Desirability') return hoveredPoint.data.desirabilityScore ?? '--'
              if (hoveredPoint.metric === 'Awareness') return hoveredPoint.data.awarenessScore ?? '--'
              if (hoveredPoint.metric === 'Differentiation') return hoveredPoint.data.differentiationScore ?? '--'
              return '--'
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Role Family Scores Chart
 * Shows desirability scores for each active role family over time
 */
function RoleFamilyScoresChart({ history, roleFamilies }: { history: HBScoreHistoryEntry[]; roleFamilies: HBRoleFamily[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: HBScoreHistoryEntry; family: string; familyLabel: string } | null>(null)

  if (history.length < 2) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: hbColors.surfaceRaised,
        borderRadius: hbRadii.lg,
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
        <div style={{ fontFamily: hbFonts.display, fontSize: '16px', color: hbColors.slate, marginBottom: '8px' }}>
          Not Enough Data Yet
        </div>
        <div style={{ fontSize: '14px', color: hbColors.slateLight }}>
          Role-specific score trends will appear after your second scan.
        </div>
      </div>
    )
  }

  if (roleFamilies.length === 0) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: hbColors.surfaceRaised,
        borderRadius: hbRadii.lg,
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>👔</div>
        <div style={{ fontFamily: hbFonts.display, fontSize: '16px', color: hbColors.slate, marginBottom: '8px' }}>
          No Role Families Configured
        </div>
        <div style={{ fontSize: '14px', color: hbColors.slateLight }}>
          Configure role families on the Setup tab to see role-specific trends.
        </div>
      </div>
    )
  }

  const width = 1200
  const height = 300
  const padding = { top: 30, right: 30, bottom: 50, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate scales
  const xScale = (index: number) => padding.left + (index / (history.length - 1)) * chartWidth
  const yScale = (value: number) => height - padding.bottom - (value / 100) * chartHeight

  // Generate path for a role family
  const generateFamilyPath = (family: HBJobFamily) => {
    return history
      .map((h, i) => {
        const familyScores = h.roleFamilyScores || {}
        const value = familyScores[family]?.desirability ?? 50
        const x = xScale(i)
        const y = yScale(value)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Y-axis grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              stroke={hbColors.surfaceDim}
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill={hbColors.slateLight}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {history.map((h, i) => {
          const showLabel = history.length <= 8 || i % Math.ceil(history.length / 8) === 0 || i === history.length - 1
          if (!showLabel) return null
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="10"
              fill={hbColors.slateLight}
            >
              {formatDate(h.scanDate)}
            </text>
          )
        })}

        {/* Lines for each role family */}
        {roleFamilies.map((rf) => {
          const config = hbRoleFamilyConfig[rf.family]
          return (
            <path
              key={rf.family}
              d={generateFamilyPath(rf.family)}
              fill="none"
              stroke={config.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {/* Data points for each role family */}
        {roleFamilies.map((rf) => {
          const config = hbRoleFamilyConfig[rf.family]
          return history.map((h, i) => {
            const familyScores = h.roleFamilyScores || {}
            const value = familyScores[rf.family]?.desirability ?? 50
            return (
              <circle
                key={`${rf.family}-${i}`}
                cx={xScale(i)}
                cy={yScale(value)}
                r="5"
                fill={config.color}
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoveredPoint({ x: rect.left, y: rect.top, data: h, family: rf.family, familyLabel: rf.displayName })
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            )
          })
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
        {roleFamilies.map((rf) => {
          const config = hbRoleFamilyConfig[rf.family]
          return (
            <div key={rf.family} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: config.color }} />
              <span style={{ fontSize: '13px', color: hbColors.slateMid }}>{rf.displayName}</span>
            </div>
          )
        })}
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'fixed',
            left: hoveredPoint.x + 10,
            top: hoveredPoint.y - 60,
            padding: '10px 14px',
            background: hbColors.slate,
            color: 'white',
            borderRadius: hbRadii.md,
            boxShadow: hbShadows.lg,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontFamily: hbFonts.display, fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
            {formatDateLong(hoveredPoint.data.scanDate)}
          </div>
          <div style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600 }}>
            {hoveredPoint.familyLabel}: {(() => {
              const familyScores = hoveredPoint.data.roleFamilyScores || {}
              return familyScores[hoveredPoint.family]?.desirability ?? '--'
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Competitive Ranking Line Chart
 * Shows all employers' composite scores over time
 */
function CompetitiveRankingChart({
  history,
  companyName,
  currentCompetitorNames,
}: {
  history: HBCompetitorHistorySnapshot[]
  companyName: string
  currentCompetitorNames?: string[]
}) {
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set())
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number
    y: number
    employer: string
    score: number
    rank: number
    date: string
  } | null>(null)

  // Get unique employers across all snapshots, filtered to current competitor set
  const allEmployers = useMemo(() => {
    const employers = new Map<string, { isTarget: boolean; latestScore: number; latestRank: number }>()
    for (const snapshot of history) {
      for (const emp of snapshot.employers) {
        if (!employers.has(emp.name)) {
          employers.set(emp.name, {
            isTarget: emp.isTarget,
            latestScore: emp.compositeScore,
            latestRank: emp.rankByComposite,
          })
        } else {
          // Update with latest values
          employers.set(emp.name, {
            ...employers.get(emp.name)!,
            latestScore: emp.compositeScore,
            latestRank: emp.rankByComposite,
          })
        }
      }
    }

    const all = Array.from(employers.entries())
      .map(([name, data]) => ({ name, ...data }))

    // Filter to only employers in the current competitor analysis (frozen + researched)
    // This ensures the chart matches what's shown on the Competitors tab
    if (currentCompetitorNames && currentCompetitorNames.length > 0) {
      const allowedNames = new Set(currentCompetitorNames.map(n => n.toLowerCase()))
      const filtered = all.filter(
        (e) => e.isTarget || allowedNames.has(e.name.toLowerCase())
      )
      return filtered.sort((a, b) => a.latestRank - b.latestRank)
    }

    // Fallback: target + top 5 by rank if no competitor list provided
    const sorted = all.sort((a, b) => a.latestRank - b.latestRank)
    const target = sorted.filter((e) => e.isTarget)
    const competitors = sorted.filter((e) => !e.isTarget).slice(0, 5)
    return [...target, ...competitors].sort((a, b) => a.latestRank - b.latestRank)
  }, [history, currentCompetitorNames])

  // Initialize selection with target employer
  useState(() => {
    const target = allEmployers.find((e) => e.isTarget)
    if (target) {
      setSelectedEmployers(new Set([target.name]))
    }
  })

  // Toggle employer selection
  const toggleEmployer = (name: string) => {
    const newSelected = new Set(selectedEmployers)
    if (newSelected.has(name)) {
      // Always keep at least the target selected
      const employer = allEmployers.find((e) => e.name === name)
      if (!employer?.isTarget) {
        newSelected.delete(name)
      }
    } else {
      newSelected.add(name)
    }
    setSelectedEmployers(newSelected)
  }

  if (history.length < 2) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: hbColors.surfaceRaised,
          borderRadius: hbRadii.lg,
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📈</div>
        <div
          style={{ fontFamily: hbFonts.display, fontSize: '16px', color: hbColors.slate, marginBottom: '8px' }}
        >
          Competitive Trends Coming Soon
        </div>
        <div style={{ fontSize: '14px', color: hbColors.slateLight }}>
          Track how you compare to competitors over time after your second scan.
        </div>
      </div>
    )
  }

  const width = 1200
  const height = 350
  const padding = { top: 30, right: 30, bottom: 50, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Score scale: 0-10 (composite scores)
  const maxScore = 10
  const xScale = (index: number) => padding.left + (index / (history.length - 1)) * chartWidth
  const yScale = (value: number) => height - padding.bottom - (value / maxScore) * chartHeight

  // Generate path for an employer
  const generateEmployerPath = (employerName: string) => {
    const points: string[] = []
    history.forEach((snapshot, i) => {
      const emp = snapshot.employers.find((e) => e.name === employerName)
      if (emp) {
        const x = xScale(i)
        const y = yScale(emp.compositeScore)
        points.push(points.length === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)
      }
    })
    return points.join(' ')
  }

  // Get color for employer
  const getEmployerColor = (name: string, index: number) => {
    const emp = allEmployers.find((e) => e.name === name)
    if (emp?.isTarget) return hbColors.teal
    return employerChartColors[index % employerChartColors.length]
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Employer selection */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {allEmployers.map((emp, index) => {
          const isSelected = selectedEmployers.has(emp.name) || (selectedEmployers.size === 0 && emp.isTarget)
          const color = getEmployerColor(emp.name, index)
          return (
            <button
              key={emp.name}
              onClick={() => toggleEmployer(emp.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: hbRadii.sm,
                border: isSelected ? `2px solid ${color}` : `1px solid ${hbColors.surfaceDim}`,
                background: isSelected ? `${color}15` : hbColors.surface,
                cursor: emp.isTarget ? 'default' : 'pointer',
                opacity: isSelected ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: hbFonts.display, fontSize: '12px', color: isSelected ? hbColors.slate : hbColors.slateLight }}>
                {emp.name}
                {emp.isTarget && ' (You)'}
              </span>
              <span style={{ fontSize: '11px', color: color, fontWeight: 600 }}>
                #{emp.latestRank}
              </span>
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
          {/* Y-axis grid lines */}
          {[0, 2, 4, 6, 8, 10].map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={yScale(tick)}
                x2={width - padding.right}
                y2={yScale(tick)}
                stroke={hbColors.surfaceDim}
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill={hbColors.slateLight}
              >
                {tick}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {history.map((h, i) => {
            const showLabel = history.length <= 8 || i % Math.ceil(history.length / 8) === 0 || i === history.length - 1
            if (!showLabel) return null
            return (
              <text
                key={i}
                x={xScale(i)}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fontSize="10"
                fill={hbColors.slateLight}
              >
                {formatDate(h.scanDate)}
              </text>
            )
          })}

          {/* Lines for selected employers */}
          {allEmployers
            .filter((emp) => selectedEmployers.has(emp.name) || (selectedEmployers.size === 0 && emp.isTarget))
            .map((emp, index) => {
              const color = getEmployerColor(emp.name, allEmployers.indexOf(emp))
              return (
                <path
                  key={emp.name}
                  d={generateEmployerPath(emp.name)}
                  fill="none"
                  stroke={color}
                  strokeWidth={emp.isTarget ? '3' : '2'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={emp.isTarget ? 1 : 0.8}
                />
              )
            })}

          {/* Data points */}
          {allEmployers
            .filter((emp) => selectedEmployers.has(emp.name) || (selectedEmployers.size === 0 && emp.isTarget))
            .map((emp) => {
              const color = getEmployerColor(emp.name, allEmployers.indexOf(emp))
              return history.map((snapshot, i) => {
                const empData = snapshot.employers.find((e) => e.name === emp.name)
                if (!empData) return null
                return (
                  <circle
                    key={`${emp.name}-${i}`}
                    cx={xScale(i)}
                    cy={yScale(empData.compositeScore)}
                    r={emp.isTarget ? '5' : '4'}
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredPoint({
                        x: rect.left,
                        y: rect.top,
                        employer: emp.name,
                        score: empData.compositeScore,
                        rank: empData.rankByComposite,
                        date: snapshot.scanDate,
                      })
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                )
              })
            })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'fixed',
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 70,
              padding: '10px 14px',
              background: hbColors.slate,
              color: 'white',
              borderRadius: hbRadii.md,
              boxShadow: hbShadows.lg,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontFamily: hbFonts.display, fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
              {formatDateLong(hoveredPoint.date)}
            </div>
            <div style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600 }}>
              {hoveredPoint.employer}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px' }}>
                Score: <strong>{hoveredPoint.score.toFixed(1)}</strong>/10
              </span>
              <span style={{ fontSize: '12px' }}>
                Rank: <strong>#{hoveredPoint.rank}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Main Trends Component
 */
export function HBTrends({ trends, companyName, currentCompetitorNames, roleFamilies = [] }: HBTrendsProps) {
  const [viewMode, setViewMode] = useState<'overall' | 'role-families'>('overall')

  // Only show role family toggle if we have role families
  const showRoleFamilyToggle = roleFamilies.length > 0 && trends.hasTrends

  if (!trends.hasTrends) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Empty state */}
        <div
          style={{
            background: hbColors.surface,
            borderRadius: hbRadii.lg,
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: hbShadows.sm,
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📈</div>
          <div
            style={{ fontFamily: hbFonts.display, fontSize: '20px', color: hbColors.slate, marginBottom: '8px' }}
          >
            Trends Coming Soon
          </div>
          <div
            style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}
          >
            After your second scan, you'll see how your employer brand scores change over time and compare to competitors.
          </div>
          <div
            style={{
              marginTop: '24px',
              padding: '16px 20px',
              background: hbColors.surfaceRaised,
              borderRadius: hbRadii.md,
              display: 'inline-block',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>💡</span>
              <span style={{ fontSize: '14px', color: hbColors.slateMid, textAlign: 'left' }}>
                <strong style={{ color: hbColors.slate }}>Tip:</strong> Set up weekly scans to track your employer brand health over time.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Core Scores Over Time */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '24px',
          boxShadow: hbShadows.sm,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <h3
            style={{
              fontFamily: hbFonts.display,
              fontSize: '18px',
              fontWeight: 600,
              color: hbColors.slate,
            }}
          >
            Your Scores Over Time <span style={{ fontSize: '13px', fontWeight: 400, color: hbColors.slateLight }}>(0-100)</span>
          </h3>

          {/* View Toggle */}
          {showRoleFamilyToggle && (
            <div style={{ display: 'flex', gap: '8px', background: hbColors.surfaceDim, borderRadius: hbRadii.md, padding: '4px' }}>
              <button
                onClick={() => setViewMode('overall')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: hbFonts.display,
                  background: viewMode === 'overall' ? hbColors.teal : 'transparent',
                  color: viewMode === 'overall' ? 'white' : hbColors.slateMid,
                  border: 'none',
                  borderRadius: hbRadii.md,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Overall
              </button>
              <button
                onClick={() => setViewMode('role-families')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: hbFonts.display,
                  background: viewMode === 'role-families' ? hbColors.teal : 'transparent',
                  color: viewMode === 'role-families' ? 'white' : hbColors.slateMid,
                  border: 'none',
                  borderRadius: hbRadii.md,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                By Role Family
              </button>
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: hbColors.slateLight, marginBottom: '24px' }}>
          {viewMode === 'overall'
            ? 'Track your Desirability, Awareness, and Differentiation scores over time'
            : 'Compare desirability scores across different role families over time'}
        </p>

        {viewMode === 'overall' ? (
          <CoreScoresChart history={trends.scoreHistory} />
        ) : (
          <RoleFamilyScoresChart history={trends.scoreHistory} roleFamilies={roleFamilies} />
        )}
      </div>

      {/* Competitive Ranking Over Time */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '24px',
          boxShadow: hbShadows.sm,
        }}
      >
        <h3
          style={{
            fontFamily: hbFonts.display,
            fontSize: '18px',
            fontWeight: 600,
            color: hbColors.slate,
            marginBottom: '4px',
          }}
        >
          Competitive Position Over Time <span style={{ fontSize: '13px', fontWeight: 400, color: hbColors.slateLight }}>(0-10 composite)</span>
        </h3>
        <p style={{ fontSize: '13px', color: hbColors.slateLight, marginBottom: '24px' }}>
          Compare how {companyName} ranks against competitors across all dimensions
        </p>
        <CompetitiveRankingChart history={trends.competitorHistory} companyName={companyName} currentCompetitorNames={currentCompetitorNames} />
        <p style={{ fontSize: '12px', color: hbColors.slateLight, marginTop: '12px', fontStyle: 'italic' }}>
          The composite score averages your 7 employer dimension scores on a 0-10 scale.
        </p>
      </div>

      {/* Quick Stats */}
      {trends.scoreHistory.length >= 2 && (
        <div
          style={{
            background: `linear-gradient(135deg, ${hbColors.tealLight}, ${hbColors.surface})`,
            borderRadius: hbRadii.lg,
            padding: '20px 24px',
            boxShadow: hbShadows.sm,
            border: `1px solid ${hbColors.teal}30`,
          }}
        >
          <h4
            style={{
              fontFamily: hbFonts.display,
              fontSize: '15px',
              fontWeight: 600,
              color: hbColors.tealDeep,
              marginBottom: '16px',
            }}
          >
            Score Changes
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {(() => {
              const latest = trends.scoreHistory[trends.scoreHistory.length - 1]
              const previous = trends.scoreHistory[trends.scoreHistory.length - 2]
              const metrics = [
                { label: 'Desirability', current: latest.desirabilityScore, prev: previous.desirabilityScore },
                { label: 'Awareness', current: latest.awarenessScore, prev: previous.awarenessScore },
                { label: 'Differentiation', current: latest.differentiationScore, prev: previous.differentiationScore },
              ]
              return metrics.map((m) => {
                const change = (m.current ?? 0) - (m.prev ?? 0)
                const isPositive = change > 0
                const isNegative = change < 0
                return (
                  <div key={m.label} style={{ flex: '1 1 120px', minWidth: '120px' }}>
                    <div style={{ fontSize: '12px', color: hbColors.slateLight, marginBottom: '4px' }}>
                      {m.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: hbFonts.display, fontSize: '24px', fontWeight: 700, color: hbColors.slate }}>
                        {m.current ?? '--'}
                      </span>
                      {change !== 0 && (
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isPositive ? hbColors.teal : isNegative ? hbColors.coral : hbColors.slateLight,
                          }}
                        >
                          {isPositive ? '↑' : '↓'} {Math.abs(change)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
