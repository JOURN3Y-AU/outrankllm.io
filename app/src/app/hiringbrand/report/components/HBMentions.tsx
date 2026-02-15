/**
 * HBMentions - Employer Brand Clippings Tab
 * Shows web articles, reviews, and discussions grouped by sentiment:
 * "Positive coverage" vs "Coverage to watch" with AI coverage briefing
 */

'use client'

import { useState, useMemo } from 'react'
import { hbColors, hbFonts, hbShadows, hbRadii } from './shared/constants'
import { HBTabFooter } from './HBTabFooter'
import type {
  HBWebMention,
  HBMentionStats,
  HBMentionInsight,
  HBMentionSourceType,
  HBMentionSentiment,
  HBTabId,
} from './shared/types'

interface HBMentionsProps {
  mentions: HBWebMention[]
  mentionStats: HBMentionStats | null
  companyName: string
  onNavigate: (tab: HBTabId) => void
}

// Source type display labels
const sourceTypeLabels: Record<HBMentionSourceType, string> = {
  press: 'Press',
  review_site: 'Review Site',
  blog: 'Blog',
  news: 'News',
  social: 'Social',
  jobs_board: 'Jobs Board',
  careers_page: 'Careers Page',
  other: 'Other',
}

// Sentiment colors
const sentimentColors: Record<HBMentionSentiment, string> = {
  positive: hbColors.teal,
  negative: hbColors.coral,
  neutral: hbColors.slateLight,
  mixed: hbColors.gold,
}

const sentimentLabels: Record<HBMentionSentiment, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  mixed: 'Mixed',
}

// Insight type config
const insightConfig: Record<string, { color: string; icon: string }> = {
  positive: { color: hbColors.teal, icon: 'check' },
  negative: { color: hbColors.coral, icon: 'alert' },
  opportunity: { color: '#6366F1', icon: 'arrow' },
}

// Format relative dates
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 1) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks}w ago`
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months}mo ago`
    }
    const years = Math.floor(diffDays / 365)
    return `${years}yr ago`
  } catch {
    return ''
  }
}

// Number of clippings to show initially per column
const INITIAL_SHOW_COUNT = 5

