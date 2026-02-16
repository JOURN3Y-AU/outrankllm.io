'use client'

/**
 * HiringBrand Setup Tab
 * Allows owner/admin to edit scan questions and competitors.
 */

import { useState, useEffect, useCallback } from 'react'
import { hbColors, hbFonts, hbShadows, hbRadii, hbCategoryConfig, hbRoleFamilyConfig } from './shared/constants'
import type { HBQuestionCategory, HBJobFamily } from './shared/types'

// ============================================
// TYPES
// ============================================

interface EditableQuestion {
  id?: string
  promptText: string
  category: HBQuestionCategory
  source: string
}

interface EditableCompetitor {
  id?: string
  name: string
  domain: string
  reason: string
  source: string
}

interface EditableRoleFamily {
  id?: string
  family: HBJobFamily
  displayName: string
  description: string
  source: string
}

interface SetupData {
  questions: EditableQuestion[]
  competitors: EditableCompetitor[]
  roleFamilies: EditableRoleFamily[]
  limits: { maxQuestions: number; maxCompetitors: number; maxRoleFamilies: number }
}

interface HBSetupProps {
  reportToken: string
  companyName: string
  onRescanTriggered?: () => void
}

// ============================================
// SOURCE BADGE
// ============================================

function SourceBadge({ source }: { source: string }) {
  const isCustom = source === 'user_custom'
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        color: isCustom ? '#B8860B' : hbColors.tealDeep,
        background: isCustom ? hbColors.goldLight : hbColors.tealLight,
        padding: '2px 6px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {isCustom ? 'Custom' : 'AI'}
    </span>
  )
}

// ============================================
// QUESTION ROW
// ============================================

