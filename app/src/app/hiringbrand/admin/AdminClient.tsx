'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ============================================
// DESIGN TOKENS
// ============================================

const hb = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',
  gold: '#F7B733',
  goldLight: '#FEF9EC',
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',
  surface: '#FFFFFF',
  surfaceDim: '#F1F5F9',
  success: '#22C55E',
  error: '#EF4444',
}

const fonts = {
  display: "'Outfit', system-ui, sans-serif",
  body: "'Source Sans 3', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// ============================================
// TYPES
// ============================================

interface OrgBrand {
  id: string
  domain: string
  companyName: string | null
  firstSetupDate: string | null
  lastScanDate: string | null
  scanCount: number
  scanStatus: string | null
  latestReportToken: string | null
  latestScore: number | null
  frozenQuestionCount: number
  frozenCompetitorCount: number
}

interface AdminOrg {
  id: string
  name: string
  tier: string
  status: string
  domainLimit: number
  maxUsers: number | null
  maxQuestions: number | null
  maxCompetitors: number | null
  ownerEmail: string | null
  memberCount: number
  pendingInviteCount: number
  domains: OrgBrand[]
  createdAt: string
}

interface FrozenQuestion {
  id: string
  prompt_text: string
  category: string
  sort_order: number
}

interface FrozenCompetitor {
  id: string
  name: string
  domain: string | null
  reason: string | null
  sort_order: number
}

interface BrandDetailData {
  questions: FrozenQuestion[]
  competitors: FrozenCompetitor[]
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

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ============================================
// TIER + STATUS BADGES
// ============================================

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    brand: { bg: hb.tealLight, text: hb.tealDeep },
    agency_10: { bg: hb.goldLight, text: '#B8860B' },
    agency_20: { bg: hb.goldLight, text: '#B8860B' },
    enterprise: { bg: `${hb.coral}15`, text: hb.coral },
  }
  const c = colors[tier] || colors.brand
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        color: c.text,
        background: c.bg,
        padding: '3px 10px',
        borderRadius: '100px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {tier}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active'
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        color: isActive ? hb.success : hb.slateLight,
        background: isActive ? `${hb.success}15` : hb.surfaceDim,
        padding: '3px 10px',
        borderRadius: '100px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {status}
    </span>
  )
}

function ScanStatusBadge({ status }: { status: string }) {
  const isActive = ['crawling', 'analyzing', 'researching', 'generating', 'querying', 'pending'].includes(status)
  const color = isActive ? hb.gold : status === 'complete' ? hb.success : hb.error
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        color,
        background: `${color}15`,
        padding: '2px 8px',
        borderRadius: '100px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}
    >
      {isActive ? 'scanning...' : status}
    </span>
  )
}

// ============================================
// LIMIT DISPLAY
// ============================================

function LimitCell({ current, max }: { current?: number; max: number | null }) {
  if (current !== undefined) {
    return (
      <span style={{ fontSize: '14px', color: hb.slate, fontFamily: fonts.body }}>
        <strong>{current}</strong>
        <span style={{ color: hb.slateLight }}> / {max ?? '∞'}</span>
      </span>
    )
  }
  return (
    <span style={{ fontSize: '14px', color: hb.slate, fontFamily: fonts.body }}>
      {max ?? '∞'}
    </span>
  )
}

// ============================================
// SCORE RING (small inline)
// ============================================

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: hb.slateLight, fontSize: '12px' }}>—</span>
  const color = getScoreColor(score)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: `3px solid ${color}`,
        fontSize: '12px',
        fontWeight: 700,
        color,
        fontFamily: fonts.mono,
        flexShrink: 0,
      }}
    >
      {score}
    </span>
  )
}

// ============================================
// CATEGORY BADGE
// ============================================

const categoryColors: Record<string, string> = {
  reputation: hb.teal,
  culture: '#8B5CF6',
  compensation: hb.gold,
  growth: hb.success,
  leadership: '#3B82F6',
  technology: '#06B6D4',
  balance: '#EC4899',
  mission: '#F97316',
  general: hb.slateMid,
}

function CategoryBadge({ category }: { category: string }) {
  const color = categoryColors[category] || hb.slateLight
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        color,
        background: `${color}15`,
        padding: '2px 8px',
        borderRadius: '100px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}
    >
      {category}
    </span>
  )
}

// ============================================
// BRAND DETAIL (Level 3 — lazy loaded)
// ============================================

