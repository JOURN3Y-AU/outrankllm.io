'use client'

/**
 * HiringBrand Role Insights Tab
 * Shows role-specific sentiment analysis and responses
 */

import { useState } from 'react'
import { hbColors, hbFonts, hbRadii, hbShadows, hbRoleFamilyConfig } from './shared/constants'
import type { HBJobFamily, HBResponse, HBSentimentCategory, HBRoleFamilyScores } from './shared/types'
import { HBResponseCard } from './HBResponseCard'

interface HBRolesProps {
  responses: HBResponse[]
  roleFamilies: Array<{
    family: HBJobFamily
    displayName: string
    description: string
  }>
  roleFamilyScores: HBRoleFamilyScores
  companyName: string
}

export function HBRoles({ responses, roleFamilies, roleFamilyScores, companyName }: HBRolesProps) {
  const [selectedFamily, setSelectedFamily] = useState<HBJobFamily | null>(
    roleFamilies.length > 0 ? roleFamilies[0].family : null
  )

  if (roleFamilies.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: hbColors.slate,
              fontFamily: hbFonts.display,
              marginBottom: '8px',
            }}
          >
            Role Insights
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: hbColors.slateMid,
              fontFamily: hbFonts.body,
              lineHeight: 1.6,
            }}
          >
            See how AI platforms describe {companyName} for different job families.
          </p>
        </div>

        <div
          style={{
            background: hbColors.surface,
            borderRadius: hbRadii.xl,
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: hbShadows.sm,
          }}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: hbColors.slate,
              fontFamily: hbFonts.display,
              marginBottom: '8px',
            }}
          >
            No Role Families Configured
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: hbColors.slateMid,
              fontFamily: hbFonts.body,
              lineHeight: 1.6,
            }}
          >
            Role families allow you to see how AI platforms describe your employer brand for specific job types.
            <br />
            Configure role families on the Setup tab to see role-specific analysis here.
          </p>
        </div>
      </div>
    )
  }

  const selectedFamilyData = roleFamilies.find((rf) => rf.family === selectedFamily)
  const selectedFamilyConfig = selectedFamily ? hbRoleFamilyConfig[selectedFamily] : null

  // Filter responses for selected family
  const familyResponses = selectedFamily
    ? responses.filter((r) => r.jobFamily === selectedFamily)
    : []

  // Calculate sentiment distribution
  const sentimentCounts = {
    strong: familyResponses.filter((r) => r.sentimentCategory === 'strong').length,
    positive: familyResponses.filter((r) => r.sentimentCategory === 'positive').length,
    mixed: familyResponses.filter((r) => r.sentimentCategory === 'mixed').length,
    negative: familyResponses.filter((r) => r.sentimentCategory === 'negative').length,
  }

  const totalResponses = familyResponses.length

  // Get scores for selected family
  const familyScores = selectedFamily ? roleFamilyScores[selectedFamily] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: hbColors.slate,
            fontFamily: hbFonts.display,
            marginBottom: '8px',
          }}
        >
          Role Insights
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: hbColors.slateMid,
            fontFamily: hbFonts.body,
            lineHeight: 1.6,
          }}
        >
          Employer brand perception varies by role type. Engineering talent may value different factors than sales or operations professionals. Compare how AI describes {companyName} across job families to tailor your recruitment messaging.
        </p>
      </div>

      {/* Family Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {roleFamilies.map((rf) => {
          const isSelected = rf.family === selectedFamily
          const config = hbRoleFamilyConfig[rf.family]
          const scores = roleFamilyScores[rf.family]

          return (
            <button
              key={rf.family}
              onClick={() => setSelectedFamily(rf.family)}
              style={{
                background: isSelected ? config.lightColor : hbColors.surface,
                border: `2px solid ${isSelected ? config.color : `${hbColors.slateLight}20`}`,
                borderRadius: hbRadii.xl,
                padding: '20px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 4px 12px ${config.color}20` : hbShadows.sm,
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: config.color,
                  fontFamily: hbFonts.display,
                  marginBottom: '8px',
                }}
              >
                {rf.displayName}
              </h3>
              {scores && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    title={`Desirability (0-100): How positively AI describes ${rf.displayName} roles. Calculated from average sentiment scores (1-10 scale). Score of ${scores.desirability} ≈ ${((scores.desirability / 100) * 9 + 1).toFixed(1)}/10 avg sentiment.`}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: hbColors.slateLight,
                        fontFamily: hbFonts.mono,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Desirability
                    </span>
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: config.color,
                        fontFamily: hbFonts.mono,
                      }}
                    >
                      {scores.desirability}
                    </span>
                  </div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    title={`Awareness (0-100): How much detailed information AI has about ${rf.displayName} roles. Based on response specificity and confidence.`}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: hbColors.slateLight,
                        fontFamily: hbFonts.mono,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Awareness
                    </span>
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: config.color,
                        fontFamily: hbFonts.mono,
                      }}
                    >
                      {scores.awareness}
                    </span>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Family Details */}
      {selectedFamily && selectedFamilyData && selectedFamilyConfig && (
        <div>
          {/* Content Header */}
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: hbColors.slate,
              fontFamily: hbFonts.display,
              marginBottom: '20px',
            }}
          >
            What AI Says About {selectedFamilyData.displayName}
          </h3>

          {/* Sentiment Distribution */}
          {totalResponses > 0 && (
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.lg,
                padding: '20px 24px',
                boxShadow: hbShadows.sm,
              }}
            >
              <div
                style={{
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: hbColors.slateMid,
                  marginBottom: '12px',
                }}
              >
                Sentiment Distribution
              </div>
              <div
                style={{
                  display: 'flex',
                  height: '24px',
                  borderRadius: hbRadii.full,
                  overflow: 'hidden',
                  background: hbColors.surfaceDim,
                }}
              >
                {[
                  { key: 'strong', color: hbColors.teal },
                  { key: 'positive', color: '#10B981' },
                  { key: 'mixed', color: hbColors.gold },
                  { key: 'negative', color: hbColors.coral },
                ].map(({ key, color }) => {
                  const count = sentimentCounts[key as keyof typeof sentimentCounts]
                  const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0
                  if (percent === 0) return null
                  return (
                    <div
                      key={key}
                      title={`${key}: ${count} (${Math.round(percent)}%)`}
                      style={{
                        width: `${percent}%`,
                        background: color,
                        transition: 'width 0.3s ease',
                        minWidth: count > 0 ? '4px' : 0,
                      }}
                    />
                  )
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '10px',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { key: 'strong', label: 'Strong (9-10)', color: hbColors.teal },
                  { key: 'positive', label: 'Positive (6-8)', color: '#10B981' },
                  { key: 'mixed', label: 'Mixed (4-5)', color: hbColors.gold },
                  { key: 'negative', label: 'Negative (1-3)', color: hbColors.coral },
                ].map(({ key, label, color }) => {
                  const count = sentimentCounts[key as keyof typeof sentimentCounts]
                  if (count === 0) return null
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: color,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: hbFonts.body,
                          fontSize: '12px',
                          color: hbColors.slateMid,
                        }}
                      >
                        {label} ({count})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Response Cards */}
          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: hbColors.slateLight,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontFamily: hbFonts.body,
                marginBottom: '16px',
              }}
            >
              AI Responses ({familyResponses.length})
            </h4>

            {familyResponses.length === 0 ? (
              <div
                style={{
                  background: hbColors.surfaceDim,
                  borderRadius: hbRadii.xl,
                  padding: '32px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: '15px',
                    color: hbColors.slateLight,
                    fontFamily: hbFonts.body,
                  }}
                >
                  No responses found for {selectedFamilyData.displayName}.
                  <br />
                  Run a new scan to collect role-specific responses.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {familyResponses.map((response) => (
                  <HBResponseCard key={response.id} response={response} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
