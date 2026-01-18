'use client'

import { useEffect, useState, useCallback } from 'react'

// Common mobile device widths
const MOBILE_WIDTHS = [
  { width: 375, label: 'iPhone SE/12 mini' },
  { width: 390, label: 'iPhone 14' },
  { width: 414, label: 'iPhone Plus' },
  { width: 430, label: 'iPhone 14 Pro Max' },
]

/**
 * Visual fold indicator for development only
 * Shows a dashed line at the viewport height to help with above-the-fold design
 * Shows vertical lines for common mobile widths
 * Adjusts automatically when switching device views in DevTools
 *
 * Uses position: absolute so it stays at a fixed document position
 * (doesn't move when scrolling)
 */
export function FoldIndicator() {
  const [viewportHeight, setViewportHeight] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [deviceType, setDeviceType] = useState('')

  const updateViewport = useCallback(() => {
    const vh = window.innerHeight
    const vw = window.innerWidth
    setViewportHeight(vh)
    setViewportWidth(vw)

    // Determine device type based on viewport height
    if (vh <= 667) {
      setDeviceType('Mobile (small)')
    } else if (vh <= 844) {
      setDeviceType('Mobile (standard)')
    } else if (vh <= 1024) {
      setDeviceType('Tablet')
    } else {
      setDeviceType('Desktop')
    }
  }, [])

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return

    // Initial update
    updateViewport()

    // Listen for resize
    window.addEventListener('resize', updateViewport)

    // Also poll periodically for DevTools device switching
    // (DevTools doesn't always fire resize events)
    const interval = setInterval(updateViewport, 500)

    return () => {
      window.removeEventListener('resize', updateViewport)
      clearInterval(interval)
    }
  }, [updateViewport])

  // Don't render in production or before hydration
  if (process.env.NODE_ENV !== 'development' || viewportHeight === 0) {
    return null
  }

  return (
    <>
      {/* Horizontal fold line */}
      <div
        style={{
          position: 'absolute',
          top: `${viewportHeight}px`,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 9999,
          pointerEvents: 'none',
          // Dashed effect using gradient
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(239, 68, 68, 0.8) 0px, rgba(239, 68, 68, 0.8) 8px, transparent 8px, transparent 16px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-18px',
            right: '10px',
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            fontSize: '10px',
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          FOLD — {deviceType} ({viewportHeight}px)
        </div>
      </div>

      {/* Vertical mobile width lines - only show on wider viewports */}
      {viewportWidth > 500 && MOBILE_WIDTHS.map(({ width, label }) => (
        <div
          key={width}
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: `${width}px`,
            width: '2px',
            zIndex: 9999,
            pointerEvents: 'none',
            // Dashed effect using gradient (vertical)
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(59, 130, 246, 0.6) 0px, rgba(59, 130, 246, 0.6) 8px, transparent 8px, transparent 16px)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: '6px',
              background: 'rgba(59, 130, 246, 0.9)',
              color: 'white',
              fontSize: '9px',
              fontFamily: 'monospace',
              padding: '2px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              transform: 'rotate(90deg)',
              transformOrigin: 'left top',
            }}
          >
            {width}px — {label}
          </div>
        </div>
      ))}
    </>
  )
}
