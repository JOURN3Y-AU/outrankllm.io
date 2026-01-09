'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface TrendDataPoint {
  date: string
  value: number
  label?: string
}

export interface MultiLineSeries {
  key: string
  name: string
  color: string
  data: TrendDataPoint[]
  isOverall?: boolean // If true, render with thicker line and area fill
}

interface TrendChartProps {
  data: TrendDataPoint[]
  height?: number
  showLabels?: boolean
  color?: string
  title?: string
  unit?: string
}

interface MultiLineTrendChartProps {
  series: MultiLineSeries[]
  height?: number
  showLabels?: boolean
  title?: string
  unit?: string
  rightAxisLabel?: string // Label for right axis (default: "Platform %")
  rightAxisUnit?: string // Unit for right axis values (default: "%")
}

/**
 * Simple SVG line chart for displaying score trends
 */
export function TrendChart({
  data,
  height = 120,
  showLabels = true,
  color = 'var(--green)',
  title,
  unit = '%',
}: TrendChartProps) {
  const chartWidth = 280
  const padding = { top: 10, right: 10, bottom: 24, left: 35 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const { points, minValue, maxValue, trend, trendPercent } = useMemo(() => {
    if (data.length === 0) {
      return { points: '', minValue: 0, maxValue: 100, trend: 'neutral' as const, trendPercent: 0 }
    }

    const values = data.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)

    // Add some padding to the range
    const range = max - min
    const minValue = Math.max(0, min - range * 0.1)
    const maxValue = Math.min(100, max + range * 0.1)
    const valueRange = maxValue - minValue || 1

    // Calculate points for the line
    const pts = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * innerWidth
      const y = padding.top + innerHeight - ((d.value - minValue) / valueRange) * innerHeight
      return `${x},${y}`
    }).join(' ')

    // Calculate trend
    const firstValue = data[0]?.value || 0
    const lastValue = data[data.length - 1]?.value || 0
    const trendPercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0
    const trend = trendPercent > 1 ? 'up' : trendPercent < -1 ? 'down' : 'neutral'

    return { points: pts, minValue, maxValue, trend, trendPercent }
  }, [data, innerWidth, innerHeight])

  // Calculate area fill path
  const areaPath = useMemo(() => {
    if (data.length === 0) return ''

    const values = data.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const minValue = Math.max(0, min - range * 0.1)
    const maxValue = Math.min(100, max + range * 0.1)
    const valueRange = maxValue - minValue || 1

    const pts = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * innerWidth
      const y = padding.top + innerHeight - ((d.value - minValue) / valueRange) * innerHeight
      return { x, y }
    })

    const startX = pts[0]?.x || padding.left
    const endX = pts[pts.length - 1]?.x || padding.left + innerWidth
    const bottomY = padding.top + innerHeight

    return `M ${startX},${bottomY} ${pts.map(p => `L ${p.x},${p.y}`).join(' ')} L ${endX},${bottomY} Z`
  }, [data, innerWidth, innerHeight])

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--text-dim)] text-sm"
        style={{ height }}
      >
        No data yet
      </div>
    )
  }

  // Only show chart if we have multiple points
  if (data.length === 1) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height }}
      >
        <div className="text-2xl font-bold" style={{ color }}>
          {data[0].value.toFixed(0)}{unit}
        </div>
        <div className="text-xs text-[var(--text-dim)]" style={{ marginTop: '4px' }}>
          {data[0].label || formatDate(data[0].date)}
        </div>
        <div className="text-xs text-[var(--text-ghost)]" style={{ marginTop: '8px' }}>
          More data points needed for trend
        </div>
      </div>
    )
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--green)' : trend === 'down' ? 'var(--red)' : 'var(--text-dim)'

  return (
    <div>
      {/* Header with title and trend */}
      {(title || trend !== 'neutral') && (
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          {title && (
            <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
              {title}
            </span>
          )}
          <div
            className="flex items-center gap-1 text-xs font-mono"
            style={{ color: trendColor }}
          >
            <TrendIcon size={14} />
            <span>{trendPercent > 0 ? '+' : ''}{trendPercent.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        {/* Grid lines */}
        <g className="grid" stroke="var(--border)" strokeDasharray="2,2" strokeWidth="0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight * (1 - ratio)
            return (
              <line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
              />
            )
          })}
        </g>

        {/* Y-axis labels */}
        {showLabels && (
          <g className="y-labels" fill="var(--text-ghost)" fontSize="9" fontFamily="monospace">
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio)
              const value = minValue + (maxValue - minValue) * ratio
              return (
                <text
                  key={ratio}
                  x={padding.left - 4}
                  y={y + 3}
                  textAnchor="end"
                >
                  {value.toFixed(0)}
                </text>
              )
            })}
          </g>
        )}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={color}
          fillOpacity="0.1"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const values = data.map(d => d.value)
          const min = Math.min(...values)
          const max = Math.max(...values)
          const range = max - min
          const rangeMin = Math.max(0, min - range * 0.1)
          const rangeMax = Math.min(100, max + range * 0.1)
          const valueRange = rangeMax - rangeMin || 1

          const x = padding.left + (i / Math.max(1, data.length - 1)) * innerWidth
          const y = padding.top + innerHeight - ((d.value - rangeMin) / valueRange) * innerHeight

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="3"
                fill="var(--bg)"
                stroke={color}
                strokeWidth="2"
              />
              {/* Tooltip on hover would go here */}
            </g>
          )
        })}

        {/* X-axis labels (first and last date) */}
        {showLabels && data.length >= 2 && (
          <g className="x-labels" fill="var(--text-ghost)" fontSize="9" fontFamily="monospace">
            <text
              x={padding.left}
              y={height - 4}
              textAnchor="start"
            >
              {formatDate(data[0].date)}
            </text>
            <text
              x={padding.left + innerWidth}
              y={height - 4}
              textAnchor="end"
            >
              {formatDate(data[data.length - 1].date)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

/**
 * Compact trend indicator for inline use
 */
export function TrendIndicator({
  currentValue,
  previousValue,
  unit = '%',
}: {
  currentValue: number
  previousValue: number
  unit?: string
}) {
  const diff = currentValue - previousValue
  const percentChange = previousValue > 0 ? (diff / previousValue) * 100 : 0
  const trend = percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'neutral'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--green)' : trend === 'down' ? 'var(--red)' : 'var(--text-dim)'

  return (
    <div
      className="flex items-center gap-1 text-xs font-mono"
      style={{ color: trendColor }}
    >
      <TrendIcon size={12} />
      <span>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit}
      </span>
    </div>
  )
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Dual-axis trend chart showing overall visibility (left axis, %)
 * and per-platform mentions (right axis, whole numbers)
 */
export function MultiLineTrendChart({
  series,
  height = 200,
  showLabels = true,
  title,
  rightAxisLabel = 'Platform %',
  rightAxisUnit = '%',
}: MultiLineTrendChartProps) {
  const padding = { top: 16, right: 45, bottom: 32, left: 45 }

  // Separate overall series from platform series
  const overallSeries = series.find(s => s.isOverall)
  const platformSeries = series.filter(s => !s.isOverall)

  // Calculate chart dimensions and ranges for both axes
  const { innerHeight, dates, leftAxis, rightAxis } = useMemo(() => {
    const allDates: string[] = []

    // Collect all dates
    series.forEach(s => {
      s.data.forEach(d => {
        if (!allDates.includes(d.date)) {
          allDates.push(d.date)
        }
      })
    })

    // Sort dates chronologically
    allDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    // Left axis: Overall visibility (0-100%)
    const overallValues = overallSeries?.data.map(d => d.value) || [0]
    const overallMin = Math.min(...overallValues)
    const overallMax = Math.max(...overallValues)
    const overallRange = overallMax - overallMin
    const leftMin = Math.max(0, overallMin - overallRange * 0.2)
    const leftMax = Math.min(100, overallMax + overallRange * 0.2)

    // Right axis: Dynamic based on values (can be percentages or absolute counts)
    const platformValues = platformSeries.flatMap(s => s.data.map(d => d.value))
    const platformMin = 0 // Always start at 0
    const maxVal = Math.max(1, ...platformValues) // At least 1 to avoid division issues
    // Add 10% padding above max value
    const platformMax = Math.ceil(maxVal * 1.1)

    return {
      innerHeight: height - padding.top - padding.bottom,
      dates: allDates,
      leftAxis: { min: leftMin, max: leftMax, range: leftMax - leftMin || 1 },
      rightAxis: { min: platformMin, max: platformMax, range: platformMax - platformMin || 1 },
    }
  }, [series, height, overallSeries, platformSeries])

  // Helper to calculate X position
  const getX = (date: string, viewBoxWidth: number) => {
    const dateIndex = dates.indexOf(date)
    return padding.left + (dateIndex / Math.max(1, dates.length - 1)) * (viewBoxWidth - padding.left - padding.right)
  }

  // Helper to calculate Y position for left axis (overall %)
  const getYLeft = (value: number) => {
    return padding.top + innerHeight - ((value - leftAxis.min) / leftAxis.range) * innerHeight
  }

  // Helper to calculate Y position for right axis (mentions)
  const getYRight = (value: number) => {
    return padding.top + innerHeight - ((value - rightAxis.min) / rightAxis.range) * innerHeight
  }

  // Calculate overall trend
  const overallTrend = useMemo(() => {
    if (!overallSeries || overallSeries.data.length < 2) return null

    const firstValue = overallSeries.data[0]?.value || 0
    const lastValue = overallSeries.data[overallSeries.data.length - 1]?.value || 0
    const percentChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0
    const trend = percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'neutral'

    return { percentChange, trend }
  }, [overallSeries])

  if (dates.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--text-dim)] text-sm"
        style={{ height }}
      >
        No data yet
      </div>
    )
  }

  const viewBoxWidth = 800
  const TrendIcon = overallTrend?.trend === 'up' ? TrendingUp : overallTrend?.trend === 'down' ? TrendingDown : Minus
  const trendColor = overallTrend?.trend === 'up' ? 'var(--green)' : overallTrend?.trend === 'down' ? 'var(--red)' : 'var(--text-dim)'

  // State for tooltip
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    name: string
    value: string
    date: string
    color: string
  } | null>(null)

  return (
    <div style={{ position: 'relative' }}>
      {/* Header with title */}
      {title && (
        <div style={{ marginBottom: '12px' }}>
          <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        <g className="grid" stroke="var(--border)" strokeDasharray="2,2" strokeWidth="0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight * (1 - ratio)
            return (
              <line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={viewBoxWidth - padding.right}
                y2={y}
              />
            )
          })}
        </g>

        {/* Left Y-axis labels (Overall %) */}
        {showLabels && (
          <g className="y-labels-left" fill="#ffffff" fontSize="10" fontFamily="monospace">
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio)
              const value = leftAxis.min + leftAxis.range * ratio
              return (
                <text
                  key={ratio}
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {value.toFixed(0)}%
                </text>
              )
            })}
            {/* Axis label - rotated beside the axis */}
            <text
              x={12}
              y={padding.top + innerHeight / 2}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-ghost)"
              transform={`rotate(-90, 12, ${padding.top + innerHeight / 2})`}
            >
              Overall Score
            </text>
          </g>
        )}

        {/* Right Y-axis labels */}
        {showLabels && (
          <g className="y-labels-right" fill="var(--text-dim)" fontSize="10" fontFamily="monospace">
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio)
              const value = rightAxis.min + rightAxis.range * ratio
              return (
                <text
                  key={ratio}
                  x={viewBoxWidth - padding.right + 8}
                  y={y + 4}
                  textAnchor="start"
                >
                  {Math.round(value)}{rightAxisUnit === '%' ? '%' : ''}
                </text>
              )
            })}
            {/* Axis label - rotated beside the axis */}
            <text
              x={viewBoxWidth - 12}
              y={padding.top + innerHeight / 2}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-ghost)"
              transform={`rotate(90, ${viewBoxWidth - 12}, ${padding.top + innerHeight / 2})`}
            >
              {rightAxisLabel}
            </text>
          </g>
        )}

        {/* Render platform series (right axis) first so overall is on top */}
        {platformSeries.map((s) => {
          if (s.data.length === 0) return null

          const points = s.data.map((d, i) => ({
            x: getX(d.date, viewBoxWidth),
            y: getYRight(d.value),
            value: d.value,
            date: d.date,
          }))
          const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ')

          return (
            <g key={s.key}>
              {/* Line */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.7"
              />
              {/* Data points with hover */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill={s.color}
                  fillOpacity="0.9"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    if (rect) {
                      const scaleX = rect.width / viewBoxWidth
                      const scaleY = rect.height / height
                      const valueText = rightAxisUnit === '%'
                        ? `${p.value.toFixed(0)}% visibility`
                        : `${p.value} mention${p.value !== 1 ? 's' : ''}`
                      setTooltip({
                        x: rect.left + p.x * scaleX,
                        y: rect.top + p.y * scaleY - 10,
                        name: s.name,
                        value: valueText,
                        date: formatDate(p.date),
                        color: s.color,
                      })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          )
        })}

        {/* Render overall series (left axis) on top */}
        {overallSeries && overallSeries.data.length > 0 && (() => {
          const points = overallSeries.data.map(d => ({
            x: getX(d.date, viewBoxWidth),
            y: getYLeft(d.value),
            value: d.value,
            date: d.date,
          }))
          const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ')

          return (
            <g key={overallSeries.key}>
              {/* Line */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={overallSeries.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points with hover */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="var(--bg)"
                  stroke={overallSeries.color}
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    if (rect) {
                      const scaleX = rect.width / viewBoxWidth
                      const scaleY = rect.height / height
                      setTooltip({
                        x: rect.left + p.x * scaleX,
                        y: rect.top + p.y * scaleY - 10,
                        name: overallSeries.name,
                        value: `${p.value.toFixed(1)}% visibility`,
                        date: formatDate(p.date),
                        color: overallSeries.color,
                      })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          )
        })()}

        {/* X-axis labels */}
        {showLabels && dates.length >= 2 && (
          <g className="x-labels" fill="var(--text-ghost)" fontSize="10" fontFamily="monospace">
            {dates.map((date, i) => {
              const x = getX(date, viewBoxWidth)
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {formatDate(date)}
                </text>
              )
            })}
          </g>
        )}
      </svg>

      {/* Legend - grouped by axis for clarity */}
      <div
        className="flex flex-wrap items-center justify-center"
        style={{ marginTop: '16px', gap: '24px' }}
      >
        {/* Left axis: Score */}
        {overallSeries && (
          <div className="flex items-center gap-2">
            <span
              style={{
                width: '24px',
                height: '3px',
                backgroundColor: overallSeries.color,
                borderRadius: '2px',
              }}
            />
            <span className="font-mono text-xs text-[var(--text)]">
              AI Visibility Score
            </span>
          </div>
        )}

        {/* Divider */}
        {platformSeries.length > 0 && (
          <span
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: 'var(--border)',
            }}
          />
        )}

        {/* Right axis: Mentions by platform */}
        {platformSeries.length > 0 && (
          <div className="flex items-center" style={{ gap: '16px' }}>
            <span className="font-mono text-xs text-[var(--text-ghost)] uppercase" style={{ letterSpacing: '0.05em' }}>
              Mentions:
            </span>
            {platformSeries.map((s) => (
              <div key={s.key} className="flex items-center gap-1">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: s.color,
                  }}
                />
                <span className="font-mono text-xs text-[var(--text-dim)]">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--surface-elevated)',
            border: `1px solid ${tooltip.color}`,
            borderRadius: '4px',
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="font-mono text-xs font-medium"
            style={{ color: tooltip.color, marginBottom: '4px' }}
          >
            {tooltip.name}
          </div>
          <div className="text-sm text-[var(--text)]" style={{ marginBottom: '2px' }}>
            {tooltip.value}
          </div>
          <div className="text-xs text-[var(--text-dim)]">
            {tooltip.date}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Competitor colors - distinct from platform colors
 */
const COMPETITOR_COLORS = [
  '#f97316', // orange
  '#a855f7', // purple
  '#eab308', // yellow
  '#ec4899', // pink
  '#14b8a6', // teal
]

export interface CompetitorMentionsSeries {
  name: string
  isDomain?: boolean // If true, this is the user's domain (use white, thicker line)
  data: { date: string; value: number }[]
}

interface CompetitorMentionsTrendChartProps {
  domain: string
  series: CompetitorMentionsSeries[]
  height?: number
  showLabels?: boolean
  title?: string
}

/**
 * Trend chart showing absolute mention counts for domain vs competitors
 */
export function CompetitorMentionsTrendChart({
  domain,
  series,
  height = 250,
  showLabels = true,
  title,
}: CompetitorMentionsTrendChartProps) {
  const padding = { top: 16, right: 100, bottom: 32, left: 45 } // Extra right padding for labels

  // Separate domain series from competitor series
  const domainSeries = series.find(s => s.isDomain)
  const competitorSeries = series.filter(s => !s.isDomain)

  // Assign colors to competitors
  const competitorWithColors = competitorSeries.map((s, i) => ({
    ...s,
    color: COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }))

  // Calculate chart dimensions and ranges
  const { innerHeight, dates, yAxis } = useMemo(() => {
    const allDates: string[] = []
    const seenDates = new Set<string>()

    for (const s of series) {
      for (const d of s.data) {
        if (!seenDates.has(d.date)) {
          seenDates.add(d.date)
          allDates.push(d.date)
        }
      }
    }
    allDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    // Y-axis: absolute mention counts - scale dynamically to data
    const allValues = series.flatMap(s => s.data.map(d => d.value))
    const maxValue = Math.max(1, ...allValues) // At least 1 to avoid division by zero
    // Add 10% padding above max value, minimum of 1
    const niceMax = Math.max(1, Math.ceil(maxValue * 1.1))

    return {
      innerHeight: height - padding.top - padding.bottom,
      dates: allDates,
      yAxis: { min: 0, max: niceMax, range: niceMax },
    }
  }, [series, height])

  // Helper to get X position
  const getX = (date: string, viewBoxWidth: number) => {
    const dateIndex = dates.indexOf(date)
    if (dates.length <= 1) return padding.left + (viewBoxWidth - padding.left - padding.right) / 2
    return padding.left + (dateIndex / (dates.length - 1)) * (viewBoxWidth - padding.left - padding.right)
  }

  // Helper to get Y position
  const getY = (value: number) => {
    return padding.top + innerHeight - (value / yAxis.range) * innerHeight
  }

  // State for tooltip
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    name: string
    value: string
    date: string
    color: string
  } | null>(null)

  if (dates.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--text-dim)] text-sm"
        style={{ height }}
      >
        No data yet
      </div>
    )
  }

  const viewBoxWidth = 800

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        <g className="grid" stroke="var(--border)" strokeDasharray="2,2" strokeWidth="0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight * (1 - ratio)
            return (
              <line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={viewBoxWidth - padding.right}
                y2={y}
              />
            )
          })}
        </g>

        {/* Y-axis labels (mention counts) */}
        {showLabels && (
          <g className="y-labels" fill="var(--text-dim)" fontSize="10" fontFamily="monospace">
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio)
              const value = yAxis.min + yAxis.range * ratio
              return (
                <text
                  key={ratio}
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {Math.round(value)}
                </text>
              )
            })}
            {/* Axis label */}
            <text
              x={12}
              y={padding.top + innerHeight / 2}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-ghost)"
              transform={`rotate(-90, 12, ${padding.top + innerHeight / 2})`}
            >
              Mentions
            </text>
          </g>
        )}

        {/* Render competitor series first (so domain is on top) */}
        {competitorWithColors.map((s) => {
          if (s.data.length === 0) return null

          const points = s.data.map((d) => ({
            x: getX(d.date, viewBoxWidth),
            y: getY(d.value),
            value: d.value,
            date: d.date,
          }))
          const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ')

          return (
            <g key={s.name}>
              {/* Line */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.8"
              />
              {/* Data points with hover */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill={s.color}
                  fillOpacity="0.9"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    if (rect) {
                      const scaleX = rect.width / viewBoxWidth
                      const scaleY = rect.height / height
                      setTooltip({
                        x: rect.left + p.x * scaleX,
                        y: rect.top + p.y * scaleY - 10,
                        name: s.name,
                        value: `${p.value} mention${p.value !== 1 ? 's' : ''}`,
                        date: formatDate(p.date),
                        color: s.color,
                      })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
              {/* Label next to last data point */}
              {points.length > 0 && (
                <text
                  x={points[points.length - 1].x + 12}
                  y={points[points.length - 1].y + 4}
                  fontSize="10"
                  fontFamily="monospace"
                  fill={s.color}
                >
                  {s.name}
                </text>
              )}
            </g>
          )
        })}

        {/* Render domain series on top */}
        {domainSeries && domainSeries.data.length > 0 && (() => {
          const points = domainSeries.data.map(d => ({
            x: getX(d.date, viewBoxWidth),
            y: getY(d.value),
            value: d.value,
            date: d.date,
          }))
          const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ')

          return (
            <g>
              {/* Line */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points with hover */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="var(--bg)"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    if (rect) {
                      const scaleX = rect.width / viewBoxWidth
                      const scaleY = rect.height / height
                      setTooltip({
                        x: rect.left + p.x * scaleX,
                        y: rect.top + p.y * scaleY - 10,
                        name: domain,
                        value: `${p.value} mention${p.value !== 1 ? 's' : ''}`,
                        date: formatDate(p.date),
                        color: '#ffffff',
                      })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
              {/* Label next to last data point */}
              {points.length > 0 && (
                <text
                  x={points[points.length - 1].x + 12}
                  y={points[points.length - 1].y + 4}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#ffffff"
                >
                  {domain}
                </text>
              )}
            </g>
          )
        })()}

        {/* X-axis labels */}
        {showLabels && dates.length >= 2 && (
          <g className="x-labels" fill="var(--text-ghost)" fontSize="10" fontFamily="monospace">
            {dates.map((date, i) => {
              const x = getX(date, viewBoxWidth)
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {formatDate(date)}
                </text>
              )
            })}
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--surface-elevated)',
            border: `1px solid ${tooltip.color}`,
            borderRadius: '4px',
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="font-mono text-xs font-medium"
            style={{ color: tooltip.color, marginBottom: '4px' }}
          >
            {tooltip.name}
          </div>
          <div className="text-sm text-[var(--text)]" style={{ marginBottom: '2px' }}>
            {tooltip.value}
          </div>
          <div className="text-xs text-[var(--text-dim)]">
            {tooltip.date}
          </div>
        </div>
      )}
    </div>
  )
}
