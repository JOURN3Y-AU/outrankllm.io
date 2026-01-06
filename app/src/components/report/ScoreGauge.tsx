'use client'

import { useEffect, useState } from 'react'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { gauge: 120, thickness: 8, fontSize: '2rem', labelSize: '0.55rem' },
  md: { gauge: 180, thickness: 12, fontSize: '3rem', labelSize: '0.65rem' },
  lg: { gauge: 240, thickness: 16, fontSize: '4rem', labelSize: '0.75rem' },
}

export function ScoreGauge({ score, size = 'md' }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const { gauge, thickness, fontSize, labelSize } = sizes[size]

  // Animate the score on mount
  useEffect(() => {
    const duration = 1500
    const steps = 60
    const increment = score / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        setAnimatedScore(score)
        clearInterval(timer)
      } else {
        setAnimatedScore(Math.round(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [score])

  // Determine color based on score
  const getColor = (s: number) => {
    if (s >= 70) return 'var(--green)'
    if (s >= 40) return 'var(--amber)'
    return 'var(--red)'
  }

  const color = getColor(score)

  return (
    <div
      className="score-gauge relative"
      style={
        {
          '--score': animatedScore,
          '--gauge-size': `${gauge}px`,
          '--gauge-thickness': `${thickness}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="score-gauge-ring"
        style={{
          background: `conic-gradient(${color} ${animatedScore * 3.6}deg, var(--border) ${animatedScore * 3.6}deg)`,
        }}
      />
      <div className="score-gauge-value">
        <span className="score-gauge-number" style={{ fontSize, color }}>
          {animatedScore}
        </span>
        <span className="score-gauge-label" style={{ fontSize: labelSize }}>
          AI Visibility
        </span>
      </div>
    </div>
  )
}
