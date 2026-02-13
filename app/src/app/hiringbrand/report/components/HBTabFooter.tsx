/**
 * HBTabFooter - Reusable tab-to-tab navigation connector
 * Creates narrative flow between report sections
 */

import { hbColors, hbFonts, hbRadii } from './shared/constants'
import type { HBTabId } from './shared/types'

interface HBTabFooterProps {
  nextTab: HBTabId
  nextLabel: string
  previewText: string
  onNavigate: (tab: HBTabId) => void
}

export function HBTabFooter({ nextTab, nextLabel, previewText, onNavigate }: HBTabFooterProps) {
  return (
    <button
      onClick={() => {
        onNavigate(nextTab)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '20px 24px',
        background: hbColors.tealLight,
        borderRadius: hbRadii.lg,
        border: `1px solid ${hbColors.teal}30`,
        cursor: 'pointer',
        marginTop: '8px',
        textAlign: 'left',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: hbColors.tealDeep,
            marginBottom: '4px',
          }}
        >
          Next: {nextLabel}
        </div>
        <div
          style={{
            fontFamily: hbFonts.body,
            fontSize: '13px',
            color: hbColors.slateMid,
          }}
        >
          {previewText}
        </div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hbColors.tealDeep} strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M5 12h14" />
        <path d="M12 5l7 7-7 7" />
      </svg>
    </button>
  )
}