export function HBMentions({ mentions, mentionStats, companyName, onNavigate }: HBMentionsProps) {
  const [showAllPositive, setShowAllPositive] = useState(false)
  const [showAllNegative, setShowAllNegative] = useState(false)
  const [showNeutral, setShowNeutral] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<HBMentionSourceType | 'all'>('all')

  // Split mentions into groups
  const { positiveMentions, negativeMentions, neutralMentions } = useMemo(() => {
    const filtered = sourceFilter === 'all'
      ? mentions
      : mentions.filter(m => m.sourceType === sourceFilter)

    return {
      positiveMentions: filtered.filter(m => m.sentiment === 'positive'),
      negativeMentions: filtered.filter(m => m.sentiment === 'negative' || m.sentiment === 'mixed'),
      neutralMentions: filtered.filter(m => m.sentiment === 'neutral'),
    }
  }, [mentions, sourceFilter])

  // Get available source types
  const availableSourceTypes = useMemo(() => {
    const types = new Map<HBMentionSourceType, number>()
    for (const m of mentions) {
      types.set(m.sourceType, (types.get(m.sourceType) || 0) + 1)
    }
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1])
  }, [mentions])

  const uniqueSources = new Set(mentions.map(m => m.domainName).filter(Boolean)).size
  const insights = mentionStats?.insights || []

  // Stats for sentiment bar
  const stats = mentionStats || {
    total: mentions.length,
    bySentiment: {
      positive: positiveMentions.length,
      negative: negativeMentions.length,
      neutral: neutralMentions.length,
      mixed: 0,
    },
    bySourceType: {} as Record<HBMentionSourceType, number>,
    topDomains: [],
    avgSentimentScore: 5,
    avgRelevanceScore: 5,
  }

  // Empty state
  if (mentions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2 style={{
            fontFamily: hbFonts.display,
            fontSize: '24px',
            fontWeight: 700,
            color: hbColors.slate,
            marginBottom: '8px',
          }}>
            Your employer brand clippings
          </h2>
          <p style={{
            fontFamily: hbFonts.body,
            fontSize: '15px',
            color: hbColors.slateMid,
            lineHeight: 1.6,
          }}>
            We searched the web for mentions of {companyName} as an employer.
          </p>
        </div>

        <div style={{
          background: hbColors.surface,
          borderRadius: hbRadii.xl,
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: hbShadows.sm,
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="1.5" style={{ marginBottom: '16px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <h3 style={{
            fontFamily: hbFonts.display,
            fontSize: '18px',
            fontWeight: 600,
            color: hbColors.slate,
            marginBottom: '8px',
          }}>
            No web clippings found
          </h3>
          <p style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            color: hbColors.slateMid,
            lineHeight: 1.6,
          }}>
            We searched for mentions of {companyName} as an employer but didn&apos;t find
            any significant results. This could mean your employer brand has
            limited online presence — which is itself valuable information.
          </p>
          <p style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            color: hbColors.slateMid,
            lineHeight: 1.6,
            marginTop: '12px',
          }}>
            Consider publishing careers content, encouraging employee reviews,
            and engaging in industry discussions to build your digital footprint.
          </p>
        </div>

        <HBTabFooter
          nextTab="competitors"
          nextLabel="Competitors"
          previewText={`Now see how ${companyName}'s brand compares to competitors.`}
          onNavigate={onNavigate}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header - inline stats */}
      <div>
        <h2 style={{
          fontFamily: hbFonts.display,
          fontSize: '24px',
          fontWeight: 700,
          color: hbColors.slate,
          marginBottom: '8px',
        }}>
          Your employer brand clippings
        </h2>
        <p style={{
          fontFamily: hbFonts.body,
          fontSize: '15px',
          color: hbColors.slateMid,
          lineHeight: 1.6,
        }}>
          We scanned <strong style={{ color: hbColors.slate }}>{uniqueSources} sources</strong> and
          clipped <strong style={{ color: hbColors.slate }}>{mentions.length} mentions</strong> of {companyName} as
          an employer. Here&apos;s what they say.
        </p>
      </div>

      {/* Sentiment Distribution Bar */}
      <div style={{
        background: hbColors.surface,
        borderRadius: hbRadii.lg,
        padding: '20px 24px',
        boxShadow: hbShadows.sm,
      }}>
        <div style={{
          fontFamily: hbFonts.body,
          fontSize: '13px',
          fontWeight: 600,
          color: hbColors.slateMid,
          marginBottom: '12px',
        }}>
          Sentiment Distribution
        </div>
        <div style={{
          display: 'flex',
          height: '24px',
          borderRadius: hbRadii.full,
          overflow: 'hidden',
          background: hbColors.surfaceDim,
        }}>
          {(['positive', 'neutral', 'mixed', 'negative'] as HBMentionSentiment[]).map(sentiment => {
            const count = stats.bySentiment[sentiment]
            const percent = stats.total > 0 ? (count / stats.total) * 100 : 0
            if (percent === 0) return null
            return (
              <div
                key={sentiment}
                title={`${sentimentLabels[sentiment]}: ${count} (${Math.round(percent)}%)`}
                style={{
                  width: `${percent}%`,
                  background: sentimentColors[sentiment],
                  transition: 'width 0.3s ease',
                  minWidth: count > 0 ? '4px' : 0,
                }}
              />
            )
          })}
        </div>
        <div style={{
          display: 'flex',
          gap: '16px',
          marginTop: '10px',
          flexWrap: 'wrap',
        }}>
          {(['positive', 'neutral', 'mixed', 'negative'] as HBMentionSentiment[]).map(sentiment => {
            const count = stats.bySentiment[sentiment]
            if (count === 0) return null
            return (
              <div key={sentiment} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: sentimentColors[sentiment],
                }} />
                <span style={{
                  fontFamily: hbFonts.body,
                  fontSize: '12px',
                  color: hbColors.slateMid,
                }}>
                  {sentimentLabels[sentiment]} ({count})
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coverage Briefing */}
      {insights.length > 0 && (
        <div style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          padding: '24px',
          boxShadow: hbShadows.sm,
        }}>
          <div style={{
            fontFamily: hbFonts.body,
            fontSize: '13px',
            fontWeight: 600,
            color: hbColors.slateMid,
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Coverage Briefing
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.map((insight, i) => (
              <InsightRow key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Source Type Filter */}
      {availableSourceTypes.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <FilterPill
            label="All sources"
            count={mentions.length}
            isActive={sourceFilter === 'all'}
            onClick={() => setSourceFilter('all')}
          />
          {availableSourceTypes.map(([type, count]) => (
            <FilterPill
              key={type}
              label={sourceTypeLabels[type]}
              count={count}
              isActive={sourceFilter === type}
              onClick={() => setSourceFilter(sourceFilter === type ? 'all' : type)}
            />
          ))}
        </div>
      )}

      {/* Two-column: Positive Coverage / Coverage to Watch */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: positiveMentions.length > 0 && negativeMentions.length > 0
          ? '1fr 1fr'
          : '1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Positive Coverage */}
        {positiveMentions.length > 0 && (
          <div>
            <div style={{
              fontFamily: hbFonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: hbColors.tealDeep,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: hbColors.teal,
              }} />
              Positive coverage ({positiveMentions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {positiveMentions
                .slice(0, showAllPositive ? undefined : INITIAL_SHOW_COUNT)
                .map(m => <ClippingCard key={m.id} mention={m} />)}
            </div>
            {positiveMentions.length > INITIAL_SHOW_COUNT && (
              <button
                onClick={() => setShowAllPositive(!showAllPositive)}
                style={{
                  display: 'block',
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'none',
                  border: `1px solid ${hbColors.teal}30`,
                  borderRadius: hbRadii.md,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: hbColors.tealDeep,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {showAllPositive
                  ? 'Show less'
                  : `View all ${positiveMentions.length} clippings`}
              </button>
            )}
          </div>
        )}

        {/* Coverage to Watch (negative + mixed) */}
        {negativeMentions.length > 0 && (
          <div>
            <div style={{
              fontFamily: hbFonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: hbColors.coral,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: hbColors.coral,
              }} />
              Coverage to watch ({negativeMentions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {negativeMentions
                .slice(0, showAllNegative ? undefined : INITIAL_SHOW_COUNT)
                .map(m => <ClippingCard key={m.id} mention={m} />)}
            </div>
            {negativeMentions.length > INITIAL_SHOW_COUNT && (
              <button
                onClick={() => setShowAllNegative(!showAllNegative)}
                style={{
                  display: 'block',
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'none',
                  border: `1px solid ${hbColors.coral}30`,
                  borderRadius: hbRadii.md,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: hbColors.coral,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {showAllNegative
                  ? 'Show less'
                  : `View all ${negativeMentions.length} clippings`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* No matches for current filter */}
      {positiveMentions.length === 0 && negativeMentions.length === 0 && neutralMentions.length === 0 && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: hbColors.slateLight,
          fontFamily: hbFonts.body,
          fontSize: '14px',
        }}>
          No clippings match the current filter.
        </div>
      )}

      {/* Neutral / Background Coverage - collapsed */}
      {neutralMentions.length > 0 && (
        <div style={{
          background: hbColors.surface,
          borderRadius: hbRadii.lg,
          boxShadow: hbShadows.sm,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowNeutral(!showNeutral)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '16px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: hbFonts.body,
              fontSize: '14px',
              color: hbColors.slateMid,
              textAlign: 'left',
            }}
          >
            <span>
              <strong style={{ fontWeight: 600, color: hbColors.slate }}>{neutralMentions.length} background clippings</strong>
              {' '}from{' '}
              {(() => {
                const domains = [...new Set(neutralMentions.map(m => m.domainName).filter(Boolean))]
                if (domains.length <= 3) return domains.join(', ')
                return `${domains.slice(0, 2).join(', ')} and ${domains.length - 2} other sources`
              })()}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={hbColors.slateLight}
              strokeWidth="2"
              style={{
                flexShrink: 0,
                transform: showNeutral ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showNeutral && (
            <div style={{
              padding: '0 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {neutralMentions.map(m => <ClippingCard key={m.id} mention={m} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab Footer */}
      <HBTabFooter
        nextTab="competitors"
        nextLabel="Competitors"
        previewText={`Now see how ${companyName}'s brand compares to competitors.`}
        onNavigate={onNavigate}
      />
    </div>
  )
}

// --- Sub-components ---

function InsightRow({ insight }: { insight: HBMentionInsight }) {
  const config = insightConfig[insight.type] || insightConfig.opportunity

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: '3px',
        minHeight: '20px',
        height: '100%',
        background: config.color,
        borderRadius: '2px',
        flexShrink: 0,
        marginTop: '2px',
      }} />
      <p style={{
        fontFamily: hbFonts.body,
        fontSize: '14px',
        color: hbColors.slate,
        lineHeight: 1.5,
        margin: 0,
      }}>
        {insight.text}
      </p>
    </div>
  )
}

function FilterPill({ label, count, isActive, onClick }: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: hbRadii.full,
        border: `1px solid ${isActive ? hbColors.teal : hbColors.surfaceDim}`,
        background: isActive ? hbColors.tealLight : hbColors.surface,
        color: isActive ? hbColors.tealDeep : hbColors.slateMid,
        fontFamily: hbFonts.body,
        fontSize: '13px',
        fontWeight: isActive ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
      <span style={{ fontSize: '11px', opacity: 0.7 }}>{count}</span>
    </button>
  )
}

function ClippingCard({ mention }: { mention: HBWebMention }) {
  const accentColor = sentimentColors[mention.sentiment]
  const relativeDate = formatRelativeDate(mention.publishedDate)

  return (
    <a
      href={mention.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: '#FAFAF8',
        borderRadius: hbRadii.md,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = hbShadows.md
        e.currentTarget.style.borderColor = `${hbColors.teal}30`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {/* Top accent rule */}
      <div style={{
        height: '2px',
        background: accentColor,
      }} />

      <div style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {/* Meta row: source + type + date */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontFamily: hbFonts.mono,
              fontSize: '11px',
              fontWeight: 600,
              color: hbColors.slateMid,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}>
              {mention.domainName || 'unknown'}
            </span>
            <span style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: hbRadii.sm,
              background: hbColors.surfaceDim,
              fontFamily: hbFonts.body,
              fontSize: '10px',
              fontWeight: 500,
              color: hbColors.slateLight,
            }}>
              {sourceTypeLabels[mention.sourceType]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {mention.sentimentScore != null && (
              <span style={{
                fontFamily: hbFonts.mono,
                fontSize: '10px',
                fontWeight: 600,
                color: accentColor,
                opacity: 0.8,
              }}>
                {mention.sentimentScore}/10
              </span>
            )}
            {relativeDate && (
              <span style={{
                fontFamily: hbFonts.body,
                fontSize: '11px',
                color: hbColors.slateLight,
              }}>
                {relativeDate}
              </span>
            )}
          </div>
        </div>

        {/* Title - the main content */}
        {mention.title && (
          <div style={{
            fontFamily: hbFonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: hbColors.slate,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {mention.title}
          </div>
        )}

        {/* Snippet - key quote from the source */}
        {mention.snippet && (
          <div style={{
            fontFamily: hbFonts.body,
            fontSize: '13px',
            color: hbColors.slateMid,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            borderLeft: `2px solid ${accentColor}30`,
            paddingLeft: '10px',
            fontStyle: 'italic',
          }}>
            {mention.snippet}
          </div>
        )}

        {/* External link indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
      </div>
    </a>
  )
}
