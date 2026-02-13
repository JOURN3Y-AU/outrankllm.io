'use client'

/**
 * HiringBrand Score Ring
 * Animated circular gauge for employer reputation score
 */

import { useEffect, useState } from 'react'
import { hbColors, hbFonts, getScoreColor, getScoreLabel } from './shared/constants'

interface HBScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showLabel?: boolean
  animated?: boolean
  color?: string // Optional color override (defaults to score-based color)
}

const sizeConfig = {
  sm: { ring: 120, stroke: 8, fontSize: 32, labelSize: 11 },
  md: { ring: 180, stroke: 12, fontSize: 48, labelSize: 13 },
  lg: { ring: 240, stroke: 16, fontSize: 64, labelSize: 15 },
}

export function HBScoreRing({
  score,
  size = 'md',
  label = 'Employer Reputation',
  showLabel = true,
  animated = true,
  color,
}: HBScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [strokeProgress, setStrokeProgress] = useState(animated ? 0 : score)

  const config = sizeConfig[size]
  const radius = (config.ring - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (strokeProgress / 100) * circumference

  // Use provided color or fall back to score-based color
  const scoreColor = color || getScoreColor(score)
  const scoreLabel = getScoreLabel(score)

  // Animate on mount
  useEffect(() => {
    if (!animated) return

    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      setDisplayScore(Math.round(score * eased))
      setStrokeProgress(score * eased)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [score, animated])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* SVG Ring */}
      <div style={{ position: 'relative', width: config.ring, height: config.ring }}>
        <svg
          width={config.ring}
          height={config.ring}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke={hbColors.surfaceDim}
            strokeWidth={config.stroke}
          />
          {/* Progress ring */}
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: animated ? 'none' : 'stroke-dashoffset 0.5s ease',
              filter: `drop-shadow(0 0 8px ${scoreColor}40)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: hbFonts.display,
              fontSize: config.fontSize,
              fontWeight: 700,
              color: hbColors.slate,
              lineHeight: 1,
            }}
          >
            {displayScore}
          </div>
          <div
            style={{
              fontFamily: hbFonts.body,
              fontSize: config.labelSize,
              fontWeight: 500,
              color: scoreColor,
              marginTop: '4px',
            }}
          >
            {scoreLabel}
          </div>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div
          style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            fontWeight: 500,
            color: hbColors.slateMid,
            textAlign: 'center',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
