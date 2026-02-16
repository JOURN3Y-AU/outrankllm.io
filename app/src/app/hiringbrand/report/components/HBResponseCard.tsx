'use client'

/**
 * HiringBrand Response Card - Refined Design v2
 * Clean visual hierarchy: Header → Quick Take → Evidence → Details
 *
 * Key design decisions:
 * - Sentiment accent bar on left edge for quick scanning
 * - Quote-style chips for evidence (feels like real excerpts)
 * - De-emphasized metadata as cohesive pill system
 */

import { useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { hbColors, hbFonts, hbShadows, hbRadii, hbPlatformConfig, hbCategoryConfig } from './shared/constants'
import type { HBResponse, HBQuestionCategory, HBSentimentCategory } from './shared/types'

interface HBResponseCardProps {
  response: HBResponse
}

// Sentiment configuration with refined visual treatment
const sentimentConfig: Record<HBSentimentCategory, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}> = {
  strong: {
    label: 'Strong',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#10B981',
    icon: '↑'
  },
  positive: {
    label: 'Positive',
    color: '#0D9488',
    bgColor: '#CCFBF1',
    borderColor: '#14B8A6',
    icon: '↗'
  },
  mixed: {
    label: 'Mixed',
    color: '#D97706',
    bgColor: '#FEF3C7',
    borderColor: '#F59E0B',
    icon: '→'
  },
  negative: {
    label: 'Negative',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    borderColor: '#EF4444',
    icon: '↓'
  },
}

// Convert citation markers [1][2][3] to superscript styled citations
function formatCitations(text: string): string {
  // Match citation patterns like [1], [2], [123] etc.
  return text.replace(/\[(\d+)\]/g, '<sup style="font-size: 10px; color: #64748B; margin: 0 1px;">[$1]</sup>')
}

