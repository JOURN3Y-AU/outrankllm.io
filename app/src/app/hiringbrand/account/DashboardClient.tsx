'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HBNav } from '../report/components/HBNav'
import type { NavBrand } from '../report/components/HBNav'

// ============================================
// DESIGN TOKENS
// ============================================

const hb = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  tealGlow: 'rgba(74, 189, 172, 0.15)',
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',
  gold: '#F7B733',
  goldLight: '#FEF9EC',
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',
  surface: '#FFFFFF',
  surfaceRaised: '#FAFBFC',
  surfaceDim: '#F1F5F9',
  success: '#22C55E',
  error: '#EF4444',
}

const fonts = {
  display: "'Outfit', system-ui, sans-serif",
  body: "'Source Sans 3', system-ui, sans-serif",
}

// ============================================
// TYPES
// ============================================

interface Brand {
  id: string
  domain: string
  companyName: string | null
  isPrimary: boolean
  latestScore: number | null
  latestReportToken: string | null
  lastScanDate: string | null
  scanStatus: string | null
}

interface TeamMember {
  id: string
  email: string
  role: 'owner' | 'admin' | 'viewer'
  joinedAt: string | null
}

interface PendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

interface LimitInfo {
  current: number
  max: number | null
}

interface DashboardData {
  organization: {
    id: string
    name: string
    tier: string
    tierName: string
    domainLimit: number
    status: string
  }
  brands: Brand[]
  team: {
    members: TeamMember[]
    pendingInvites: PendingInvite[]
  } | null
  role: 'owner' | 'admin' | 'viewer'
  canAddDomain: boolean
  email: string
  limits?: {
    brands: LimitInfo
    users: LimitInfo
  }
}

// ============================================
// HELPERS
// ============================================

function getScoreColor(score: number): string {
  if (score >= 80) return hb.teal
  if (score >= 60) return hb.tealDeep
  if (score >= 40) return hb.gold
  return hb.coral
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

// ============================================
// SCORE RING COMPONENT
// ============================================

function ScoreRing({ score, size = 72 }: { score: number | null; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? (score / 100) * circumference : 0
  const color = score !== null ? getScoreColor(score) : hb.slateLight

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`${hb.slateLight}30`}
          strokeWidth="4"
        />
        {/* Progress circle */}
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: score !== null ? '20px' : '14px',
          color: score !== null ? color : hb.slateLight,
        }}
      >
        {score !== null ? score : '—'}
      </div>
    </div>
  )
}

// ============================================
// BRAND CARD
// ============================================

function BrandCard({ brand }: { brand: Brand }) {
  const displayName = brand.companyName || brand.domain.split('.')[0]
  const hasReport = !!brand.latestReportToken
  // If there's a scan but no report yet, it's still in progress
  const isScanning = brand.scanStatus === 'running' || brand.scanStatus === 'pending' || brand.scanStatus === 'researching' || (brand.lastScanDate && !hasReport && brand.scanStatus !== 'failed' && brand.scanStatus !== 'complete')

  const cardStyle: React.CSSProperties = {
    background: hb.surface,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    border: `1px solid ${hb.slateLight}20`,
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    textDecoration: 'none',
    color: 'inherit',
    cursor: hasReport ? 'pointer' : 'default',
  }

  const content = (
    <>
      {/* Score ring */}
      <ScoreRing score={brand.latestScore} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: hb.slate,
              fontFamily: fonts.display,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </h3>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: hb.slateLight,
            fontFamily: fonts.body,
            margin: '0 0 12px 0',
          }}
        >
          {brand.domain}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isScanning ? (
            <span
              style={{
                fontSize: '13px',
                color: hb.teal,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hb.teal} strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Scanning...
            </span>
          ) : brand.scanStatus === 'failed' ? (
            <span style={{ fontSize: '13px', color: '#e53e3e', fontWeight: 500 }}>
              Scan failed — rescan to retry
            </span>
          ) : brand.lastScanDate ? (
            <span style={{ fontSize: '13px', color: hb.slateLight }}>
              Last scan: {timeAgo(brand.lastScanDate)}
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: hb.slateLight, fontStyle: 'italic' }}>
              Awaiting first scan
            </span>
          )}

          {hasReport && (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: hb.tealDeep,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View Report
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hb.tealDeep} strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </>
  )

  if (hasReport) {
    return (
      <Link
        href={`/hiringbrand/report/${brand.latestReportToken}`}
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 189, 172, 0.12)'
          e.currentTarget.style.borderColor = `${hb.teal}30`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'
          e.currentTarget.style.borderColor = `${hb.slateLight}20`
        }}
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 189, 172, 0.12)'
        e.currentTarget.style.borderColor = `${hb.teal}30`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'
        e.currentTarget.style.borderColor = `${hb.slateLight}20`
      }}
    >
      {content}
    </div>
  )
}

