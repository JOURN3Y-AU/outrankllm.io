'use client'

/**
 * HiringBrand Competitor Comparison
 * Shows how your brand compares to competitors on key employer dimensions
 *
 * Features:
 * 1. Spider/radar chart for dimension comparison (apples-to-apples)
 * 2. Favorability comparison based on mention sentiment
 * 3. Strategic insights and recommendations
 */

import { useState, useMemo } from 'react'
import { hbColors, hbFonts, hbShadows, hbRadii, hbPlatformConfig } from './shared/constants'
import type { HBResponse, HBPlatform, HBCompetitorAnalysis, HBEmployerDimension } from './shared/types'

interface Competitor {
  name: string
  count: number
}

interface HBCompetitorListProps {
  competitors: Competitor[]
  companyName: string
  responses: HBResponse[]
  yourDesirability: number
  competitorAnalysis: HBCompetitorAnalysis | null
}

// Dimension display labels
const dimensionLabels: Record<HBEmployerDimension, string> = {
  compensation: 'Compensation',
  culture: 'Culture',
  growth: 'Growth',
  balance: 'Work-Life',
  leadership: 'Leadership',
  tech: 'Technology',
  mission: 'Mission',
}

// Dimension descriptions for tooltips
const dimensionDescriptions: Record<HBEmployerDimension, string> = {
  compensation: 'Pay levels, bonuses, equity packages, and overall financial rewards relative to market',
  culture: 'Work environment, team dynamics, collaboration, values alignment, and day-to-day experience',
  growth: 'Career progression speed, learning opportunities, mentorship, and promotion paths',
  balance: 'Work-life balance, flexibility, remote options, and reasonable working hours',
  leadership: 'Management quality, executive vision, transparency, trust, and strategic direction',
  tech: 'Technology stack, innovation culture, engineering practices, and technical debt management',
  mission: 'Company purpose, social impact, meaningful work, and employee pride in the mission',
}

// Dimension icons
const dimensionIcons: Record<HBEmployerDimension, string> = {
  compensation: '💰',
  culture: '🎯',
  growth: '📈',
  balance: '⚖️',
  leadership: '👔',
  tech: '💻',
  mission: '🌟',
}