export function HBResponseCard({ response }: HBResponseCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const platformConfig = hbPlatformConfig[response.platform]
  const sentiment = response.sentimentCategory
    ? sentimentConfig[response.sentimentCategory]
    : sentimentConfig.mixed

  // Format the response text with styled citations
  const formattedResponseText = formatCitations(response.responseText)

  // Combine all positive evidence
  const positiveEvidence = [
    ...(response.sentimentPositivePhrases || []),
    ...(response.greenFlags || []),
  ].slice(0, 4) // Limit to prevent overwhelming

  // Combine all negative evidence
  const negativeEvidence = [
    ...(response.sentimentNegativePhrases || []),
    ...(response.redFlags || []),
  ].slice(0, 4)

  const hasEvidence = positiveEvidence.length > 0 || negativeEvidence.length > 0
  const hasCompetitors = response.competitorsMentioned.length > 0

  return (
    <div
      style={{
        background: hbColors.surface,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: `1px solid ${hbColors.surfaceDim}`,
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Sentiment accent bar - quick visual scan */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: `linear-gradient(180deg, ${sentiment.borderColor}, ${sentiment.color})`,
          borderRadius: '16px 0 0 16px',
        }}
      />
      {/* ═══════════════════════════════════════════════════════════
          HEADER: Platform + Question + Score (the scannable info)
          ═══════════════════════════════════════════════════════════ */}
      <div
        style={{
          padding: '20px 24px 20px 28px', // Extra left padding for accent bar
          borderBottom: `1px solid ${hbColors.surfaceDim}`,
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Platform icon - visual anchor */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: `${platformConfig.color}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Image
            src={platformConfig.iconPath}
            alt={platformConfig.name}
            width={24}
            height={24}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Question + metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: platformConfig.color,
                fontFamily: hbFonts.body,
              }}
            >
              {platformConfig.name}
            </span>
            <span style={{ color: hbColors.slateLight, fontSize: '12px' }}>·</span>
            <span
              style={{
                fontSize: '12px',
                color: hbColors.slateLight,
                fontFamily: hbFonts.body,
              }}
            >
              {hbCategoryConfig[response.promptCategory as HBQuestionCategory]?.label || 'General'}
            </span>
          </div>

          <div
            style={{
              fontFamily: hbFonts.display,
              fontSize: '16px',
              fontWeight: 600,
              color: hbColors.slate,
              lineHeight: 1.4,
            }}
          >
            {response.promptText || 'Employer reputation question'}
          </div>
        </div>

        {/* Sentiment Score - prominent visual indicator */}
        {response.sentimentScore !== null && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: sentiment.bgColor,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: sentiment.color,
                  fontFamily: hbFonts.display,
                  lineHeight: 1,
                }}
              >
                {response.sentimentScore}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: sentiment.color,
                  opacity: 0.7,
                }}
              >
                /10
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: sentiment.color,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              {sentiment.label}
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          QUICK TAKE: One-liner insight (if available)
          ═══════════════════════════════════════════════════════════ */}
      {response.recommendationSummary && (
        <div
          style={{
            padding: '14px 24px 14px 28px',
            background: `linear-gradient(135deg, ${sentiment.bgColor}50, transparent)`,
            borderBottom: `1px solid ${hbColors.surfaceDim}`,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              color: hbColors.slateMid,
              lineHeight: 1.6,
              fontFamily: hbFonts.body,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: sentiment.color,
                marginRight: '6px',
              }}
            >
              Quick take:
            </span>
            {response.recommendationSummary}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          KEY EVIDENCE: What AI said (positive & negative) as quote chips
          ═══════════════════════════════════════════════════════════ */}
      {hasEvidence && (
        <div
          style={{
            padding: '16px 24px 16px 28px',
            display: 'grid',
            gridTemplateColumns: positiveEvidence.length > 0 && negativeEvidence.length > 0
              ? '1fr 1fr'
              : '1fr',
            gap: '24px',
            borderBottom: `1px solid ${hbColors.surfaceDim}`,
          }}
        >
          {/* Positive Evidence */}
          {positiveEvidence.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  +
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#059669',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Positives
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {positiveEvidence.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '12px',
                      color: '#065F46',
                      lineHeight: 1.4,
                      padding: '6px 10px',
                      background: '#ECFDF5',
                      borderRadius: '8px',
                      border: '1px solid #A7F3D0',
                      fontFamily: hbFonts.body,
                      fontStyle: 'italic',
                      position: 'relative',
                    }}
                  >
                    <span style={{ opacity: 0.5, marginRight: '2px' }}>"</span>
                    {item}
                    <span style={{ opacity: 0.5, marginLeft: '2px' }}>"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Negative Evidence */}
          {negativeEvidence.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  −
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#DC2626',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Concerns
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {negativeEvidence.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '12px',
                      color: '#991B1B',
                      lineHeight: 1.4,
                      padding: '6px 10px',
                      background: '#FEF2F2',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      fontFamily: hbFonts.body,
                      fontStyle: 'italic',
                    }}
                  >
                    <span style={{ opacity: 0.5, marginRight: '2px' }}>"</span>
                    {item}
                    <span style={{ opacity: 0.5, marginLeft: '2px' }}>"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FULL RESPONSE: Expandable section with AI's complete answer
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '16px 24px 16px 28px' }}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '0',
            cursor: 'pointer',
            marginBottom: showDetails ? '16px' : '0',
            width: '100%',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: hbColors.slateMid,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: hbFonts.body,
            }}
          >
            {showDetails ? 'Hide' : 'Show'} full response
          </span>
          <span
            style={{
              fontSize: '14px',
              color: hbColors.slateLight,
              transition: 'transform 0.2s ease',
              transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
          <div
            style={{
              flex: 1,
              height: '1px',
              background: hbColors.surfaceDim,
              marginLeft: '8px',
            }}
          />
        </button>

        {showDetails && (
          <div
            style={{
              fontFamily: hbFonts.body,
              fontSize: '14px',
              color: hbColors.slateMid,
              lineHeight: 1.75,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                p: ({ children }) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: hbColors.slate }}>{children}</strong>
                ),
                em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                ul: ({ children }) => (
                  <ul style={{ marginBottom: '12px', paddingLeft: '20px', listStyleType: 'disc' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ marginBottom: '12px', paddingLeft: '20px', listStyleType: 'decimal' }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                h1: ({ children }) => (
                  <h1 style={{ fontSize: '17px', fontWeight: 700, color: hbColors.slate, marginBottom: '8px', marginTop: '16px' }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: hbColors.slate, marginBottom: '6px', marginTop: '14px' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: hbColors.slate, marginBottom: '6px', marginTop: '12px' }}>
                    {children}
                  </h3>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: `3px solid ${hbColors.teal}`, paddingLeft: '12px', marginBottom: '12px', color: hbColors.slateMid, fontStyle: 'italic' }}>
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: hbColors.teal, textDecoration: 'underline' }}>
                    {children}
                  </a>
                ),
                code: ({ children, className }) => {
                  // Check if it's a code block (has language class) or inline code
                  const isCodeBlock = className?.startsWith('language-')
                  if (isCodeBlock) {
                    return (
                      <pre style={{
                        background: hbColors.surfaceDim,
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        marginBottom: '12px',
                        fontFamily: hbFonts.mono,
                        fontSize: '13px',
                      }}>
                        <code style={{ color: hbColors.slate }}>{children}</code>
                      </pre>
                    )
                  }
                  return (
                    <code style={{
                      background: hbColors.surfaceDim,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: hbFonts.mono,
                      fontSize: '13px',
                      color: hbColors.slate,
                    }}>
                      {children}
                    </code>
                  )
                },
                hr: () => (
                  <hr style={{
                    border: 'none',
                    borderTop: `1px solid ${hbColors.surfaceDim}`,
                    marginTop: '16px',
                    marginBottom: '16px',
                  }} />
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: hbColors.surfaceDim }}>
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => (
                  <tr style={{ borderBottom: `1px solid ${hbColors.surfaceDim}` }}>
                    {children}
                  </tr>
                ),
                th: ({ children }) => (
                  <th style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: hbColors.slate,
                  }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{
                    padding: '8px 12px',
                    color: hbColors.slateMid,
                  }}>
                    {children}
                  </td>
                ),
              }}
            >
              {formattedResponseText}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER: Metadata as cohesive pill badges
          ═══════════════════════════════════════════════════════════ */}
      {(hasCompetitors || response.sourceQuality || response.hedgingLevel) && (
        <div
          style={{
            padding: '12px 24px 12px 28px',
            background: `linear-gradient(180deg, ${hbColors.surfaceDim}, ${hbColors.surface})`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            fontSize: '11px',
            borderTop: `1px solid ${hbColors.surfaceDim}`,
          }}
        >
          {hasCompetitors && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: hbColors.surface,
                borderRadius: '20px',
                border: `1px solid ${hbColors.surfaceDim}`,
              }}
            >
              <span style={{ color: hbColors.slateLight, fontWeight: 500 }}>Competitors:</span>
              <span style={{ color: hbColors.slateMid, fontWeight: 500 }}>
                {response.competitorsMentioned.map(c => c.name).join(', ')}
              </span>
            </div>
          )}

          {response.hedgingLevel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: response.hedgingLevel === 'low' ? '#ECFDF5' :
                           response.hedgingLevel === 'high' ? '#FEF2F2' : '#FFFBEB',
                borderRadius: '20px',
                border: `1px solid ${
                  response.hedgingLevel === 'low' ? '#A7F3D0' :
                  response.hedgingLevel === 'high' ? '#FECACA' : '#FDE68A'
                }`,
              }}
            >
              <span style={{ color: hbColors.slateLight, fontWeight: 500 }}>Confidence:</span>
              <span style={{
                color: response.hedgingLevel === 'low' ? '#059669' :
                       response.hedgingLevel === 'high' ? '#DC2626' : '#D97706',
                fontWeight: 600,
              }}>
                {response.hedgingLevel === 'low' ? 'High' :
                 response.hedgingLevel === 'high' ? 'Low' : 'Medium'}
              </span>
            </div>
          )}

          {response.sourceQuality && response.sourceQuality !== 'none' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: response.sourceQuality === 'strong' ? '#ECFDF5' :
                           response.sourceQuality === 'weak' ? '#FFFBEB' : hbColors.surface,
                borderRadius: '20px',
                border: `1px solid ${
                  response.sourceQuality === 'strong' ? '#A7F3D0' :
                  response.sourceQuality === 'weak' ? '#FDE68A' : hbColors.surfaceDim
                }`,
              }}
            >
              <span style={{ color: hbColors.slateLight, fontWeight: 500 }}>Sources:</span>
              <span style={{
                color: response.sourceQuality === 'strong' ? '#059669' :
                       response.sourceQuality === 'weak' ? '#D97706' : hbColors.slateMid,
                fontWeight: 600,
              }}>
                {response.sourceQuality === 'strong' ? 'Well-sourced' :
                 response.sourceQuality === 'moderate' ? 'Some' : 'Few'}
              </span>
            </div>
          )}

          {response.responseRecency && response.responseRecency !== 'unknown' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: response.responseRecency === 'current' ? '#ECFDF5' : hbColors.surface,
                borderRadius: '20px',
                border: `1px solid ${
                  response.responseRecency === 'current' ? '#A7F3D0' : hbColors.surfaceDim
                }`,
              }}
            >
              <span style={{ color: hbColors.slateLight, fontWeight: 500 }}>Info:</span>
              <span style={{
                color: response.responseRecency === 'current' ? '#059669' : hbColors.slateMid,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}>
                {response.responseRecency}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
