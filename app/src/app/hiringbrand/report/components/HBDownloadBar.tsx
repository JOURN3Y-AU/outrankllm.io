/**
 * HBDownloadBar - Per-tab PDF download button
 * Generates a branded one-page PDF summary for the active tab
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
  reportToken: string
  companyName: string
}

export function HBDownloadBar({ activeTab, reportToken, companyName }: HBDownloadBarProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')

  const handleDownloadPdf = useCallback(async () => {
    if (state === 'generating') return
    setState('generating')
    try {
      const res = await fetch(`/api/hiringbrand/report/${reportToken}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: activeTab }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const tabSlug = tabNames[activeTab].toLowerCase().replace(/\s+/g, '-')
      link.href = url
      link.download = `${companyName.replace(/\s+/g, '-')}-${tabSlug}-hiringbrand.pdf`
      link.click()
      URL.revokeObjectURL(url)
      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [activeTab, reportToken, companyName, state])

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: state === 'done' ? `${hbColors.teal}15` : 'none',
    border: `1px solid ${state === 'error' ? hbColors.coral + '60' : hbColors.teal + '40'}`,
    borderRadius: hbRadii.md,
    cursor: state === 'generating' ? 'not-allowed' : 'pointer',
    fontSize: '12px',
    fontFamily: hbFonts.body,
    fontWeight: 500,
    color: state === 'error' ? hbColors.coral : hbColors.tealDeep,
    transition: 'all 0.15s ease',
    opacity: state === 'generating' ? 0.7 : 1,
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
      <button
        onClick={handleDownloadPdf}
        style={buttonStyle}
        disabled={state === 'generating'}
        title={`Download ${tabNames[activeTab]} as PDF`}
      >
        {state === 'generating' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generating PDF...
          </>
        ) : state === 'done' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.teal} strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Downloaded
          </>
        ) : state === 'error' ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.coral} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Failed
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.tealDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
            Download PDF
          </>
        )}
      </button>
    </div>
  )
}
