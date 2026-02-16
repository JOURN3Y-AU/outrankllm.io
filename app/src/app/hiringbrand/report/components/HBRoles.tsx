'use client'

/**
 * HiringBrand By Role Tab
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
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: hbColors.slate,
            fontFamily: hbFonts.display,
            marginBottom: '12px',
          }}
        >
          No Role Families Configured
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: hbColors.slateMid,
            fontFamily: hbFonts.body,
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Role families allow you to see how AI platforms describe your employer brand for specific job types.
          <br />
          Configure role families on the Setup tab to see role-specific analysis here.
        </p>
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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: hbColors.slate,
            fontFamily: hbFonts.display,
            marginBottom: '8px',
          }}
        >
          By Role
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: hbColors.slateMid,
            fontFamily: hbFonts.body,
            lineHeight: 1.5,
          }}
        >
          See how AI platforms describe {companyName} for different job families.
        </p>
      </div>

      {/* Family Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          {/* Family Header */}
          <div
            style={{
              background: selectedFamilyConfig.lightColor,
              borderRadius: hbRadii.xl,
              padding: '24px 28px',
              marginBottom: '24px',
              border: `1px solid ${selectedFamilyConfig.color}30`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: selectedFamilyConfig.color,
                    fontFamily: hbFonts.display,
                    marginBottom: '4px',
                  }}
                >
                  {selectedFamilyData.displayName}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: hbColors.slateMid,
                    fontFamily: hbFonts.body,
                  }}
                >
                  {selectedFamilyData.description}
                </p>
              </div>
              {familyScores && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: hbColors.slateLight,
                        fontFamily: hbFonts.mono,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '4px',
                      }}
                    >
                      Desirability
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: selectedFamilyConfig.color,
                        fontFamily: hbFonts.mono,
                      }}
                    >
                      {familyScores.desirability}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: hbColors.slateLight,
                        fontFamily: hbFonts.mono,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '4px',
                      }}
                    >
                      Awareness
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: selectedFamilyConfig.color,
                        fontFamily: hbFonts.mono,
                      }}
                    >
                      {familyScores.awareness}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sentiment Distribution */}
          {totalResponses > 0 && (
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.xl,
                padding: '24px 28px',
                boxShadow: hbShadows.sm,
                border: `1px solid ${hbColors.slateLight}20`,
                marginBottom: '24px',
              }}
            >
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
                Sentiment Breakdown
              </h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { key: 'strong', label: 'Strong (9-10)', color: hbColors.teal },
                  { key: 'positive', label: 'Positive (6-8)', color: '#10B981' },
                  { key: 'mixed', label: 'Mixed (4-5)', color: hbColors.gold },
                  { key: 'negative', label: 'Negative (1-3)', color: hbColors.coral },
                ].map(({ key, label, color }) => {
                  const count = sentimentCounts[key as keyof typeof sentimentCounts]
                  const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0

                  return (
                    <div key={key} style={{ flex: '1 1 150px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            color: hbColors.slateMid,
                            fontFamily: hbFonts.body,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: color,
                            fontFamily: hbFonts.mono,
                          }}
                        >
                          {count}
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          background: `${hbColors.slateLight}15`,
                          borderRadius: hbRadii.full,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: color,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
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
