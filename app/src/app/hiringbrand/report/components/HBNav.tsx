'use client'

/**
 * HiringBrand Navigation Bar
 * Teal sticky nav with logo, report switcher, and account dropdown
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { hbColors, hbFonts, hbShadows, getScoreColor } from './shared/constants'

// Brand info for the report switcher
export interface NavBrand {
  domain: string
  companyName: string | null
  latestReportToken: string | null
  latestScore: number | null
  isScanning: boolean
}

interface HBNavProps {
  organizationName: string
  brands?: NavBrand[]
  currentReportToken?: string | null
}

export function HBNav({ organizationName, brands, currentReportToken }: HBNavProps) {
  const router = useRouter()
  const [reportOpen, setReportOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reportRef.current && !reportRef.current.contains(e.target as Node)) {
        setReportOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Current brand for report switcher label
  const currentBrand = brands?.find((b) => b.latestReportToken === currentReportToken)
  const sortedBrands = brands
    ? [...brands].sort((a, b) => {
        const nameA = (a.companyName || a.domain).toLowerCase()
        const nameB = (b.companyName || b.domain).toLowerCase()
        return nameA.localeCompare(nameB)
      })
    : []

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/hiringbrand/login')
  }

  return (
    <nav
      style={{
        background: hbColors.teal,
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: hbShadows.tealLg,
      }}
    >
      {/* Left: Logo + Report Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Logo */}
        <a
          href="/hiringbrand/account"
          style={{
            fontFamily: hbFonts.display,
            fontSize: '24px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.2px',
            display: 'flex',
            alignItems: 'baseline',
            textDecoration: 'none',
          }}
        >
          <span>HiringBrand</span>
          <span style={{ color: hbColors.gold, fontWeight: 700 }}>.io</span>
        </a>

        {/* Divider */}
        {sortedBrands.length > 0 && (
          <div
            style={{
              width: '1px',
              height: '28px',
              background: 'rgba(255,255,255,0.25)',
            }}
          />
        )}

        {/* Report Switcher */}
        {sortedBrands.length > 0 && (
          <div ref={reportRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setReportOpen(!reportOpen); setAccountOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: reportOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: hbFonts.body,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!reportOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={(e) => { if (!reportOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            >
              {currentBrand
                ? (currentBrand.companyName || currentBrand.domain.split('.')[0])
                : 'Reports'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: reportOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown */}
            {reportOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  minWidth: '280px',
                  background: hbColors.surface,
                  borderRadius: '14px',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                  border: `1px solid ${hbColors.slateLight}20`,
                  overflow: 'hidden',
                  zIndex: 200,
                }}
              >
                <div style={{ padding: '8px 12px 4px', fontSize: '11px', fontWeight: 600, color: hbColors.slateLight, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: hbFonts.body }}>
                  Reports
                </div>
                {sortedBrands.map((brand) => {
                  const displayName = brand.companyName || brand.domain.split('.')[0]
                  const isCurrent = brand.latestReportToken === currentReportToken
                  const hasReport = !!brand.latestReportToken && !brand.isScanning

                  return (
                    <button
                      key={brand.domain}
                      onClick={() => {
                        if (hasReport && brand.latestReportToken) {
                          router.push(`/hiringbrand/report/${brand.latestReportToken}`)
                          setReportOpen(false)
                        }
                      }}
                      disabled={!hasReport}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 14px',
                        background: isCurrent ? hbColors.tealLight : 'transparent',
                        border: 'none',
                        cursor: hasReport ? 'pointer' : 'default',
                        textAlign: 'left',
                        fontFamily: hbFonts.body,
                        transition: 'background 0.1s',
                        opacity: hasReport || brand.isScanning ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => { if (hasReport && !isCurrent) e.currentTarget.style.background = hbColors.surfaceDim }}
                      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {/* Check mark for current */}
                        <div style={{ width: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isCurrent && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 7L6 10L11 4" stroke={hbColors.tealDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: isCurrent ? 600 : 400, color: hbColors.slate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                          </div>
                          <div style={{ fontSize: '12px', color: hbColors.slateLight }}>
                            {brand.domain}
                          </div>
                        </div>
                      </div>

                      {/* Score or status */}
                      <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                        {brand.isScanning ? (
                          <span style={{ fontSize: '12px', color: hbColors.teal, fontWeight: 500 }}>
                            Scanning...
                          </span>
                        ) : brand.latestScore !== null ? (
                          <span style={{ fontSize: '15px', fontWeight: 700, color: getScoreColor(brand.latestScore), fontFamily: hbFonts.display }}>
                            {brand.latestScore}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: hbColors.slateLight }}>—</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Account dropdown */}
      <div ref={accountRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setAccountOpen(!accountOpen); setReportOpen(false) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px 6px 6px',
            background: accountOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '100px',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (!accountOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
          onMouseLeave={(e) => { if (!accountOpen) e.currentTarget.style.background = accountOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)' }}
        >
          {/* First letter avatar */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'white',
              color: hbColors.tealDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '12px',
              fontFamily: hbFonts.display,
            }}
          >
            {organizationName.charAt(0).toUpperCase()}
          </div>
          <span
            style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: hbFonts.body,
            }}
          >
            {organizationName}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: accountOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Account dropdown */}
        {accountOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '200px',
              background: hbColors.surface,
              borderRadius: '14px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
              border: `1px solid ${hbColors.slateLight}20`,
              overflow: 'hidden',
              zIndex: 200,
            }}
          >
            <a
              href="/hiringbrand/account"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                color: hbColors.slate,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: hbFonts.body,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hbColors.surfaceDim }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateMid} strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Manage Account
            </a>
            <div style={{ height: '1px', background: `${hbColors.slateLight}20`, margin: '0 12px' }} />
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: hbColors.slateMid,
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: hbFonts.body,
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hbColors.surfaceDim }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateMid} strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
