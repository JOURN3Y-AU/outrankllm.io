'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Shared chrome for the HiringBrand auth pages (login, forgot password,
 * reset password). Keeps the teal nav / white card / footer identical across
 * all three so a password reset never looks like it left the product.
 */

export const hbColors = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',
  gold: '#F7B733',
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',
  surface: '#FFFFFF',
  surfaceDim: '#F1F5F9',
  error: '#EF4444',
  success: '#10B981',
}

export const hbInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '15px',
  fontFamily: "'Source Sans 3', system-ui, sans-serif",
  border: `1px solid ${hbColors.slateLight}40`,
  borderRadius: '10px',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
  color: hbColors.slate,
}

export const hbLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: hbColors.slateMid,
  marginBottom: '6px',
  fontFamily: "'Source Sans 3', system-ui, sans-serif",
}

export function hbButtonStyle(loading: boolean, disabled = false): React.CSSProperties {
  const inactive = loading || disabled
  return {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: "'Outfit', system-ui, sans-serif",
    background: inactive ? hbColors.slateLight : hbColors.coral,
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: inactive ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
  }
}

export function HBAuthShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: hbColors.surfaceDim }}>
      {/* Nav */}
      <nav
        style={{
          background: hbColors.teal,
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Link
          href="/hiringbrand"
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'white',
            textDecoration: 'none',
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}
        >
          hiring<span style={{ fontWeight: 800 }}>brand</span>
          <span style={{ color: hbColors.gold }}>.io</span>
        </Link>
      </nav>

      {/* Main content */}
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 64px)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'white',
            borderRadius: '24px',
            padding: '48px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: hbColors.slateLight,
        }}
      >
        &copy; {new Date().getFullYear()} HiringBrand.io
      </footer>
    </div>
  )
}
