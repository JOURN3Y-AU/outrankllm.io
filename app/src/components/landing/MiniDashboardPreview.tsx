'use client'

import { useState, useEffect, useRef } from 'react'

interface MiniDashboardPreviewProps {
  onCtaClick: () => void
}

const platforms = [
  { name: 'ChatGPT', color: 'var(--green)' },
  { name: 'Claude', color: '#d4a574' },
  { name: 'Gemini', color: '#8b5cf6' },
  { name: 'Perplexity', color: '#3b82f6' },
]

export function MiniDashboardPreview({ onCtaClick }: MiniDashboardPreviewProps) {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for scroll-triggered animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.3 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full bg-[var(--surface)] border border-[var(--border)]"
      style={{
        padding: '24px',
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 600ms ease-out, opacity 500ms ease-out',
      }}
    >
      {/* Header */}
      <div className="text-center" style={{ marginBottom: '20px' }}>
        <p className="font-mono text-[0.65rem] text-[var(--text-dim)] uppercase tracking-widest" style={{ marginBottom: '8px' }}>
          Your AI Visibility Score
        </p>
        <div className="flex items-baseline justify-center gap-1">
          <span
            className="font-mono text-[var(--text-dim)]"
            style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            ??
          </span>
          <span className="font-mono text-[var(--text-ghost)]" style={{ fontSize: '1.25rem' }}>
            / 100
          </span>
        </div>
      </div>

      {/* Platform bars */}
      <div className="flex flex-col" style={{ gap: '12px', marginBottom: '20px' }}>
        {platforms.map((platform, index) => (
          <div
            key={platform.name}
            className="flex items-center gap-3"
            style={{
              transform: isVisible ? 'translateX(0)' : 'translateX(-10px)',
              opacity: isVisible ? 1 : 0,
              transition: `transform 400ms ease-out ${150 + index * 100}ms, opacity 300ms ease-out ${150 + index * 100}ms`,
            }}
          >
            <span
              className="font-mono text-[var(--text-mid)] text-xs"
              style={{ width: '80px', flexShrink: 0 }}
            >
              {platform.name}
            </span>
            <div
              className="flex-1 bg-[var(--bg)] border border-[var(--border)]"
              style={{ height: '8px', overflow: 'hidden' }}
            >
              <div
                style={{
                  width: '0%',
                  height: '100%',
                  backgroundColor: platform.color,
                  opacity: 0.4,
                }}
              />
            </div>
            <span
              className="font-mono text-[var(--text-dim)] text-xs"
              style={{ width: '32px', textAlign: 'right' }}
            >
              ??%
            </span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={onCtaClick}
        className="w-full bg-transparent border border-[var(--green)] text-[var(--green)] font-mono text-sm font-medium transition-all hover:bg-[var(--green)] hover:text-[var(--bg)]"
        style={{ padding: '12px 24px' }}
      >
        Scan to reveal your score
      </button>
    </div>
  )
}