function QuestionRow({
  question,
  index,
  onChange,
  onDelete,
  canDelete,
}: {
  question: EditableQuestion
  index: number
  onChange: (index: number, field: keyof EditableQuestion, value: string) => void
  onDelete: (index: number) => void
  canDelete: boolean
}) {
  const categories = Object.entries(hbCategoryConfig) as [HBQuestionCategory, { label: string }][]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 0',
        borderBottom: `1px solid ${hbColors.slateLight}15`,
      }}
    >
      <span
        style={{
          fontSize: '12px',
          color: hbColors.slateLight,
          width: '24px',
          textAlign: 'center',
          flexShrink: 0,
          fontFamily: hbFonts.mono,
        }}
      >
        {index + 1}
      </span>

      <select
        value={question.category}
        onChange={(e) => onChange(index, 'category', e.target.value)}
        style={{
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: hbFonts.body,
          color: hbColors.slateMid,
          background: hbColors.surfaceDim,
          border: `1px solid ${hbColors.slateLight}25`,
          borderRadius: hbRadii.sm,
          padding: '6px 8px',
          cursor: 'pointer',
          width: '130px',
          flexShrink: 0,
        }}
      >
        {categories.map(([key, cfg]) => (
          <option key={key} value={key}>
            {cfg.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={question.promptText}
        onChange={(e) => onChange(index, 'promptText', e.target.value)}
        placeholder="Enter a question for AI platforms..."
        style={{
          flex: 1,
          fontSize: '14px',
          fontFamily: hbFonts.body,
          color: hbColors.slate,
          border: `1px solid ${hbColors.slateLight}25`,
          borderRadius: hbRadii.sm,
          padding: '8px 12px',
          outline: 'none',
          background: 'transparent',
        }}
      />

      <SourceBadge source={question.source} />

      <button
        onClick={() => onDelete(index)}
        disabled={!canDelete}
        title={canDelete ? 'Remove question' : 'At least 1 question required'}
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: hbRadii.sm,
          cursor: canDelete ? 'pointer' : 'not-allowed',
          color: canDelete ? hbColors.slateLight : `${hbColors.slateLight}40`,
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ============================================
// COMPETITOR ROW
// ============================================

function CompetitorRow({
  competitor,
  index,
  onChange,
  onDelete,
}: {
  competitor: EditableCompetitor
  index: number
  onChange: (index: number, field: keyof EditableCompetitor, value: string) => void
  onDelete: (index: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 0',
        borderBottom: `1px solid ${hbColors.slateLight}15`,
      }}
    >
      <span
        style={{
          fontSize: '12px',
          color: hbColors.slateLight,
          width: '24px',
          textAlign: 'center',
          flexShrink: 0,
          fontFamily: hbFonts.mono,
        }}
      >
        {index + 1}
      </span>

      <input
        type="text"
        value={competitor.name}
        onChange={(e) => onChange(index, 'name', e.target.value)}
        placeholder="Company name"
        style={{
          flex: 2,
          fontSize: '14px',
          fontFamily: hbFonts.body,
          color: hbColors.slate,
          border: `1px solid ${hbColors.slateLight}25`,
          borderRadius: hbRadii.sm,
          padding: '8px 12px',
          outline: 'none',
          background: 'transparent',
        }}
      />

      <input
        type="text"
        value={competitor.domain}
        onChange={(e) => onChange(index, 'domain', e.target.value)}
        placeholder="domain.com (optional)"
        style={{
          flex: 1,
          fontSize: '14px',
          fontFamily: hbFonts.body,
          color: hbColors.slateMid,
          border: `1px solid ${hbColors.slateLight}25`,
          borderRadius: hbRadii.sm,
          padding: '8px 12px',
          outline: 'none',
          background: 'transparent',
        }}
      />

      <SourceBadge source={competitor.source} />

      <button
        onClick={() => onDelete(index)}
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: hbRadii.sm,
          cursor: 'pointer',
          color: hbColors.slateLight,
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ============================================
// ROLE FAMILY ROW
// ============================================

function RoleFamilyRow({
  roleFamily,
  index,
  onChange,
  onDelete,
}: {
  roleFamily: EditableRoleFamily
  index: number
  onChange: (index: number, field: keyof EditableRoleFamily, value: string) => void
  onDelete: (index: number) => void
}) {
  const families = Object.entries(hbRoleFamilyConfig).filter(([key]) => key !== 'general') as [HBJobFamily, { label: string; description: string }][]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 0',
        borderBottom: `1px solid ${hbColors.slateLight}15`,
      }}
    >
      <span
        style={{
          fontSize: '12px',
          color: hbColors.slateLight,
          width: '24px',
          textAlign: 'center',
          flexShrink: 0,
          fontFamily: hbFonts.mono,
          paddingTop: '6px',
        }}
      >
        {index + 1}
      </span>

      <select
        value={roleFamily.family}
        onChange={(e) => onChange(index, 'family', e.target.value)}
        style={{
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: hbFonts.body,
          color: hbColors.slateMid,
          background: hbColors.surfaceDim,
          border: `1px solid ${hbColors.slateLight}25`,
          borderRadius: hbRadii.sm,
          padding: '6px 8px',
          cursor: 'pointer',
          width: '160px',
          flexShrink: 0,
        }}
      >
        {families.map(([key, cfg]) => (
          <option key={key} value={key}>
            {cfg.label}
          </option>
        ))}
      </select>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          type="text"
          value={roleFamily.displayName}
          onChange={(e) => onChange(index, 'displayName', e.target.value)}
          placeholder="Display name (e.g., Engineering & Tech)"
          style={{
            fontSize: '14px',
            fontFamily: hbFonts.body,
            color: hbColors.slate,
            border: `1px solid ${hbColors.slateLight}25`,
            borderRadius: hbRadii.sm,
            padding: '8px 12px',
            outline: 'none',
            background: 'transparent',
          }}
        />
        <input
          type="text"
          value={roleFamily.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          placeholder="Description (optional)"
          style={{
            fontSize: '13px',
            fontFamily: hbFonts.body,
            color: hbColors.slateMid,
            border: `1px solid ${hbColors.slateLight}25`,
            borderRadius: hbRadii.sm,
            padding: '6px 12px',
            outline: 'none',
            background: 'transparent',
          }}
        />
      </div>

      <SourceBadge source={roleFamily.source} />

      <button
        onClick={() => onDelete(index)}
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: hbRadii.sm,
          cursor: 'pointer',
          color: hbColors.slateLight,
          flexShrink: 0,
          marginTop: '4px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function HBSetup({ reportToken, companyName, onRescanTriggered }: HBSetupProps) {
  const [data, setData] = useState<SetupData | null>(null)
  const [questions, setQuestions] = useState<EditableQuestion[]>([])
  const [competitors, setCompetitors] = useState<EditableCompetitor[]>([])
  const [roleFamilies, setRoleFamilies] = useState<EditableRoleFamily[]>([])
  const [originalSnapshot, setOriginalSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/hiringbrand/report/${reportToken}/setup`)
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to load setup')
        setLoading(false)
        return
      }
      const json: SetupData = await res.json()
      setData(json)
      setQuestions(json.questions)
      setCompetitors(json.competitors)
      setRoleFamilies(json.roleFamilies || [])
      setOriginalSnapshot(JSON.stringify({ questions: json.questions, competitors: json.competitors, roleFamilies: json.roleFamilies || [] }))
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [reportToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const [savingType, setSavingType] = useState<'save' | 'rescan' | null>(null)

  const currentSnapshot = JSON.stringify({ questions, competitors, roleFamilies })
  const isDirty = currentSnapshot !== originalSnapshot

  // Handlers: Questions
  const handleQuestionChange = (index: number, field: keyof EditableQuestion, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleQuestionDelete = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { promptText: '', category: 'reputation' as HBQuestionCategory, source: 'user_custom' },
    ])
  }

  // Handlers: Competitors
  const handleCompetitorChange = (index: number, field: keyof EditableCompetitor, value: string) => {
    setCompetitors((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleCompetitorDelete = (index: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddCompetitor = () => {
    setCompetitors((prev) => [
      ...prev,
      { name: '', domain: '', reason: '', source: 'user_custom' },
    ])
  }

  // Handlers: Role Families
  const handleRoleFamilyChange = (index: number, field: keyof EditableRoleFamily, value: string) => {
    setRoleFamilies((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleRoleFamilyDelete = (index: number) => {
    setRoleFamilies((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddRoleFamily = () => {
    // Default to engineering if not already added, otherwise first available family
    const usedFamilies = new Set(roleFamilies.map((rf) => rf.family))
    const availableFamilies = (['engineering', 'business', 'operations', 'creative', 'corporate'] as HBJobFamily[]).filter(
      (f) => !usedFamilies.has(f)
    )
    const defaultFamily = availableFamilies[0] || 'engineering'
    const defaultConfig = hbRoleFamilyConfig[defaultFamily]

    setRoleFamilies((prev) => [
      ...prev,
      {
        family: defaultFamily,
        displayName: defaultConfig.label,
        description: defaultConfig.description,
        source: 'user_custom',
      },
    ])
  }

  // Save
  const handleSave = async (rescan = false) => {
    setSaving(true)
    setSavingType(rescan ? 'rescan' : 'save')
    setError(null)
    setSuccessMessage(null)

    try {
      // Save questions
      const qRes = await fetch(`/api/hiringbrand/report/${reportToken}/setup/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      })
      if (!qRes.ok) {
        const json = await qRes.json()
        setError(json.error || 'Failed to save questions')
        setSaving(false)
        return
      }

      // Save competitors
      const cRes = await fetch(`/api/hiringbrand/report/${reportToken}/setup/competitors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitors }),
      })
      if (!cRes.ok) {
        const json = await cRes.json()
        setError(json.error || 'Failed to save competitors')
        setSaving(false)
        return
      }

      // Save role families
      const rfRes = await fetch(`/api/hiringbrand/report/${reportToken}/setup/role-families`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleFamilies }),
      })
      if (!rfRes.ok) {
        const json = await rfRes.json()
        setError(json.error || 'Failed to save role families')
        setSaving(false)
        return
      }

      // Trigger rescan if requested
      if (rescan) {
        await fetch(`/api/hiringbrand/report/${reportToken}/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rescan' }),
        })
        setSuccessMessage('Saved! A new scan has been triggered.')
        onRescanTriggered?.()
      } else {
        setSuccessMessage('Changes saved. They will apply on the next scan.')
      }

      // Refresh data to get server-assigned IDs for new items
      await fetchData()
    } catch {
      setError('Network error while saving')
    } finally {
      setSaving(false)
      setSavingType(null)
      setTimeout(() => setSuccessMessage(null), 5000)
    }
  }

  // Loading
  if (loading) {
    return (
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '60px 32px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: hbColors.slateMid, fontSize: '15px', fontFamily: hbFonts.body }}>
          Loading setup...
        </p>
      </div>
    )
  }

  // Auth error
  if (error && !data) {
    return (
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '60px 32px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: hbColors.error, fontSize: '15px', fontFamily: hbFonts.body }}>
          {error}
        </p>
      </div>
    )
  }

  const maxQ = data?.limits.maxQuestions || 20
  const maxC = data?.limits.maxCompetitors || 10
  const maxRF = data?.limits.maxRoleFamilies || 5

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 32px 120px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: hbColors.slate,
            fontFamily: hbFonts.display,
            marginBottom: '8px',
          }}
        >
          Setup
          <span style={{ color: hbColors.slateLight, fontWeight: 400 }}> · {companyName}</span>
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: hbColors.slateMid,
            fontFamily: hbFonts.body,
            lineHeight: 1.5,
          }}
        >
          Configure the questions AI platforms will be asked about your employer brand,
          and the competitors you want to benchmark against.
          Changes apply on the next scan.
        </p>
      </div>

      {/* Questions Section */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.xl,
          padding: '28px',
          boxShadow: hbShadows.sm,
          border: `1px solid ${hbColors.slateLight}20`,
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: hbColors.slateLight,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: hbFonts.body,
            }}
          >
            Scan Questions
          </h3>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: questions.length >= maxQ ? hbColors.coral : hbColors.slateMid,
              fontFamily: hbFonts.mono,
            }}
          >
            {questions.length} / {maxQ}
          </span>
        </div>

        {questions.map((q, i) => (
          <QuestionRow
            key={q.id || `new-${i}`}
            question={q}
            index={i}
            onChange={handleQuestionChange}
            onDelete={handleQuestionDelete}
            canDelete={questions.length > 1}
          />
        ))}

        <button
          onClick={handleAddQuestion}
          disabled={questions.length >= maxQ}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: hbFonts.body,
            color: questions.length >= maxQ ? hbColors.slateLight : hbColors.tealDeep,
            background: questions.length >= maxQ ? hbColors.surfaceDim : hbColors.tealLight,
            border: 'none',
            borderRadius: hbRadii.md,
            cursor: questions.length >= maxQ ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Question
        </button>
      </div>

      {/* Competitors Section */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.xl,
          padding: '28px',
          boxShadow: hbShadows.sm,
          border: `1px solid ${hbColors.slateLight}20`,
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: hbColors.slateLight,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: hbFonts.body,
            }}
          >
            Competitors
          </h3>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: competitors.length >= maxC ? hbColors.coral : hbColors.slateMid,
              fontFamily: hbFonts.mono,
            }}
          >
            {competitors.length} / {maxC}
          </span>
        </div>

        {competitors.length === 0 && (
          <p
            style={{
              fontSize: '14px',
              color: hbColors.slateLight,
              fontStyle: 'italic',
              padding: '12px 0',
              fontFamily: hbFonts.body,
            }}
          >
            No competitors configured. Add competitors to benchmark your employer brand against.
          </p>
        )}

        {competitors.map((c, i) => (
          <CompetitorRow
            key={c.id || `new-${i}`}
            competitor={c}
            index={i}
            onChange={handleCompetitorChange}
            onDelete={handleCompetitorDelete}
          />
        ))}

        <button
          onClick={handleAddCompetitor}
          disabled={competitors.length >= maxC}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: hbFonts.body,
            color: competitors.length >= maxC ? hbColors.slateLight : hbColors.tealDeep,
            background: competitors.length >= maxC ? hbColors.surfaceDim : hbColors.tealLight,
            border: 'none',
            borderRadius: hbRadii.md,
            cursor: competitors.length >= maxC ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Competitor
        </button>
      </div>

      {/* Role Families Section */}
      <div
        style={{
          background: hbColors.surface,
          borderRadius: hbRadii.xl,
          padding: '28px',
          boxShadow: hbShadows.sm,
          border: `1px solid ${hbColors.slateLight}20`,
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: hbColors.slateLight,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontFamily: hbFonts.body,
                marginBottom: '4px',
              }}
            >
              Role Families
            </h3>
            <p
              style={{
                fontSize: '12px',
                color: hbColors.slateLight,
                fontFamily: hbFonts.body,
                lineHeight: 1.4,
              }}
            >
              Target specific job families with tailored questions and analysis
            </p>
          </div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: roleFamilies.length >= maxRF ? hbColors.coral : hbColors.slateMid,
              fontFamily: hbFonts.mono,
            }}
          >
            {roleFamilies.length} / {maxRF}
          </span>
        </div>

        {roleFamilies.length === 0 && (
          <p
            style={{
              fontSize: '14px',
              color: hbColors.slateLight,
              fontStyle: 'italic',
              padding: '12px 0',
              fontFamily: hbFonts.body,
            }}
          >
            No role families configured. AI will auto-detect relevant families on the next scan.
          </p>
        )}

        {roleFamilies.map((rf, i) => (
          <RoleFamilyRow
            key={rf.id || `new-${i}`}
            roleFamily={rf}
            index={i}
            onChange={handleRoleFamilyChange}
            onDelete={handleRoleFamilyDelete}
          />
        ))}

        <button
          onClick={handleAddRoleFamily}
          disabled={roleFamilies.length >= maxRF}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: hbFonts.body,
            color: roleFamilies.length >= maxRF ? hbColors.slateLight : hbColors.tealDeep,
            background: roleFamilies.length >= maxRF ? hbColors.surfaceDim : hbColors.tealLight,
            border: 'none',
            borderRadius: hbRadii.md,
            cursor: roleFamilies.length >= maxRF ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Role Family
        </button>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: hbRadii.md,
            background: '#FEF2F2',
            color: hbColors.error,
            fontSize: '14px',
            fontFamily: hbFonts.body,
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: hbRadii.md,
            background: '#F0FDF4',
            color: hbColors.success,
            fontSize: '14px',
            fontFamily: hbFonts.body,
            marginBottom: '16px',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Sticky Action Bar — visible when dirty OR while saving */}
      {(isDirty || saving) && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: hbColors.surface,
            borderTop: `1px solid ${hbColors.slateLight}20`,
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)',
            padding: '16px 32px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: '960px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {saving ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={hbColors.teal}
                    strokeWidth="2.5"
                    style={{ animation: 'hb-spin 1s linear infinite' }}
                  >
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: '14px', color: hbColors.tealDeep, fontWeight: 500, fontFamily: hbFonts.body }}>
                    {savingType === 'rescan' ? 'Saving & triggering rescan...' : 'Saving changes...'}
                  </span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: hbColors.gold,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: hbColors.slateMid, fontFamily: hbFonts.body }}>
                    Unsaved changes
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: hbFonts.display,
                  background: saving ? hbColors.slateLight : hbColors.teal,
                  color: 'white',
                  border: 'none',
                  borderRadius: hbRadii.lg,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {savingType === 'save' ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: hbFonts.display,
                  background: saving ? hbColors.slateLight : hbColors.coral,
                  color: 'white',
                  border: 'none',
                  borderRadius: hbRadii.lg,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {savingType === 'rescan' ? 'Saving...' : 'Save & Rescan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe animation */}
      <style>{`
        @keyframes hb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
