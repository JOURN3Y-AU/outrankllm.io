/**
 * HBDownloadBar - Per-tab copy/download controls
 * Renders at top-right of each tab with clipboard and image export
 */

'use client'

import { useState, useCallback } from 'react'
import { hbColors, hbFonts, hbRadii } from './shared/constants'
import type { HBTabId } from './shared/types'

const tabNames: Record<HBTabId, string> = {
  start: 'Start Here',
  overview: 'Summary',
  responses: 'AI Responses',
  clippings: 'Clippings',
  competitors: 'Competitors',
  trends: 'Trends',
  actions: 'Action Plan',
  setup: 'Setup',
}

interface HBDownloadBarProps {
  activeTab: HBTabId
  clipboardText: string
  tabContentRef: React.RefObject<HTMLDivElement | null>
  companyName: string
}

export function HBDownloadBar({ activeTab, clipboardText, tabContentRef, companyName }: HBDownloadBarProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clipboardText)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = clipboardText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }, [clipboardText])

  const handleSaveImage = useCallback(async () => {
    if (!tabContentRef.current) return
    setSaveState('saving')
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(tabContentRef.current, {
        background: '#F1F5F9',
        useCORS: true,
        logging: false,
      } as Parameters<typeof html2canvas>[1])
      const link = document.createElement('a')
      const tabSlug = tabNames[activeTab].toLowerCase().replace(/\s+/g, '-')
      link.download = `${companyName.replace(/\s+/g, '-')}-${tabSlug}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
    }
  }, [tabContentRef, activeTab, companyName])

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'none',
    border: `1px solid ${hbColors.teal}40`,
    borderRadius: hbRadii.md,
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: hbFonts.body,
    fontWeight: 500,
    color: hbColors.tealDeep,
    transition: 'all 0.15s ease',
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
      <button
        onClick={handleCopy}
        style={buttonStyle}
        title="Copy tab summary to clipboard"
      >
        {copyState === 'copied' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.teal} strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.tealDeep} strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Summary
          </>
        )}
      </button>
      <button
        onClick={handleSaveImage}
        style={buttonStyle}
        disabled={saveState === 'saving'}
        title="Save tab as image"
      >
        {saveState === 'saved' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.teal} strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </>
        ) : saveState === 'saving' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            Saving...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.tealDeep} strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Save as Image
          </>
        )}
      </button>
    </div>
  )
}