// ============================================
// ADD DOMAIN MODAL
// ============================================

function AddDomainModal({
  onClose,
  onSuccess,
  currentCount,
  limit,
}: {
  onClose: () => void
  onSuccess: () => void
  currentCount: number
  limit: number
}) {
  const [domain, setDomain] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/hiringbrand/dashboard/add-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''),
          companyName: companyName || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add brand')
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: fonts.body,
    border: `1px solid ${hb.slateLight}40`,
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    color: hb.slate,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: hb.surface,
          borderRadius: '20px',
          padding: '32px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: hb.slate,
            fontFamily: fonts.display,
            marginBottom: '4px',
          }}
        >
          Add a Brand
        </h2>
        <p style={{ fontSize: '14px', color: hb.slateLight, marginBottom: '24px' }}>
          Using {currentCount} of {limit} brand{limit !== 1 ? 's' : ''}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: hb.slateMid,
                marginBottom: '6px',
                fontFamily: fonts.body,
              }}
            >
              Domain *
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="company.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: hb.slateMid,
                marginBottom: '6px',
                fontFamily: fonts.body,
              }}
            >
              Company Name <span style={{ fontWeight: 400, color: hb.slateLight }}>(optional)</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Will be detected automatically"
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: hb.coralLight,
                color: hb.error,
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: fonts.body,
                background: 'none',
                border: `1px solid ${hb.slateLight}40`,
                borderRadius: '10px',
                cursor: 'pointer',
                color: hb.slateMid,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: fonts.display,
                background: loading ? hb.slateLight : hb.coral,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Adding...' : 'Add Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// TEAM SECTION
