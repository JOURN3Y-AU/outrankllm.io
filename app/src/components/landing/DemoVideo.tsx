'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Expand } from 'lucide-react'
import { createPortal } from 'react-dom'

export function DemoVideo() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false)
  const smallVideoRef = useRef<HTMLVideoElement>(null)
  const expandedVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Detect landscape orientation on mobile
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500
      const isLandscape = window.innerWidth > window.innerHeight
      setIsLandscapeMobile(isMobile && isLandscape)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Sync video time when expanding/collapsing
  useEffect(() => {
    if (isExpanded && smallVideoRef.current && expandedVideoRef.current) {
      expandedVideoRef.current.currentTime = smallVideoRef.current.currentTime
      expandedVideoRef.current.play()
    }
  }, [isExpanded])

  const handleClose = useCallback(() => {
    if (expandedVideoRef.current && smallVideoRef.current) {
      smallVideoRef.current.currentTime = expandedVideoRef.current.currentTime
    }
    setIsExpanded(false)
  }, [])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    if (isExpanded) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isExpanded, handleClose])

  return (
    <>
      {/* Inline video with expand button */}
      <div
        className="relative w-full cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <video
          ref={smallVideoRef}
          autoPlay
          muted
          loop
          playsInline
          className="w-full border border-[var(--border)]"
          style={{ borderRadius: '4px' }}
        >
          <source src="/images/website-vid.mp4" type="video/mp4" />
        </video>

        {/* Expand hint overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all"
          style={{ borderRadius: '4px' }}
        >
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-mono">
            <Expand className="w-4 h-4" />
            Click to expand
          </div>
        </div>
      </div>

      {/* Expanded modal */}
      {mounted && isExpanded && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={handleClose}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Close video"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Expanded video */}
          <video
            ref={expandedVideoRef}
            autoPlay
            muted
            loop
            playsInline
            className={isLandscapeMobile ? 'w-full h-full object-contain' : 'max-w-[90vw] max-h-[90vh]'}
            style={{ borderRadius: isLandscapeMobile ? '0' : '8px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <source src="/images/website-vid.mp4" type="video/mp4" />
          </video>
        </div>,
        document.body
      )}
    </>
  )
}
