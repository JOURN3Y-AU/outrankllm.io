'use client'

import { useState, useEffect } from 'react'

interface StickyBottomCTAProps {
  onCtaClick: () => void
  triggerElementId: string // Element ID to watch - CTA appears after scrolling past this
}

export function StickyBottomCTA({ onCtaClick, triggerElementId }: StickyBottomCTAProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const triggerElement = document.getElementById(triggerElementId)
      if (!triggerElement) return

      const rect = triggerElement.getBoundingClientRect()
      // Show sticky CTA when trigger element is scrolled out of view (above viewport)
      const shouldShow = rect.bottom < 0
      setIsVisible(shouldShow)
    }

    // Initial check
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [triggerElementId])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[var(--bg)] border-t border-[var(--border)]"
      style={{
        zIndex: 9998,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease-out',
      }}
    >
      <button
        onClick={onCtaClick}
        className="w-full form-button flex items-center justify-center"
      >
        Scan My Website
      </button>
    </div>
  )
}