// Calculate composite score (average across all dimensions)
function calculateCompositeScore(scores: Record<string, number>): number {
  const values = Object.values(scores)
  if (values.length === 0) return 5
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

// Colors for employers in the chart (up to 11: 1 target + 10 competitors)
const employerColors = [
  hbColors.teal, // Target employer (always first)
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
 * Spider/Radar Chart Component
 * SVG-based visualization for multi-dimensional comparison
 */
function SpiderChart({
  analysis,
  targetName,
}: {
  analysis: HBCompetitorAnalysis
  targetName: string
}) {
  const [hoveredEmployer, setHoveredEmployer] = useState<string | null>(null)
  const [hoveredDimension, setHoveredDimension] = useState<HBEmployerDimension | null>(null)

  // Sort employers by composite score (highest first)
  const employersWithScores = useMemo(() => {
    return analysis.employers
      .map((emp) => ({
        ...emp,
        compositeScore: calculateCompositeScore(emp.scores),
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
  }, [analysis.employers])

  // Default: show target + the top competitor (or second if target is top)
  const getDefaultSelection = () => {
    const target = employersWithScores.find((e) => e.isTarget)
    // Top competitor is first non-target in sorted list
    const topCompetitor = employersWithScores.find((e) => !e.isTarget)

    const defaults = new Set<string>()
    if (target) defaults.add(target.name)
    if (topCompetitor) defaults.add(topCompetitor.name)
    return defaults
  }

  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(getDefaultSelection)

  const dimensions = analysis.dimensions
  const centerX = 250
  const centerY = 250
  const maxRadius = 190

  // Calculate polygon points for an employer
  const getPolygonPoints = (scores: Record<string, number>): string => {
    return dimensions
      .map((dim, i) => {
        const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2
        const score = scores[dim] || 5
        const radius = (score / 10) * maxRadius
        const x = centerX + radius * Math.cos(angle)
        const y = centerY + radius * Math.sin(angle)
        return `${x},${y}`
      })
      .join(' ')
  }

  // Get axis end points
  const getAxisPoints = () => {
    return dimensions.map((dim, i) => {
      const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2
      return {
        x: centerX + maxRadius * Math.cos(angle),
        y: centerY + maxRadius * Math.sin(angle),
        labelX: centerX + (maxRadius + 25) * Math.cos(angle),
        labelY: centerY + (maxRadius + 25) * Math.sin(angle),
        dim,
      }
    })
  }

  const axisPoints = getAxisPoints()

  // Toggle employer visibility
  const toggleEmployer = (name: string) => {
    const newSelected = new Set(selectedEmployers)
    if (newSelected.has(name)) {
      // Don't allow deselecting the target
      const employer = analysis.employers.find((e) => e.name === name)
      if (!employer?.isTarget) {
        newSelected.delete(name)
      }
    } else {
      newSelected.add(name)
    }
    setSelectedEmployers(newSelected)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Legend / Employer toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: hbColors.slateLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Click employers to show/hide on chart
        </div>
        <div style={{ fontSize: '12px', color: hbColors.slateMid, marginBottom: '4px' }}>
          Composite score = average across all 7 dimensions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
          {employersWithScores.map((emp, sortedIndex) => {
            const isSelected = selectedEmployers.has(emp.name)
            // Use original index for color consistency
            const originalIndex = analysis.employers.findIndex((e) => e.name === emp.name)
            const color = employerColors[originalIndex] || hbColors.slateLight
            const rank = sortedIndex + 1
            return (
              <button
                key={emp.name}
                onClick={() => toggleEmployer(emp.name)}
                onMouseEnter={() => setHoveredEmployer(emp.name)}
                onMouseLeave={() => setHoveredEmployer(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: hbRadii.md,
                  border: isSelected ? `2px solid ${color}` : `2px solid ${hbColors.surfaceDim}`,
                  background: isSelected ? `${color}15` : hbColors.surface,
                  cursor: emp.isTarget ? 'default' : 'pointer',
                  opacity: isSelected ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 2px 8px ${color}30` : 'none',
                }}
                onMouseOver={(e) => {
                  if (!emp.isTarget) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 4px 12px ${color}40`
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = isSelected ? `0 2px 8px ${color}30` : 'none'
                }}
              >
                {/* Rank badge */}
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: rank === 1 ? hbColors.gold : rank <= 3 ? `${color}30` : hbColors.surfaceDim,
                    color: rank === 1 ? 'white' : rank <= 3 ? color : hbColors.slateLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: hbFonts.display,
                  }}
                >
                  {rank}
                </div>
                {/* Toggle indicator */}
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: `2px solid ${isSelected ? color : hbColors.slateLight}`,
                    background: isSelected ? color : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: 'white',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && '✓'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontFamily: hbFonts.display,
                      fontSize: '13px',
                      fontWeight: emp.isTarget ? 600 : 500,
                      color: isSelected ? hbColors.slate : hbColors.slateLight,
                      lineHeight: 1.2,
                    }}
                  >
                    {emp.name}
                    {emp.isTarget && (
                      <span style={{ fontSize: '10px', color: hbColors.tealDeep, marginLeft: '4px' }}>
                        (You)
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: rank === 1 ? hbColors.gold : isSelected ? color : hbColors.slateLight,
                    }}
                  >
                    {emp.compositeScore}/10
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <svg width="500" height="500" viewBox="0 0 500 500">
          {/* Background circles */}
          {[2, 4, 6, 8, 10].map((level) => (
            <circle
              key={level}
              cx={centerX}
              cy={centerY}
              r={(level / 10) * maxRadius}
              fill="none"
              stroke={hbColors.surfaceDim}
              strokeWidth="1"
            />
          ))}

          {/* Score labels on circles */}
          {[2, 4, 6, 8, 10].map((level) => (
            <text
              key={`label-${level}`}
              x={centerX + 5}
              y={centerY - (level / 10) * maxRadius + 4}
              fontSize="10"
              fill={hbColors.slateLight}
            >
              {level}
            </text>
          ))}

          {/* Axis lines */}
          {axisPoints.map((point, i) => (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={point.x}
              y2={point.y}
              stroke={hbColors.surfaceDim}
              strokeWidth="1"
            />
          ))}

          {/* Employer polygons */}
          {analysis.employers
            .filter((emp) => selectedEmployers.has(emp.name))
            .map((emp, i) => {
              const color = employerColors[analysis.employers.indexOf(emp)] || hbColors.slateLight
              const isHovered = hoveredEmployer === emp.name
              return (
                <polygon
                  key={emp.name}
                  points={getPolygonPoints(emp.scores)}
                  fill={`${color}${isHovered ? '40' : '20'}`}
                  stroke={color}
                  strokeWidth={emp.isTarget || isHovered ? 3 : 2}
                  style={{ transition: 'all 0.3s ease' }}
                />
              )
            })}

          {/* Axis labels with hover interaction */}
          {axisPoints.map((point) => (
            <g
              key={point.dim}
              onMouseEnter={() => setHoveredDimension(point.dim)}
              onMouseLeave={() => setHoveredDimension(null)}
              style={{ cursor: 'help' }}
            >
              {/* Hit area - larger invisible rect for easier hover */}
              <rect
                x={point.labelX - 40}
                y={point.labelY - 12}
                width="80"
                height="24"
                fill="transparent"
              />
              <text
                x={point.labelX}
                y={point.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="500"
                fill={hoveredDimension === point.dim ? hbColors.tealDeep : hbColors.slate}
                fontFamily={hbFonts.display}
                style={{ transition: 'fill 0.15s ease' }}
              >
                {dimensionLabels[point.dim]}
              </text>
              {/* Underline indicator on hover */}
              {hoveredDimension === point.dim && (
                <line
                  x1={point.labelX - 25}
                  x2={point.labelX + 25}
                  y1={point.labelY + 8}
                  y2={point.labelY + 8}
                  stroke={hbColors.teal}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </g>
          ))}
        </svg>

        {/* Dimension tooltip */}
        {hoveredDimension && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              padding: '12px 16px',
              background: hbColors.slate,
              color: 'white',
              borderRadius: hbRadii.md,
              boxShadow: hbShadows.lg,
              maxWidth: '280px',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '16px' }}>{dimensionIcons[hoveredDimension]}</span>
              <span
                style={{
                  fontFamily: hbFonts.display,
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {dimensionLabels[hoveredDimension]}
              </span>
            </div>
            <p
              style={{
                fontFamily: hbFonts.body,
                fontSize: '13px',
                lineHeight: 1.5,
                margin: 0,
                opacity: 0.9,
              }}
            >
              {dimensionDescriptions[hoveredDimension]}
            </p>
            {/* Arrow pointer */}
            <div
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `6px solid ${hbColors.slate}`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Dimension Score Comparison Table
 * Shows scores for each dimension with top performers and actionable insights
 */
function DimensionTable({ analysis, companyName }: { analysis: HBCompetitorAnalysis; companyName: string }) {
  const targetEmployer = analysis.employers.find((e) => e.isTarget)
  const [expandedDim, setExpandedDim] = useState<HBEmployerDimension | null>(null)

  if (!targetEmployer) return null

  // Sort dimensions: strengths first (by score desc), then neutral (by score desc), then weaknesses (by score desc)
  const sortedDimensions = [...analysis.dimensions].sort((a, b) => {
    const aIsStrength = analysis.insights.strengths.includes(a)
    const aIsWeakness = analysis.insights.weaknesses.includes(a)
    const bIsStrength = analysis.insights.strengths.includes(b)
    const bIsWeakness = analysis.insights.weaknesses.includes(b)

    // Priority: strength (0) > neutral (1) > weakness (2)
    const aPriority = aIsStrength ? 0 : aIsWeakness ? 2 : 1
    const bPriority = bIsStrength ? 0 : bIsWeakness ? 2 : 1

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    // Within same category, sort by score (highest first)
    return (targetEmployer.scores[b] || 5) - (targetEmployer.scores[a] || 5)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sortedDimensions.map((dim) => {
        const targetScore = targetEmployer.scores[dim] || 5
        const isStrength = analysis.insights.strengths.includes(dim)
        const isWeakness = analysis.insights.weaknesses.includes(dim)
        const isExpanded = expandedDim === dim

        // Sort all employers by this dimension's score (highest first)
        const rankedEmployers = [...analysis.employers]
          .sort((a, b) => (b.scores[dim] || 0) - (a.scores[dim] || 0))

        // Find target's rank in this dimension
        const targetRank = rankedEmployers.findIndex((e) => e.isTarget) + 1

        // Top 3 performers (excluding target if they're in top 3)
        const topPerformers = rankedEmployers
          .filter((e) => !e.isTarget)
          .slice(0, 3)

        // Leaders to learn from (those scoring higher than target)
        const leadersToLearn = rankedEmployers
          .filter((e) => !e.isTarget && (e.scores[dim] || 0) > targetScore)
          .slice(0, 3)

        return (
          <div
            key={dim}
            style={{
              background: isStrength
                ? `${hbColors.teal}08`
                : isWeakness
                  ? `${hbColors.coral}08`
                  : hbColors.surfaceRaised,
              borderRadius: hbRadii.md,
              borderLeft: `3px solid ${isStrength ? hbColors.teal : isWeakness ? hbColors.coral : hbColors.gold}`,
              overflow: 'hidden',
            }}
          >
            {/* Header - clickable to expand */}
            <div
              onClick={() => setExpandedDim(isExpanded ? null : dim)}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: `2px solid transparent`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isStrength
                  ? `${hbColors.teal}12`
                  : isWeakness
                    ? `${hbColors.coral}12`
                    : `${hbColors.teal}08`
                e.currentTarget.style.borderColor = `${hbColors.teal}40`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{dimensionIcons[dim]}</span>
                  <span
                    style={{
                      fontFamily: hbFonts.display,
                      fontSize: '14px',
                      fontWeight: 500,
                      color: hbColors.slate,
                    }}
                  >
                    {dimensionLabels[dim]}
                  </span>
                  {isStrength && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: `${hbColors.teal}20`,
                        color: hbColors.tealDeep,
                      }}
                    >
                      Strength
                    </span>
                  )}
                  {isWeakness && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: `${hbColors.coral}20`,
                        color: hbColors.coral,
                      }}
                    >
                      Gap
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: targetRank === 1 ? `${hbColors.gold}20` : hbColors.surfaceDim,
                      color: targetRank === 1 ? hbColors.gold : hbColors.slateLight,
                    }}
                  >
                    #{targetRank} of {rankedEmployers.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      fontFamily: hbFonts.display,
                      fontSize: '18px',
                      fontWeight: 700,
                      color: isStrength ? hbColors.tealDeep : isWeakness ? hbColors.coral : hbColors.slate,
                    }}
                  >
                    {targetScore}/10
                  </div>
                  {/* Expand button - prominent and clickable */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: hbRadii.md,
                      background: isExpanded ? hbColors.teal : `${hbColors.teal}15`,
                      border: `1px solid ${isExpanded ? hbColors.teal : hbColors.teal}`,
                      color: isExpanded ? 'white' : hbColors.tealDeep,
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: hbFonts.display,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>{isExpanded ? 'Hide' : 'See leaders'}</span>
                    <span
                      style={{
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        fontSize: '10px',
                      }}
                    >
                      ▼
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: hbColors.surfaceDim }}>
                <div
                  style={{
                    width: `${(targetScore / 10) * 100}%`,
                    background: isStrength
                      ? `linear-gradient(90deg, ${hbColors.teal}, ${hbColors.tealDeep})`
                      : isWeakness
                        ? hbColors.coral
                        : hbColors.gold,
                    borderRadius: '3px',
                  }}
                />
              </div>
              {/* Quick competitor preview */}
              {!isExpanded && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {topPerformers.slice(0, 4).map((emp, i) => {
                    const originalIndex = analysis.employers.findIndex((e) => e.name === emp.name)
                    return (
                      <div
                        key={emp.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          color: hbColors.slateLight,
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: employerColors[originalIndex] || hbColors.slateLight,
                          }}
                        />
                        <span>{emp.name.split(' ')[0]}</span>
                        <span style={{ fontWeight: 600, color: hbColors.slateMid }}>{emp.scores[dim]}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Expanded: Learn from leaders */}
            {isExpanded && (
              <div
                style={{
                  padding: '16px',
                  borderTop: `1px solid ${hbColors.surfaceDim}`,
                  background: hbColors.surface,
                }}
              >
                {/* Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: hbColors.slateMid,
                    lineHeight: 1.5,
                    margin: '0 0 16px 0',
                    fontStyle: 'italic',
                  }}
                >
                  {dimensionDescriptions[dim]}
                </p>

                {targetRank === 1 ? (
                  <div
                    style={{
                      padding: '16px',
                      background: `${hbColors.teal}08`,
                      borderRadius: hbRadii.md,
                      border: `1px solid ${hbColors.teal}30`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>🏆</span>
                      <span style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.tealDeep }}>
                        You're the leader in {dimensionLabels[dim]}!
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: hbColors.slateMid, margin: 0, lineHeight: 1.5 }}>
                      {companyName} scores highest among all competitors on this dimension.
                      Focus on maintaining this advantage through consistent messaging.
                    </p>
                  </div>
                ) : leadersToLearn.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '14px' }}>📚</span>
                      <span style={{ fontFamily: hbFonts.display, fontSize: '13px', fontWeight: 600, color: hbColors.slate }}>
                        Learn from leaders in {dimensionLabels[dim]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {leadersToLearn.map((leader, i) => {
                        const originalIndex = analysis.employers.findIndex((e) => e.name === leader.name)
                        const color = employerColors[originalIndex] || hbColors.slateLight
                        const scoreDiff = (leader.scores[dim] || 0) - targetScore
                        return (
                          <div
                            key={leader.name}
                            style={{
                              padding: '12px 14px',
                              background: hbColors.surfaceRaised,
                              borderRadius: hbRadii.md,
                              borderLeft: `3px solid ${color}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: i === 0 ? hbColors.gold : `${color}20`,
                                    color: i === 0 ? 'white' : color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {i + 1}
                                </div>
                                <span style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.slate }}>
                                  {leader.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: `${hbColors.coral}15`,
                                    color: hbColors.coral,
                                    fontWeight: 600,
                                  }}
                                >
                                  +{scoreDiff} ahead
                                </span>
                                <span style={{ fontFamily: hbFonts.display, fontSize: '16px', fontWeight: 700, color }}>
                                  {leader.scores[dim]}/10
                                </span>
                              </div>
                            </div>
                            {/* Leader's highlights (what they're known for) */}
                            {leader.highlights.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '11px', color: hbColors.slateLight, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  What they're known for:
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {leader.highlights.slice(0, 2).map((highlight, j) => (
                                    <div
                                      key={j}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '6px',
                                        fontSize: '12px',
                                        color: hbColors.slateMid,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      <span style={{ color, flexShrink: 0 }}>•</span>
                                      {highlight}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Actionable insight */}
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: `${hbColors.gold}10`,
                        borderRadius: hbRadii.md,
                        border: `1px solid ${hbColors.gold}30`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>💡</span>
                        <p style={{ fontSize: '12px', color: hbColors.slateMid, margin: 0, lineHeight: 1.5 }}>
                          <strong style={{ color: hbColors.slate }}>Action:</strong>{' '}
                          Review how these companies communicate about {dimensionLabels[dim].toLowerCase()} on their careers pages,
                          Glassdoor profiles, and social media. Look for specific proof points and employee stories you could emulate.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '13px', color: hbColors.slateMid }}>
                      Top performers in this dimension:
                    </div>
                    {topPerformers.map((emp, i) => {
                      const originalIndex = analysis.employers.findIndex((e) => e.name === emp.name)
                      return (
                        <div
                          key={emp.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: hbColors.surfaceRaised,
                            borderRadius: hbRadii.sm,
                          }}
                        >
                          <div
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: employerColors[originalIndex] || hbColors.slateLight,
                            }}
                          />
                          <span style={{ fontSize: '13px', color: hbColors.slateMid, flex: 1 }}>{emp.name}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: hbColors.slate }}>{emp.scores[dim]}/10</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Insights Panel - Strengths, Weaknesses, Recommendations
 */
function InsightsPanel({ analysis, companyName }: { analysis: HBCompetitorAnalysis; companyName: string }) {
  const { insights } = analysis
  const targetEmployer = analysis.employers.find((e) => e.isTarget)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Strengths */}
      {insights.strengths.length > 0 && (
        <div
          style={{
            padding: '20px',
            background: `${hbColors.teal}08`,
            borderRadius: hbRadii.lg,
            borderLeft: `4px solid ${hbColors.teal}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>💪</span>
            <h4 style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.tealDeep, margin: 0 }}>
              Competitive Strengths
            </h4>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {insights.strengths.map((dim) => (
              <div
                key={dim}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: `${hbColors.teal}15`,
                  borderRadius: hbRadii.md,
                }}
              >
                <span>{dimensionIcons[dim]}</span>
                <span style={{ fontFamily: hbFonts.display, fontSize: '13px', fontWeight: 500, color: hbColors.tealDeep }}>
                  {dimensionLabels[dim]}
                </span>
                <span style={{ fontSize: '12px', color: hbColors.teal, fontWeight: 600 }}>
                  {targetEmployer?.scores[dim]}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {insights.weaknesses.length > 0 && (
        <div
          style={{
            padding: '20px',
            background: `${hbColors.coral}08`,
            borderRadius: hbRadii.lg,
            borderLeft: `4px solid ${hbColors.coral}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <h4 style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.coral, margin: 0 }}>
              Improvement Opportunities
            </h4>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {insights.weaknesses.map((dim) => (
              <div
                key={dim}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: `${hbColors.coral}15`,
                  borderRadius: hbRadii.md,
                }}
              >
                <span>{dimensionIcons[dim]}</span>
                <span style={{ fontFamily: hbFonts.display, fontSize: '13px', fontWeight: 500, color: hbColors.coral }}>
                  {dimensionLabels[dim]}
                </span>
                <span style={{ fontSize: '12px', color: hbColors.coral, fontWeight: 600 }}>
                  {targetEmployer?.scores[dim]}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div
          style={{
            padding: '20px',
            background: hbColors.surface,
            borderRadius: hbRadii.lg,
            boxShadow: hbShadows.sm,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <h4 style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.slate, margin: 0 }}>
              Recommendations
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {insights.recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  background: hbColors.surfaceRaised,
                  borderRadius: hbRadii.md,
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: hbColors.gold,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid, lineHeight: 1.5, margin: 0 }}>
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employer Highlights */}
      {targetEmployer && targetEmployer.highlights.length > 0 && (
        <div
          style={{
            padding: '20px',
            background: `linear-gradient(135deg, ${hbColors.tealLight}, ${hbColors.surface})`,
            borderRadius: hbRadii.lg,
            border: `1px solid ${hbColors.teal}30`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>⭐</span>
            <h4 style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.tealDeep, margin: 0 }}>
              {companyName}'s Key Differentiators
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {targetEmployer.highlights.map((highlight, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: hbColors.slateMid,
                }}
              >
                <span style={{ color: hbColors.teal }}>✓</span>
                {highlight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Analyze competitor sentiment from responses (original logic)
function analyzeCompetitorSentiment(responses: HBResponse[], competitors: Competitor[]) {
  const competitorData: Record<
    string,
    {
      name: string
      mentions: number
      favorable: number
      unfavorable: number
      contexts: Array<{ text: string; platform: HBPlatform; isPositive: boolean }>
    }
  > = {}

  competitors.forEach((c) => {
    competitorData[c.name] = {
      name: c.name,
      mentions: 0,
      favorable: 0,
      unfavorable: 0,
      contexts: [],
    }
  })

  responses.forEach((response) => {
    const isFavorable = response.sentimentCategory === 'strong' || response.sentimentCategory === 'positive'
    const isUnfavorable = response.sentimentCategory === 'mixed' || response.sentimentCategory === 'negative'

    response.competitorsMentioned.forEach((mention) => {
      const data = competitorData[mention.name]
      if (!data) return

      data.mentions++
      if (isFavorable) data.favorable++
      if (isUnfavorable) data.unfavorable++

      if (mention.context && data.contexts.length < 3) {
        data.contexts.push({
          text: mention.context,
          platform: response.platform,
          isPositive: isFavorable,
        })
      }
    })
  })

  return competitorData
}

export function HBCompetitorList({
  competitors,
  companyName,
  responses,
  yourDesirability,
  competitorAnalysis,
}: HBCompetitorListProps) {
  const [activeView, setActiveView] = useState<'dimensions' | 'differentiation'>(
    competitorAnalysis ? 'dimensions' : 'differentiation'
  )

  // Calculate your own sentiment metrics
  const yourMetrics = useMemo(() => {
    const favorable = responses.filter(
      (r) => r.sentimentCategory === 'strong' || r.sentimentCategory === 'positive'
    ).length
    const unfavorable = responses.filter(
      (r) => r.sentimentCategory === 'mixed' || r.sentimentCategory === 'negative'
    ).length
    const total = responses.length
    const favorablePct = total > 0 ? Math.round((favorable / total) * 100) : 0

    return { favorable, unfavorable, total, favorablePct }
  }, [responses])

  // Analyze competitor sentiment
  const competitorMentionAnalysis = useMemo(
    () => analyzeCompetitorSentiment(responses, competitors),
    [responses, competitors]
  )

  // Get competitors with favorability calculated
  const competitorsWithFavorability = useMemo(() => {
    return competitors
      .map((c) => {
        const analysis = competitorMentionAnalysis[c.name]
        const total = analysis.mentions
        const favorablePct = total > 0 ? Math.round((analysis.favorable / total) * 100) : 0
        return {
          ...c,
          ...analysis,
          favorablePct,
          isYourBrand: false,
        }
      })
      .filter((c) => c.mentions > 0)
  }, [competitors, competitorMentionAnalysis])

  // Empty state
  if (competitors.length === 0 && !competitorAnalysis) {
    return (
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: hbShadows.sm,
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>🎯</div>
        <div style={{ fontFamily: hbFonts.display, fontSize: '18px', color: hbColors.slate, marginBottom: '8px' }}>
          No Competitors Detected
        </div>
        <div style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid }}>
          AI assistants didn't mention competitor employers when discussing {companyName}.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with view toggle */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '24px',
          boxShadow: hbShadows.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2
              style={{
                fontFamily: hbFonts.display,
                fontSize: '20px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '8px',
              }}
            >
              Competitive Analysis
            </h2>
            <p style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid, margin: 0 }}>
              How {companyName} compares to competitors for talent
            </p>
          </div>

          {/* View toggle - only show if we have dimension analysis */}
          {competitorAnalysis && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                background: hbColors.surfaceDim,
                borderRadius: hbRadii.md,
              }}
            >
              <button
                onClick={() => setActiveView('dimensions')}
                style={{
                  padding: '8px 16px',
                  borderRadius: hbRadii.sm,
                  border: 'none',
                  background: activeView === 'dimensions' ? hbColors.surface : 'transparent',
                  color: activeView === 'dimensions' ? hbColors.tealDeep : hbColors.slateLight,
                  fontFamily: hbFonts.display,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: activeView === 'dimensions' ? hbShadows.sm : 'none',
                }}
              >
                📊 Dimensions
              </button>
              <button
                onClick={() => setActiveView('differentiation')}
                style={{
                  padding: '8px 16px',
                  borderRadius: hbRadii.sm,
                  border: 'none',
                  background: activeView === 'differentiation' ? hbColors.surface : 'transparent',
                  color: activeView === 'differentiation' ? hbColors.tealDeep : hbColors.slateLight,
                  fontFamily: hbFonts.display,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: activeView === 'differentiation' ? hbShadows.sm : 'none',
                }}
              >
                🎯 Differentiation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dimension Analysis View */}
      {competitorAnalysis && activeView === 'dimensions' && (
        <>
          {/* Spider Chart */}
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
                fontSize: '16px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '4px',
              }}
            >
              Employer Brand Comparison
            </h3>
            <p style={{ fontSize: '12px', color: hbColors.slateLight, marginBottom: '24px' }}>
              AI&apos;s perception of each employer across 7 key dimensions (0-10 scale)
            </p>
            <SpiderChart analysis={competitorAnalysis} targetName={companyName} />
          </div>

          {/* Dimension Details */}
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
                fontSize: '16px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '16px',
              }}
            >
              Dimension Breakdown
            </h3>
            <DimensionTable analysis={competitorAnalysis} companyName={companyName} />
          </div>

          {/* Insights */}
          <InsightsPanel analysis={competitorAnalysis} companyName={companyName} />
        </>
      )}

      {/* Differentiation View */}
      {activeView === 'differentiation' && competitorAnalysis && (
        <DifferentiationView
          analysis={competitorAnalysis}
          companyName={companyName}
        />
      )}

      {/* Show differentiation view as fallback if no dimension analysis but has competitors */}
      {!competitorAnalysis && competitors.length > 0 && (
        <div
          style={{
            background: hbColors.surface,
            borderRadius: hbRadii.lg,
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: hbShadows.sm,
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📊</div>
          <div style={{ fontFamily: hbFonts.display, fontSize: '18px', color: hbColors.slate, marginBottom: '8px' }}>
            Dimension Analysis Not Available
          </div>
          <div style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid }}>
            Run a new scan to generate competitive dimension analysis for {companyName}.
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Calculate differentiation scores for employers if not present in data
 * Uses the same algorithm as compare-employers.ts
 */
function calculateDifferentiationScores(
  employers: HBCompetitorAnalysis['employers'],
  dimensions: HBEmployerDimension[]
): Map<string, { differentiationScore: number; strengthCount: number; weaknessCount: number }> {
  const results = new Map<string, { differentiationScore: number; strengthCount: number; weaknessCount: number }>()

  if (employers.length <= 1) {
    for (const emp of employers) {
      results.set(emp.name, { differentiationScore: 50, strengthCount: 0, weaknessCount: 0 })
    }
    return results
  }

  // Calculate group averages per dimension
  const dimensionAverages: Record<string, number> = {}
  for (const dim of dimensions) {
    const sum = employers.reduce((acc, emp) => acc + (emp.scores[dim] || 5), 0)
    dimensionAverages[dim] = sum / employers.length
  }

  // Calculate for each employer
  for (const emp of employers) {
    let distanceSum = 0
    let varianceSum = 0
    let strengthCount = 0
    let weaknessCount = 0
    const scores = Object.values(emp.scores)
    const empMean = scores.reduce((a, b) => a + b, 0) / scores.length

    for (const dim of dimensions) {
      const score = emp.scores[dim] || 5
      const avg = dimensionAverages[dim]

      // Profile distance from group average
      distanceSum += Math.pow(score - avg, 2)

      // Score variance (internal profile shape)
      varianceSum += Math.pow(score - empMean, 2)

      // Count strengths/weaknesses
      if (score > avg + 0.5) strengthCount++
      if (score < avg - 0.5) weaknessCount++
    }

    // Normalize components to 0-100 scale
    const maxDistance = Math.sqrt(dimensions.length * 81) // 9^2 = 81
    const profileDistanceNorm = (Math.sqrt(distanceSum) / maxDistance) * 100

    const maxVariance = Math.sqrt(dimensions.length * 20.25) // ~4.5^2 from mean
    const varianceNorm = (Math.sqrt(varianceSum) / maxVariance) * 100

    const strengthNorm = (strengthCount / dimensions.length) * 100

    // Weighted combination: Profile Distance (40%), Variance (30%), Strengths (30%)
    const differentiationScore = Math.round(
      profileDistanceNorm * 0.4 + varianceNorm * 0.3 + strengthNorm * 0.3
    )

    results.set(emp.name, {
      differentiationScore: Math.min(100, Math.max(0, differentiationScore)),
      strengthCount,
      weaknessCount,
    })
  }

  return results
}

/**
 * Differentiation View - Shows how unique each employer's brand profile is
 * Uses differentiationScore, strengthCount, and weaknessCount from analysis
 * If these fields are missing (older reports), calculates them on-the-fly
 */
function DifferentiationView({
  analysis,
  companyName,
}: {
  analysis: HBCompetitorAnalysis
  companyName: string
}) {
  const [hoveredEmployer, setHoveredEmployer] = useState<string | null>(null)

  // Calculate differentiation scores if they're missing from the data
  const employersWithDiff = useMemo(() => {
    // Check if the first employer has a valid differentiationScore
    const needsCalculation = analysis.employers.some(
      (e) => e.differentiationScore === undefined || e.differentiationScore === null || isNaN(e.differentiationScore)
    )

    if (needsCalculation) {
      // Calculate on-the-fly
      const diffMap = calculateDifferentiationScores(analysis.employers, analysis.dimensions)
      return analysis.employers.map((emp) => {
        const diffData = diffMap.get(emp.name) || { differentiationScore: 50, strengthCount: 0, weaknessCount: 0 }
        return {
          ...emp,
          differentiationScore: diffData.differentiationScore,
          strengthCount: diffData.strengthCount,
          weaknessCount: diffData.weaknessCount,
        }
      })
    }

    return analysis.employers
  }, [analysis.employers, analysis.dimensions])

  // Sort employers by differentiation score (highest first)
  const sortedEmployers = useMemo(() => {
    return [...employersWithDiff].sort((a, b) => b.differentiationScore - a.differentiationScore)
  }, [employersWithDiff])

  const targetEmployer = employersWithDiff.find((e) => e.isTarget)
  const targetRank = sortedEmployers.findIndex((e) => e.isTarget) + 1
  const avgDifferentiation = sortedEmployers.length > 0
    ? Math.round(sortedEmployers.reduce((sum, e) => sum + e.differentiationScore, 0) / sortedEmployers.length)
    : 0

  // Get color based on differentiation score
  const getDiffColor = (score: number) => {
    if (score >= 70) return hbColors.tealDeep
    if (score >= 50) return hbColors.teal
    if (score >= 30) return hbColors.gold
    return hbColors.coral
  }

  // Get label based on differentiation score
  const getDiffLabel = (score: number) => {
    if (score >= 70) return 'Highly Unique'
    if (score >= 50) return 'Distinctive'
    if (score >= 30) return 'Moderate'
    return 'Generic'
  }

  return (
    <>
      {/* Differentiation Score Explanation */}
      <div
        style={{
          background: `linear-gradient(135deg, ${hbColors.tealLight}, ${hbColors.surface})`,
          borderRadius: hbRadii.lg,
          padding: '24px',
          boxShadow: hbShadows.sm,
          border: `1px solid ${hbColors.teal}30`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: hbColors.teal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            🎯
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontFamily: hbFonts.display,
                fontSize: '18px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '8px',
              }}
            >
              What is Differentiation?
            </h3>
            <p
              style={{
                fontFamily: hbFonts.body,
                fontSize: '14px',
                color: hbColors.slateMid,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Differentiation measures how <strong>unique</strong> each employer's brand profile appears to AI.
              A higher score means the employer stands out with distinctive strengths,
              while a lower score suggests a more generic or similar-to-others profile.
              This is calculated from profile distance from the group average, variance in dimension scores,
              and count of above-average strengths.
            </p>
          </div>
        </div>

        {/* Target employer highlight */}
        {targetEmployer && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: hbColors.surface,
              borderRadius: hbRadii.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontFamily: hbFonts.display, fontSize: '14px', color: hbColors.slateLight, marginBottom: '4px' }}>
                {companyName}'s Differentiation
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '32px',
                    fontWeight: 700,
                    color: getDiffColor(targetEmployer.differentiationScore),
                  }}
                >
                  {targetEmployer.differentiationScore}
                </span>
                <span style={{ fontSize: '16px', color: hbColors.slateLight }}>/100</span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: hbRadii.sm,
                    background: `${getDiffColor(targetEmployer.differentiationScore)}15`,
                    color: getDiffColor(targetEmployer.differentiationScore),
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: hbFonts.display,
                  }}
                >
                  {getDiffLabel(targetEmployer.differentiationScore)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: hbFonts.display, fontSize: '24px', fontWeight: 700, color: hbColors.teal }}>
                  #{targetRank}
                </div>
                <div style={{ fontSize: '11px', color: hbColors.slateLight }}>
                  of {sortedEmployers.length}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: hbFonts.display, fontSize: '24px', fontWeight: 700, color: hbColors.teal }}>
                  {targetEmployer.strengthCount}
                </div>
                <div style={{ fontSize: '11px', color: hbColors.slateLight }}>
                  strengths
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: hbFonts.display, fontSize: '24px', fontWeight: 700, color: hbColors.coral }}>
                  {targetEmployer.weaknessCount}
                </div>
                <div style={{ fontSize: '11px', color: hbColors.slateLight }}>
                  gaps
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employer Differentiation Ranking */}
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
            fontSize: '16px',
            fontWeight: 600,
            color: hbColors.slate,
            marginBottom: '4px',
          }}
        >
          Employer Uniqueness Ranking
        </h3>
        <p style={{ fontSize: '12px', color: hbColors.slateLight, marginBottom: '20px' }}>
          Ranked by how distinctive each employer brand appears to AI (avg: {avgDifferentiation})
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedEmployers.map((emp, index) => {
            const rank = index + 1
            const isTarget = emp.isTarget
            const isHovered = hoveredEmployer === emp.name
            const color = getDiffColor(emp.differentiationScore)
            const originalIndex = employersWithDiff.findIndex((e) => e.name === emp.name)

            return (
              <div
                key={emp.name}
                onMouseEnter={() => setHoveredEmployer(emp.name)}
                onMouseLeave={() => setHoveredEmployer(null)}
                style={{
                  padding: isTarget ? '18px 20px' : '14px 16px',
                  background: isTarget
                    ? `linear-gradient(135deg, ${hbColors.tealLight}, ${hbColors.surface})`
                    : isHovered
                      ? hbColors.surfaceRaised
                      : hbColors.surfaceRaised,
                  borderRadius: hbRadii.md,
                  border: isTarget
                    ? `2px solid ${hbColors.teal}`
                    : isHovered
                      ? `1px solid ${hbColors.teal}40`
                      : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Rank badge */}
                    <div
                      style={{
                        width: isTarget ? '36px' : '28px',
                        height: isTarget ? '36px' : '28px',
                        borderRadius: '50%',
                        background: rank === 1
                          ? hbColors.gold
                          : isTarget
                            ? hbColors.teal
                            : rank <= 3
                              ? `${color}20`
                              : hbColors.surfaceDim,
                        color: rank === 1 || isTarget ? 'white' : rank <= 3 ? color : hbColors.slateLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isTarget ? '14px' : '12px',
                        fontWeight: 700,
                        fontFamily: hbFonts.display,
                      }}
                    >
                      {isTarget ? emp.name.charAt(0) : rank}
                    </div>
                    {/* Employer info */}
                    <div>
                      <div
                        style={{
                          fontFamily: hbFonts.display,
                          fontSize: isTarget ? '16px' : '14px',
                          fontWeight: isTarget ? 600 : 500,
                          color: hbColors.slate,
                        }}
                      >
                        {emp.name}
                        {isTarget && (
                          <span style={{ fontSize: '11px', color: hbColors.tealDeep, marginLeft: '8px' }}>
                            (You)
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: hbColors.slateLight }}>
                          #{rank} overall
                        </span>
                        <span style={{ fontSize: '11px', color: hbColors.teal }}>
                          {emp.strengthCount} strengths
                        </span>
                        {emp.weaknessCount > 0 && (
                          <span style={{ fontSize: '11px', color: hbColors.coral }}>
                            {emp.weaknessCount} gaps
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: hbFonts.display,
                          fontSize: isTarget ? '24px' : '18px',
                          fontWeight: 700,
                          color: color,
                        }}
                      >
                        {emp.differentiationScore}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: color,
                          fontWeight: 500,
                        }}
                      >
                        {getDiffLabel(emp.differentiationScore)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    display: 'flex',
                    height: isTarget ? '10px' : '6px',
                    borderRadius: isTarget ? '5px' : '3px',
                    overflow: 'hidden',
                    background: hbColors.surfaceDim,
                  }}
                >
                  <div
                    style={{
                      width: `${emp.differentiationScore}%`,
                      background: isTarget
                        ? `linear-gradient(90deg, ${hbColors.teal}, ${hbColors.tealDeep})`
                        : color,
                      borderRadius: isTarget ? '5px' : '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                {/* Highlights and dimension scores for all employers */}
                {emp.highlights.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {emp.highlights.slice(0, 3).map((highlight, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '4px 10px',
                          background: isTarget ? `${hbColors.teal}12` : `${color}12`,
                          borderRadius: hbRadii.sm,
                          fontSize: '11px',
                          color: isTarget ? hbColors.tealDeep : color,
                        }}
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dimension scores mini-chart for all employers */}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${hbColors.surfaceDim}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(emp.scores)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, isTarget ? 7 : 4)
                      .map(([dim, score]) => {
                        const scoreNum = score as number
                        const avgScore = 6 // Approximate average for coloring
                        const isStrong = scoreNum >= avgScore + 1
                        const isWeak = scoreNum <= avgScore - 1
                        return (
                          <div
                            key={dim}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              background: isStrong ? `${hbColors.teal}10` : isWeak ? `${hbColors.coral}10` : hbColors.surfaceDim,
                              borderRadius: hbRadii.sm,
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>{dimensionIcons[dim as HBEmployerDimension] || ''}</span>
                            <span style={{ fontSize: '11px', color: hbColors.slateMid }}>
                              {dimensionLabels[dim as HBEmployerDimension] || dim}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: isStrong ? hbColors.tealDeep : isWeak ? hbColors.coral : hbColors.slate,
                              }}
                            >
                              {scoreNum}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Strategic Insight */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '20px 24px',
          boxShadow: hbShadows.sm,
          borderLeft: `4px solid ${hbColors.gold}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: `${hbColors.gold}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            💡
          </div>
          <div>
            <h4
              style={{
                fontFamily: hbFonts.display,
                fontSize: '15px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '6px',
              }}
            >
              What This Means
            </h4>
            <p
              style={{
                fontFamily: hbFonts.body,
                fontSize: '14px',
                color: hbColors.slateMid,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {(() => {
                if (!targetEmployer) return 'No target employer found.'

                const score = targetEmployer.differentiationScore
                const strengths = targetEmployer.strengthCount
                const gaps = targetEmployer.weaknessCount

                if (score >= 70) {
                  return `${companyName} has a highly differentiated employer brand (${score}/100). With ${strengths} distinct strengths, your profile stands out clearly to AI assistants. Focus on amplifying these unique qualities in your employer content.`
                } else if (score >= 50) {
                  return `${companyName}'s employer brand is moderately differentiated (${score}/100). You have ${strengths} areas of strength. To increase differentiation, develop stronger positioning in your weaker dimensions or double down on what makes you unique.`
                } else if (score >= 30) {
                  return `${companyName}'s employer brand appears somewhat generic (${score}/100). With only ${strengths} above-average dimensions and ${gaps} gaps, AI may not distinguish you clearly from competitors. Consider developing distinctive messaging around specific employer value propositions.`
                } else {
                  return `${companyName}'s employer brand lacks differentiation (${score}/100). Your profile is similar to many competitors, making it hard for AI to recommend you specifically. Prioritize building unique, memorable employer content that highlights what truly sets you apart.`
                }
              })()}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Mentions View - Original favorability comparison based on sentiment
 * (Kept for backwards compatibility but no longer displayed in main UI)
 */
function MentionsView({
  competitorsWithFavorability,
  companyName,
  yourMetrics,
}: {
  competitorsWithFavorability: Array<{
    name: string
    count: number
    mentions: number
    favorable: number
    unfavorable: number
    favorablePct: number
    contexts: Array<{ text: string; platform: HBPlatform; isPositive: boolean }>
    isYourBrand: boolean
  }>
  companyName: string
  yourMetrics: { favorable: number; unfavorable: number; total: number; favorablePct: number }
}) {
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)

  // Create combined list with your brand included, sorted by favorability
  const rankedList = useMemo(() => {
    const yourBrandEntry = {
      name: companyName,
      count: yourMetrics.total,
      mentions: yourMetrics.total,
      favorable: yourMetrics.favorable,
      unfavorable: yourMetrics.unfavorable,
      favorablePct: yourMetrics.favorablePct,
      contexts: [] as Array<{ text: string; platform: HBPlatform; isPositive: boolean }>,
      isYourBrand: true,
    }

    return [...competitorsWithFavorability, yourBrandEntry].sort((a, b) => b.favorablePct - a.favorablePct)
  }, [competitorsWithFavorability, companyName, yourMetrics])

  const yourPosition = rankedList.findIndex((c) => c.isYourBrand) + 1
  const bestEntry = rankedList[0]

  return (
    <>
      {/* Mention-based comparison */}
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
            fontSize: '16px',
            fontWeight: 600,
            color: hbColors.slate,
            marginBottom: '4px',
          }}
        >
          Favorability by Mentions
        </h3>
        <p style={{ fontSize: '12px', color: hbColors.slateLight, marginBottom: '24px' }}>
          Based on sentiment when competitors are mentioned in AI responses
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rankedList.map((entry, index) => {
            const isExpanded = expandedCompetitor === entry.name
            const isYourBrand = entry.isYourBrand
            const rank = index + 1

            let barColor: string
            if (isYourBrand) {
              barColor = hbColors.teal
            } else if (rank < yourPosition) {
              barColor = hbColors.coral
            } else {
              barColor = hbColors.gold
            }

            return (
              <div key={entry.name}>
                <div
                  onClick={() => !isYourBrand && setExpandedCompetitor(isExpanded ? null : entry.name)}
                  style={{
                    padding: isYourBrand ? '18px 20px' : '14px 16px',
                    background: isYourBrand
                      ? `linear-gradient(135deg, ${hbColors.tealLight}, ${hbColors.surface})`
                      : hbColors.surfaceRaised,
                    borderRadius: hbRadii.md,
                    cursor: isYourBrand ? 'default' : 'pointer',
                    border: isYourBrand
                      ? `2px solid ${hbColors.teal}`
                      : isExpanded
                        ? `1px solid ${hbColors.teal}`
                        : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: isYourBrand ? '32px' : '24px',
                          height: isYourBrand ? '32px' : '24px',
                          borderRadius: '50%',
                          background: isYourBrand ? hbColors.teal : rank <= 3 ? `${barColor}20` : hbColors.surfaceDim,
                          color: isYourBrand ? 'white' : rank <= 3 ? barColor : hbColors.slateLight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isYourBrand ? '14px' : '11px',
                          fontWeight: isYourBrand ? 700 : 600,
                          fontFamily: hbFonts.display,
                        }}
                      >
                        {isYourBrand ? entry.name.charAt(0) : rank}
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: hbFonts.display,
                            fontSize: isYourBrand ? '16px' : '14px',
                            fontWeight: isYourBrand ? 600 : 500,
                            color: hbColors.slate,
                          }}
                        >
                          {entry.name}
                        </div>
                        <div style={{ fontSize: '11px', color: isYourBrand ? hbColors.tealDeep : hbColors.slateLight }}>
                          {isYourBrand ? (
                            <>
                              #{rank} of {rankedList.length} • Your brand
                            </>
                          ) : (
                            <>{entry.mentions} mentions</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: hbFonts.display,
                            fontSize: isYourBrand ? '24px' : '18px',
                            fontWeight: 700,
                            color: isYourBrand
                              ? entry.favorablePct >= 50
                                ? hbColors.tealDeep
                                : hbColors.coral
                              : barColor === hbColors.coral
                                ? hbColors.coral
                                : hbColors.tealDeep,
                          }}
                        >
                          {entry.favorablePct}%
                        </div>
                        <div style={{ fontSize: '10px', color: hbColors.slateLight }}>
                          {isYourBrand ? 'favorable' : rank < yourPosition ? 'outperforming you' : 'below you'}
                        </div>
                      </div>
                      {!isYourBrand && (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: hbColors.slateLight,
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▼
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: isYourBrand ? '12px' : '8px',
                      borderRadius: isYourBrand ? '6px' : '4px',
                      overflow: 'hidden',
                      background: hbColors.surfaceDim,
                    }}
                  >
                    <div
                      style={{
                        width: `${entry.favorablePct}%`,
                        background: isYourBrand
                          ? `linear-gradient(90deg, ${hbColors.teal}, ${hbColors.tealDeep})`
                          : barColor,
                        borderRadius: isYourBrand ? '6px' : '4px',
                      }}
                    />
                  </div>
                  {isYourBrand && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '11px',
                        color: hbColors.slateLight,
                      }}
                    >
                      <span>{entry.favorable} favorable</span>
                      <span>{entry.unfavorable} unfavorable</span>
                    </div>
                  )}
                </div>

                {/* Expanded context */}
                {!isYourBrand && isExpanded && entry.contexts.length > 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '16px',
                      background: hbColors.surface,
                      borderRadius: hbRadii.md,
                      border: `1px solid ${hbColors.surfaceDim}`,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: hbColors.slate, marginBottom: '12px' }}>
                      Why AI mentions {entry.name}:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {entry.contexts.map((ctx, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '10px 12px',
                            background: hbColors.surfaceRaised,
                            borderRadius: hbRadii.sm,
                            borderLeft: `3px solid ${ctx.isPositive ? hbColors.teal : hbColors.coral}`,
                          }}
                        >
                          <div style={{ fontSize: '13px', color: hbColors.slateMid, fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{ctx.text}"
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <img src={hbPlatformConfig[ctx.platform].iconPath} alt="" style={{ width: 12, height: 12 }} />
                            <span style={{ fontSize: '10px', color: hbColors.slateLight }}>
                              {hbPlatformConfig[ctx.platform].name}
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: ctx.isPositive ? `${hbColors.teal}15` : `${hbColors.coral}15`,
                                color: ctx.isPositive ? hbColors.tealDeep : hbColors.coral,
                              }}
                            >
                              {ctx.isPositive ? 'Favorable' : 'Unfavorable'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Strategic Insight */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '20px 24px',
          boxShadow: hbShadows.sm,
          borderLeft: `4px solid ${hbColors.teal}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: hbColors.tealLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            💡
          </div>
          <div>
            <h4
              style={{
                fontFamily: hbFonts.display,
                fontSize: '15px',
                fontWeight: 600,
                color: hbColors.slate,
                marginBottom: '6px',
              }}
            >
              What This Means
            </h4>
            <p
              style={{
                fontFamily: hbFonts.body,
                fontSize: '14px',
                color: hbColors.slateMid,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {(() => {
                const betterThanYou = competitorsWithFavorability.filter(
                  (c) => c.favorablePct > yourMetrics.favorablePct
                )
                const totalCompetitors = competitorsWithFavorability.length

                if (yourPosition === 1) {
                  return `Great news! ${companyName} ranks #1 with ${yourMetrics.favorablePct}% favorability - leading all ${totalCompetitors} competitors mentioned by AI. Focus on maintaining your content quality.`
                } else if (yourPosition <= 3) {
                  return `${companyName} ranks #${yourPosition} of ${rankedList.length} with ${yourMetrics.favorablePct}% favorability. ${betterThanYou.length > 0 ? `${bestEntry.name} leads at ${bestEntry.favorablePct}% - review their employer content to understand what resonates with AI.` : ''}`
                } else {
                  return `${companyName} ranks #${yourPosition} of ${rankedList.length} with ${yourMetrics.favorablePct}% favorability. ${betterThanYou.length} competitors score higher. ${bestEntry.name} leads at ${bestEntry.favorablePct}% - study their employer branding to improve your AI perception.`
                }
              })()}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