// ============================================

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    owner: { bg: hb.tealLight, text: hb.tealDeep },
    admin: { bg: hb.goldLight, text: '#B8860B' },
    viewer: { bg: hb.surfaceDim, text: hb.slateLight },
  }
  const c = colors[role] || colors.viewer
  return (
    <span
      style={{
        marginLeft: '8px',
        fontSize: '11px',
        fontWeight: 600,
        color: c.text,
        background: c.bg,
        padding: '2px 8px',
        borderRadius: '100px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {role}
    </span>
  )
}

function RoleDropdown({
  currentRole,
  onChange,
}: {
  currentRole: string
  onChange: (role: 'admin' | 'viewer') => void
}) {
  return (
    <select
      value={currentRole}
      onChange={(e) => onChange(e.target.value as 'admin' | 'viewer')}
      style={{
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: fonts.body,
        color: hb.slateMid,
        background: hb.surfaceDim,
        border: `1px solid ${hb.slateLight}30`,
        borderRadius: '6px',
        padding: '4px 8px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      <option value="admin">Admin</option>
      <option value="viewer">Viewer</option>
    </select>
  )
}

function TeamSection({
  team,
  callerRole,
  onInvite,
  onCancelInvite,
  onRemoveMember,
  onChangeRole,
  currentUserEmail,
  maxUsers,
}: {
  team: { members: TeamMember[]; pendingInvites: PendingInvite[] }
  callerRole: 'owner' | 'admin' | 'viewer'
  onInvite: (email: string, role: 'admin' | 'viewer') => Promise<void>
  onCancelInvite: (inviteId: string) => Promise<void>
  onRemoveMember: (leadId: string) => Promise<void>
  onChangeRole: (leadId: string, role: 'admin' | 'viewer') => Promise<void>
  currentUserEmail: string
  maxUsers: number | null
}) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const isOwner = callerRole === 'owner'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)
    setInviteLoading(true)

    try {
      // Admin can only invite as viewer
      const roleToSend = isOwner ? inviteRole : 'viewer'
      await onInvite(inviteEmail, roleToSend)
      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => setInviteSuccess(false), 3000)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  // Determine if caller can remove a given member
  const canRemove = (member: TeamMember) => {
    if (member.email === currentUserEmail) return false
    if (member.role === 'owner') return false
    if (isOwner) return true
    // Admin can only remove viewers
    if (callerRole === 'admin' && member.role === 'viewer') return true
    return false
  }

  return (
    <div
      style={{
        background: hb.surface,
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        border: `1px solid ${hb.slateLight}20`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: hb.slate,
            fontFamily: fonts.display,
            margin: 0,
          }}
        >
          Team
        </h2>
        {maxUsers != null && (
          <span style={{ fontSize: '13px', color: hb.slateLight, fontFamily: fonts.body }}>
            {(() => {
              const used = team.members.length + team.pendingInvites.length
              const remaining = maxUsers - used
              if (remaining <= 0) return `${used} / ${maxUsers} seats used`
              return `${remaining} seat${remaining !== 1 ? 's' : ''} remaining`
            })()}
          </span>
        )}
      </div>

      {/* Members list */}
      <div style={{ marginBottom: '24px' }}>
        {team.members.map((member) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: `1px solid ${hb.slateLight}15`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: hb.slate, fontWeight: 500 }}>
                {member.email}
              </span>
              {/* Owner sees a dropdown to change non-owner roles; others see a badge */}
              {isOwner && member.role !== 'owner' ? (
                <span style={{ marginLeft: '8px' }}>
                  <RoleDropdown
                    currentRole={member.role}
                    onChange={(newRole) => onChangeRole(member.id, newRole)}
                  />
                </span>
              ) : (
                <RoleBadge role={member.role} />
              )}
            </div>
            {canRemove(member) && (
              <button
                onClick={() => onRemoveMember(member.id)}
                style={{
                  fontSize: '12px',
                  color: hb.slateLight,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {team.pendingInvites.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: hb.slateLight,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}
          >
            Pending Invites
          </h3>
          {team.pendingInvites.map((invite) => (
            <div
              key={invite.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: `1px solid ${hb.slateLight}15`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: hb.slateMid }}>{invite.email}</span>
                <RoleBadge role={invite.role} />
              </div>
              <button
                onClick={() => onCancelInvite(invite.id)}
                style={{
                  fontSize: '12px',
                  color: hb.slateLight,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Invite by email..."
          required
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '14px',
            fontFamily: fonts.body,
            border: `1px solid ${hb.slateLight}40`,
            borderRadius: '10px',
            outline: 'none',
            color: hb.slate,
          }}
        />
        {/* Owner sees role selector; Admin always invites as viewer */}
        {isOwner ? (
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'viewer')}
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: fonts.body,
              border: `1px solid ${hb.slateLight}40`,
              borderRadius: '10px',
              color: hb.slateMid,
              background: hb.surface,
              cursor: 'pointer',
            }}
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: hb.slateLight, whiteSpace: 'nowrap' }}>
            as viewer
          </span>
        )}
        <button
          type="submit"
          disabled={inviteLoading}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: fonts.display,
            background: inviteSuccess ? hb.success : hb.teal,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: inviteLoading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {inviteLoading ? 'Sending...' : inviteSuccess ? 'Sent!' : 'Send Invite'}
        </button>
      </form>

      {inviteError && (
        <p style={{ fontSize: '13px', color: hb.error, marginTop: '8px' }}>{inviteError}</p>
      )}
    </div>
  )
}

// ============================================
// MAIN DASHBOARD
// ============================================

export function DashboardClient() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/hiringbrand/dashboard')
      if (res.status === 401) {
        router.push('/hiringbrand/login')
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load dashboard')
        return
      }
      setData(json)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll every 15s while any brand is scanning
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const hasScanning = data?.brands.some((b) => {
      const hasReport = !!b.latestReportToken
      return b.scanStatus === 'running' || b.scanStatus === 'pending' || b.scanStatus === 'researching' || (b.lastScanDate && !hasReport && b.scanStatus !== 'failed' && b.scanStatus !== 'complete')
    })

    if (hasScanning) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          fetchData()
        }, 15000)
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [data, fetchData])

  const handleInvite = async (email: string, role: 'admin' | 'viewer') => {
    const res = await fetch('/api/hiringbrand/dashboard/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to send invite')
    fetchData()
  }

  const handleCancelInvite = async (inviteId: string) => {
    await fetch('/api/hiringbrand/dashboard/cancel-invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    fetchData()
  }

  const handleRemoveMember = async (leadId: string) => {
    if (!confirm('Remove this team member?')) return
    await fetch('/api/hiringbrand/dashboard/remove-member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    })
    fetchData()
  }

  const handleChangeRole = async (leadId: string, newRole: 'admin' | 'viewer') => {
    const res = await fetch('/api/hiringbrand/dashboard/change-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, role: newRole }),
    })
    if (res.ok) {
      fetchData()
    }
  }

  // Convert brands to NavBrand format for the shared nav
  const navBrands: NavBrand[] = useMemo(() => {
    if (!data) return []
    return data.brands.map((b) => ({
      domain: b.domain,
      companyName: b.companyName,
      latestReportToken: b.latestReportToken,
      latestScore: b.latestScore,
      isScanning: b.scanStatus === 'running' || b.scanStatus === 'pending' || b.scanStatus === 'researching' || (!!b.lastScanDate && !b.latestReportToken && b.scanStatus !== 'failed' && b.scanStatus !== 'complete'),
    }))
  }, [data])

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: hb.surfaceDim }}>
        <HBNav organizationName="..." />
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={hb.teal} strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px' }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
          </svg>
          <p style={{ color: hb.slateMid, fontSize: '15px' }}>Loading account...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: hb.surfaceDim }}>
        <HBNav organizationName="Account" />
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <p style={{ color: hb.error, fontSize: '15px', marginBottom: '16px' }}>
            {error || 'Failed to load account'}
          </p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchData() }}
            style={{
              padding: '10px 24px',
              background: hb.teal,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { organization, brands, team, role, canAddDomain, email, limits } = data

  return (
    <div style={{ minHeight: '100vh', background: hb.surfaceDim }}>
      {/* CSS for spinner animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Shared Nav */}
      <HBNav
        organizationName={organization.name}
        brands={navBrands}
      />

      {/* Main */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '28px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: hb.slate,
                fontFamily: fonts.display,
                marginBottom: '4px',
              }}
            >
              {organization.name}
            </h1>
            <p style={{ fontSize: '14px', color: hb.slateLight, margin: 0 }}>
              {organization.tierName}
            </p>
          </div>

          {canAddDomain && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: fonts.display,
                background: hb.coral,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Brand
            </button>
          )}
        </div>

        {/* Account Limits */}
        {limits && (role === 'owner' || role === 'admin') && (
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '28px',
              flexWrap: 'wrap',
            }}
          >
            {/* Brands usage */}
            <div
              style={{
                flex: '1 1 200px',
                background: hb.surface,
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                border: `1px solid ${hb.slateLight}20`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: hb.slateMid, fontFamily: fonts.body }}>
                  Brands
                </span>
                <span style={{ fontSize: '13px', color: hb.slateLight, fontFamily: fonts.body }}>
                  {limits.brands.current} / {limits.brands.max}
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: `${hb.teal}20`, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '3px',
                    background: hb.teal,
                    width: `${limits.brands.max ? Math.min((limits.brands.current / limits.brands.max) * 100, 100) : 0}%`,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Users usage — only show if max_users is set */}
            {limits.users.max != null && (
              <div
                style={{
                  flex: '1 1 200px',
                  background: hb.surface,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  border: `1px solid ${hb.slateLight}20`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: hb.slateMid, fontFamily: fonts.body }}>
                    Team Members
                  </span>
                  <span style={{ fontSize: '13px', color: hb.slateLight, fontFamily: fonts.body }}>
                    {limits.users.current} / {limits.users.max}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: `${hb.teal}20`, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: '3px',
                      background: hb.teal,
                      width: `${Math.min((limits.users.current / limits.users.max) * 100, 100)}%`,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brand cards */}
        {brands.length === 0 ? (
          <div
            style={{
              background: hb.surface,
              borderRadius: '16px',
              padding: '60px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              border: `1px solid ${hb.slateLight}20`,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={hb.teal} strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.6 }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" style={{ animation: 'spin 2s linear infinite' }} />
            </svg>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: hb.slate,
                fontFamily: fonts.display,
                marginBottom: '8px',
              }}
            >
              Your first scan is running
            </h3>
            <p style={{ fontSize: '14px', color: hb.slateMid, maxWidth: '400px', margin: '0 auto' }}>
              We&apos;re analysing how AI platforms describe your employer brand. Your report will be ready in about 15 minutes.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '16px',
              marginBottom: '48px',
            }}
          >
            {brands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        )}

        {/* Team section (owner + admin) */}
        {(role === 'owner' || role === 'admin') && team && (
          <div style={{ marginTop: '48px' }}>
            <TeamSection
              team={team}
              callerRole={role}
              onInvite={handleInvite}
              onCancelInvite={handleCancelInvite}
              onRemoveMember={handleRemoveMember}
              onChangeRole={handleChangeRole}
              currentUserEmail={email}
              maxUsers={limits?.users.max ?? null}
            />
          </div>
        )}
      </main>

      {/* Add Domain Modal */}
      {showAddModal && (
        <AddDomainModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchData()
          }}
          currentCount={brands.length}
          limit={organization.domainLimit}
        />
      )}

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: hb.slateLight,
        }}
      >
        &copy; {new Date().getFullYear()} HiringBrand.io
      </footer>
    </div>
  )
}