function BrandDetail({ brandId }: { brandId: string }) {
  const [data, setData] = useState<BrandDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/hiringbrand/admin/brands/${brandId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [brandId])

  if (loading) {
    return (
      <div style={{ padding: '16px 0', color: hb.slateLight, fontSize: '13px' }}>
        Loading questions & competitors...
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '16px 0', color: hb.slateLight, fontSize: '13px' }}>
        Failed to load detail.
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '24px',
        marginTop: '12px',
        flexWrap: 'wrap',
      }}
    >
      {/* Questions */}
      <div style={{ flex: '1 1 350px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: hb.slateLight,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Questions ({data.questions.length})
        </div>
        {data.questions.length === 0 ? (
          <div style={{ color: hb.slateLight, fontSize: '13px', fontStyle: 'italic' }}>
            No frozen questions yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.questions.map((q) => (
              <div
                key={q.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 10px',
                  background: hb.surface,
                  borderRadius: '6px',
                  border: `1px solid ${hb.slateLight}15`,
                }}
              >
                <CategoryBadge category={q.category} />
                <span style={{ fontSize: '13px', color: hb.slate, lineHeight: '1.4' }}>
                  {q.prompt_text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Competitors */}
      <div style={{ flex: '0 0 280px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: hb.slateLight,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Competitors ({data.competitors.length})
        </div>
        {data.competitors.length === 0 ? (
          <div style={{ color: hb.slateLight, fontSize: '13px', fontStyle: 'italic' }}>
            No frozen competitors yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.competitors.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: hb.surface,
                  borderRadius: '6px',
                  border: `1px solid ${hb.slateLight}15`,
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: hb.slate }}>
                  {c.name}
                </span>
                {c.domain && (
                  <span style={{ fontSize: '12px', color: hb.slateLight }}>
                    {c.domain}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// BRAND CARD (Level 2)
// ============================================

function BrandCard({
  brand,
  orgId,
  isExpanded,
  onToggleExpand,
  refreshingBrandId,
  onForceRefresh,
}: {
  brand: OrgBrand
  orgId: string
  isExpanded: boolean
  onToggleExpand: () => void
  refreshingBrandId: string | null
  onForceRefresh: (brand: OrgBrand, orgId: string) => void
}) {
  const isRefreshing = refreshingBrandId === brand.id
  const isScanning = brand.scanStatus && !['complete', 'failed'].includes(brand.scanStatus)

  return (
    <div>
      <div
        onClick={onToggleExpand}
        style={{
          background: isExpanded ? hb.surface : hb.surfaceDim,
          borderRadius: '10px',
          padding: '14px 18px',
          border: `1px solid ${isExpanded ? hb.teal + '40' : hb.slateLight + '20'}`,
          transition: 'border-color 0.15s, background 0.15s',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Chevron arrow — same style as org rows */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={hb.slateLight}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          {/* Score */}
          <ScoreBadge score={brand.latestScore} />

          {/* Brand info */}
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '14px', fontFamily: fonts.display, color: hb.slate }}>
                {brand.companyName || brand.domain}
              </strong>
              {brand.companyName && (
                <span style={{ fontSize: '12px', color: hb.slateLight }}>{brand.domain}</span>
              )}
              {isScanning && <ScanStatusBadge status={brand.scanStatus!} />}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '4px',
                fontSize: '12px',
                color: hb.slateLight,
                flexWrap: 'wrap',
              }}
            >
              <span>Last: <strong style={{ color: hb.slateMid }}>{brand.lastScanDate
                ? new Date(brand.lastScanDate).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
                : '—'
              }</strong></span>
              <span style={{ color: (() => {
                if (!brand.lastScanDate) return hb.slateLight
                const next = new Date(new Date(brand.lastScanDate).getTime() + 7 * 86400000)
                return next <= new Date() ? hb.coral : hb.slateLight
              })() }}>
                Next: <strong style={{ color: 'inherit' }}>{brand.lastScanDate
                  ? new Date(new Date(brand.lastScanDate).getTime() + 7 * 86400000).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
                  : '—'
                }</strong>
                {brand.lastScanDate && new Date(new Date(brand.lastScanDate).getTime() + 7 * 86400000) <= new Date() && (
                  <span style={{ marginLeft: '4px', fontWeight: 600 }}>(overdue)</span>
                )}
              </span>
              <span>{brand.scanCount} refresh{brand.scanCount !== 1 ? 'es' : ''}</span>
              <span>Added: {formatDate(brand.firstSetupDate)}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: hb.slateLight }}>
              <span>Q: {brand.frozenQuestionCount}</span>
              <span>C: {brand.frozenCompetitorCount}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {brand.latestReportToken && (
              <a
                href={`/hiringbrand/report/${brand.latestReportToken}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: fonts.display,
                  background: hb.teal,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Report
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onForceRefresh(brand, orgId)
              }}
              disabled={isRefreshing || !!isScanning}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: fonts.display,
                background: (isRefreshing || isScanning) ? hb.slateLight : hb.coral,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (isRefreshing || isScanning) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isRefreshing ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Queuing...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Level 3: Questions & Competitors */}
      {isExpanded && (
        <div style={{ padding: '0 18px 8px' }}>
          <BrandDetail brandId={brand.id} />
        </div>
      )}
    </div>
  )
}

// ============================================
// INLINE EDIT ROW
// ============================================

function EditRow({
  org,
  onSave,
  onCancel,
}: {
  org: AdminOrg
  onSave: (updates: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [maxUsers, setMaxUsers] = useState(org.maxUsers?.toString() ?? '')
  const [maxQuestions, setMaxQuestions] = useState(org.maxQuestions?.toString() ?? '')
  const [maxCompetitors, setMaxCompetitors] = useState(org.maxCompetitors?.toString() ?? '')
  const [domainLimit, setDomainLimit] = useState(org.domainLimit.toString())
  const [tier, setTier] = useState(org.tier)
  const [status, setStatus] = useState(org.status)
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '60px',
    padding: '6px 8px',
    fontSize: '13px',
    fontFamily: fonts.body,
    border: `1px solid ${hb.slateLight}40`,
    borderRadius: '6px',
    textAlign: 'center',
    color: hb.slate,
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: '13px',
    fontFamily: fonts.body,
    border: `1px solid ${hb.slateLight}40`,
    borderRadius: '6px',
    color: hb.slate,
    background: hb.surface,
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        max_users: maxUsers === '' ? null : parseInt(maxUsers, 10),
        max_questions: maxQuestions === '' ? null : parseInt(maxQuestions, 10),
        max_competitors: maxCompetitors === '' ? null : parseInt(maxCompetitors, 10),
        domain_limit: parseInt(domainLimit, 10) || 1,
        tier,
        status,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr style={{ background: hb.tealLight }}>
      <td style={{ padding: '12px 16px' }} colSpan={2}>
        <strong style={{ fontSize: '14px', color: hb.slate }}>{org.name}</strong>
        <div style={{ fontSize: '12px', color: hb.slateLight, marginTop: '2px' }}>
          {org.ownerEmail}
        </div>
      </td>
      <td style={{ padding: '12px 8px' }}>
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={selectStyle}>
          <option value="brand">brand</option>
          <option value="agency_10">agency_10</option>
          <option value="agency_20">agency_20</option>
          <option value="enterprise">enterprise</option>
        </select>
      </td>
      <td style={{ padding: '12px 8px' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="active">active</option>
          <option value="incomplete">incomplete</option>
          <option value="past_due">past_due</option>
          <option value="canceled">canceled</option>
        </select>
      </td>
      <td style={{ padding: '12px 8px' }}>
        <input
          type="number"
          value={domainLimit}
          onChange={(e) => setDomainLimit(e.target.value)}
          style={inputStyle}
          min={1}
        />
      </td>
      <td style={{ padding: '12px 8px' }}>
        <input
          type="number"
          value={maxUsers}
          onChange={(e) => setMaxUsers(e.target.value)}
          placeholder="∞"
          style={inputStyle}
          min={1}
        />
      </td>
      <td style={{ padding: '12px 8px' }}>
        <input
          type="number"
          value={maxQuestions}
          onChange={(e) => setMaxQuestions(e.target.value)}
          placeholder="∞"
          style={inputStyle}
          min={1}
        />
      </td>
      <td style={{ padding: '12px 8px' }}>
        <input
          type="number"
          value={maxCompetitors}
          onChange={(e) => setMaxCompetitors(e.target.value)}
          placeholder="∞"
          style={inputStyle}
          min={1}
        />
      </td>
      <td style={{ padding: '12px 8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: fonts.display,
              background: saving ? hb.slateLight : hb.teal,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: fonts.body,
              background: 'none',
              border: `1px solid ${hb.slateLight}40`,
              borderRadius: '6px',
              cursor: 'pointer',
              color: hb.slateMid,
            }}
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

// ============================================
// CREATE ORG FORM
// ============================================

function CreateOrgForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [tier, setTier] = useState('brand')
  const [domainLimit, setDomainLimit] = useState('1')
  const [maxUsers, setMaxUsers] = useState('')
  const [maxQuestions, setMaxQuestions] = useState('20')
  const [maxCompetitors, setMaxCompetitors] = useState('10')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/hiringbrand/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ownerEmail,
          tier,
          domainLimit: parseInt(domainLimit, 10) || 1,
          maxUsers: maxUsers === '' ? null : parseInt(maxUsers, 10),
          maxQuestions: maxQuestions === '' ? null : parseInt(maxQuestions, 10),
          maxCompetitors: maxCompetitors === '' ? null : parseInt(maxCompetitors, 10),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create organization')
        return
      }

      onSuccess()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily: fonts.body,
    border: `1px solid ${hb.slateLight}40`,
    borderRadius: '8px',
    color: hb.slate,
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: hb.slateMid,
    marginBottom: '4px',
    fontFamily: fonts.body,
  }

  return (
    <div
      style={{
        background: hb.surface,
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        border: `1px solid ${hb.teal}30`,
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: hb.slate,
          fontFamily: fonts.display,
          marginBottom: '20px',
        }}
      >
        Create Account
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Organization Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Company or Agency Name"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Owner Email *</label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              placeholder="owner@company.com"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '0 0 140px' }}>
            <label style={labelStyle}>Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              style={{ ...inputStyle, background: hb.surface }}
            >
              <option value="brand">brand</option>
              <option value="agency_10">agency_10</option>
              <option value="agency_20">agency_20</option>
              <option value="enterprise">enterprise</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ flex: '0 0 100px' }}>
            <label style={labelStyle}>Brands</label>
            <input
              type="number"
              value={domainLimit}
              onChange={(e) => setDomainLimit(e.target.value)}
              min={1}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={labelStyle}>Max Users</label>
            <input
              type="number"
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              placeholder="∞"
              min={1}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={labelStyle}>Max Questions</label>
            <input
              type="number"
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(e.target.value)}
              placeholder="∞"
              min={1}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={labelStyle}>Max Competitors</label>
            <input
              type="number"
              value={maxCompetitors}
              onChange={(e) => setMaxCompetitors(e.target.value)}
              placeholder="∞"
              min={1}
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: hb.coralLight,
              color: hb.error,
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
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
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={onCancel}
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
        </div>
      </form>
    </div>
  )
}

// ============================================
// MAIN ADMIN CLIENT
// ============================================

export function AdminClient() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null)
  const [refreshingBrandId, setRefreshingBrandId] = useState<string | null>(null)

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch('/api/hiringbrand/admin/organizations')
      if (res.status === 403) {
        setError('Access denied. You must be a HiringBrand super admin.')
        setLoading(false)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load')
        return
      }
      setOrgs(data.organizations)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const handleSave = async (orgId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/hiringbrand/admin/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Failed to update')
      return
    }

    setEditingId(null)
    fetchOrgs()
  }

  const handleForceRefresh = async (brand: OrgBrand, orgId: string) => {
    if (refreshingBrandId) return
    setRefreshingBrandId(brand.id)
    try {
      const res = await fetch('/api/hiringbrand/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: brand.domain,
          organizationId: orgId,
          monitoredDomainId: brand.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to trigger scan')
      } else {
        // Refresh data after a short delay to show updated status
        setTimeout(() => fetchOrgs(), 2000)
      }
    } catch {
      alert('Network error')
    } finally {
      setRefreshingBrandId(null)
    }
  }

  // Loading
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: hb.surfaceDim, fontFamily: fonts.body }}>
        <div style={{ textAlign: 'center', padding: '100px 24px' }}>
          <p style={{ color: hb.slateMid, fontSize: '15px' }}>Loading admin...</p>
        </div>
      </div>
    )
  }

  // Error / Access denied
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: hb.surfaceDim, fontFamily: fonts.body }}>
        <div style={{ textAlign: 'center', padding: '100px 24px' }}>
          <p style={{ color: hb.error, fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            {error}
          </p>
          <Link
            href="/hiringbrand/account"
            style={{
              color: hb.teal,
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            Back to Account
          </Link>
        </div>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 600,
    color: hb.slateLight,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: fonts.body,
    borderBottom: `1px solid ${hb.slateLight}20`,
  }

  const tdStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: '14px',
    color: hb.slate,
    fontFamily: fonts.body,
    borderBottom: `1px solid ${hb.slateLight}12`,
  }

  return (
    <div style={{ minHeight: '100vh', background: hb.surfaceDim }}>
      {/* Spin animation for refresh button */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          background: hb.surface,
          borderBottom: `1px solid ${hb.slateLight}20`,
          padding: '16px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/hiringbrand/account"
              style={{ textDecoration: 'none' }}
            >
              <span
                style={{
                  fontFamily: fonts.display,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: hb.teal,
                }}
              >
                hiring<span style={{ fontWeight: 800 }}>brand</span>
                <span style={{ color: hb.gold }}>.io</span>
              </span>
            </Link>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: hb.coral,
                background: hb.coralLight,
                padding: '3px 10px',
                borderRadius: '100px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Admin
            </span>
          </div>
          <Link
            href="/hiringbrand/account"
            style={{
              fontSize: '14px',
              color: hb.slateMid,
              textDecoration: 'none',
              fontFamily: fonts.body,
            }}
          >
            Back to Account
          </Link>
        </div>
      </div>

      {/* Main */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: hb.slate,
              fontFamily: fonts.display,
              margin: 0,
            }}
          >
            Organizations ({orgs.length})
          </h1>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: fonts.display,
                background: hb.coral,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Account
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <CreateOrgForm
            onSuccess={() => {
              setShowCreate(false)
              fetchOrgs()
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Org table */}
        <div
          style={{
            background: hb.surface,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            border: `1px solid ${hb.slateLight}20`,
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Organization</th>
                  <th style={thStyle}>Owner</th>
                  <th style={thStyle}>Tier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Brands</th>
                  <th style={thStyle}>Users</th>
                  <th style={thStyle}>Questions</th>
                  <th style={thStyle}>Competitors</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const isExpanded = expandedOrgId === org.id

                  if (editingId === org.id) {
                    return (
                      <EditRow
                        key={org.id}
                        org={org}
                        onSave={(updates) => handleSave(org.id, updates)}
                        onCancel={() => setEditingId(null)}
                      />
                    )
                  }

                  return [
                    // Org row
                    <tr
                      key={org.id}
                      style={{
                        cursor: 'pointer',
                        borderLeft: isExpanded ? `3px solid ${hb.teal}` : '3px solid transparent',
                        background: isExpanded ? hb.tealLight : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => {
                        setExpandedOrgId(isExpanded ? null : org.id)
                        setExpandedBrandId(null)
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) e.currentTarget.style.background = hb.surfaceDim
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={hb.slateLight}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s',
                              flexShrink: 0,
                            }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          <div>
                            <strong style={{ fontFamily: fonts.display }}>{org.name}</strong>
                            {org.domains.length > 0 && (
                              <div style={{ fontSize: '12px', color: hb.slateLight, marginTop: '2px' }}>
                                {org.domains.map((d) => d.companyName || d.domain).join(', ')}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: hb.slateLight, marginTop: '2px' }}>
                              Created {formatDate(org.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '13px', color: hb.slateMid }}>
                        {org.ownerEmail || '—'}
                      </td>
                      <td style={tdStyle}>
                        <TierBadge tier={org.tier} />
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={org.status} />
                      </td>
                      <td style={tdStyle}>
                        <LimitCell current={org.domains.length} max={org.domainLimit} />
                      </td>
                      <td style={tdStyle}>
                        <LimitCell current={org.memberCount + org.pendingInviteCount} max={org.maxUsers} />
                      </td>
                      <td style={tdStyle}>
                        <LimitCell max={org.maxQuestions} />
                      </td>
                      <td style={tdStyle}>
                        <LimitCell max={org.maxCompetitors} />
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(org.id)
                          }}
                          style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            fontFamily: fonts.body,
                            background: 'none',
                            border: `1px solid ${hb.slateLight}30`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: hb.slateMid,
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>,

                    // Expanded brands row
                    isExpanded && (
                      <tr key={`${org.id}-brands`}>
                        <td
                          colSpan={9}
                          style={{
                            padding: 0,
                            borderBottom: `1px solid ${hb.slateLight}12`,
                            background: `${hb.tealLight}80`,
                          }}
                        >
                          <div style={{ padding: '16px 24px 20px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: hb.slateLight,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '12px',
                              }}
                            >
                              Brands ({org.domains.length})
                            </div>
                            {org.domains.length === 0 ? (
                              <div style={{ color: hb.slateLight, fontSize: '13px', fontStyle: 'italic' }}>
                                No brands configured
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {org.domains.map((brand) => (
                                  <BrandCard
                                    key={brand.id}
                                    brand={brand}
                                    orgId={org.id}
                                    isExpanded={expandedBrandId === brand.id}
                                    onToggleExpand={() =>
                                      setExpandedBrandId(expandedBrandId === brand.id ? null : brand.id)
                                    }
                                    refreshingBrandId={refreshingBrandId}
                                    onForceRefresh={handleForceRefresh}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ]
                })}

                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: hb.slateLight }}>
                      No organizations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: hb.slateLight,
        }}
      >
        &copy; {new Date().getFullYear()} HiringBrand.io &mdash; Super Admin
      </footer>
    </div>
  )
}
