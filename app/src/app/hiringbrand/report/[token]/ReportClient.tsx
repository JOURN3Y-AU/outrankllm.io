'use client'

/**
 * HiringBrand Report Client
 * Main orchestration component for the employer reputation report
 */

import { useState, useRef, useMemo } from 'react'
import { HBNav } from '../components/HBNav'
import type { NavBrand } from '../components/HBNav'
import { HBTabs } from '../components/HBTabs'
import { HBDownloadBar } from '../components/HBDownloadBar'
import { HBScoreRing } from '../components/HBScoreRing'
import { HBPlatformCard } from '../components/HBPlatformCard'
import { HBResponseCard } from '../components/HBResponseCard'
import { HBCompetitorList } from '../components/HBCompetitorList'
import { HBTrends } from '../components/HBTrends'
import { HBMentions } from '../components/HBMentions'
import { HBTabFooter } from '../components/HBTabFooter'
import { HBSetup } from '../components/HBSetup'
import {
  hbColors,
  hbFonts,
  hbShadows,
  hbRadii,
  hbPlatformConfig,
  hbCategoryConfig,
  hbTabs,
  getScoreColor,
} from '../components/shared/constants'
import type { HBReportData, HBTabId, HBPlatform, HBQuestionCategory, HBSentimentCategory, HBStrategicSummary, HBEffortLevel, HBImpactLevel, HBPriority, HBTrendsData } from '../components/shared/types'

interface ReportClientProps {
  data: HBReportData & { trends: HBTrendsData; navBrands: NavBrand[] }
  userRole?: 'owner' | 'admin' | 'viewer' | null
  isSuperAdmin?: boolean
}

// Sentiment filter type (4-tier: strong, positive, mixed, negative)
type SentimentFilter = HBSentimentCategory | 'all'

// Sentiment color mapping for 4-tier system
const sentimentColors: Record<HBSentimentCategory, string> = {
  strong: '#059669',    // Darker green for strong
  positive: '#4ABDAC',  // Teal for positive
  mixed: '#F7B733',     // Gold/amber for mixed
  negative: '#FC4A1A',  // Coral for negative
}

// Helper to extract and count themes from responses
function analyzeResponseThemes(responses: HBReportData['responses']) {
  // Collect all phrases by type
  const positives: string[] = []
  const negatives: string[] = []
  const competitors: string[] = []

  responses.forEach(r => {
    // Green flags and positive phrases are more specific than highlights
    positives.push(...(r.greenFlags || []))
    positives.push(...(r.sentimentPositivePhrases || []))
    negatives.push(...(r.redFlags || []))
    negatives.push(...(r.sentimentNegativePhrases || []))
    r.competitorsMentioned.forEach(c => competitors.push(c.name))
  })

  // Extract meaningful employer-related themes from phrases
  // Look for phrases containing key employer topics
  const employerKeywords = {
    compensation: ['pay', 'salary', 'compensation', 'stock', 'equity', 'bonus', 'competitive pay', 'well-paid'],
    benefits: ['benefits', 'health', 'insurance', '401k', 'perks', 'vacation', 'pto'],
    culture: ['culture', 'environment', 'collaborative', 'innovative', 'fast-paced', 'startup', 'inclusive'],
    growth: ['growth', 'career', 'learning', 'development', 'opportunities', 'advancement', 'promotion'],
    balance: ['balance', 'work-life', 'hours', 'flexibility', 'remote', 'flexible'],
    leadership: ['leadership', 'management', 'managers', 'executives', 'ceo', 'founders'],
    tech: ['technology', 'engineering', 'technical', 'cutting-edge', 'innovation', 'stack'],
    mission: ['mission', 'impact', 'meaningful', 'purpose', 'changing'],
  }

  const findThemes = (phrases: string[]) => {
    const themeCounts: Record<string, number> = {}
    const themeExamples: Record<string, string> = {}

    phrases.forEach(phrase => {
      const lower = phrase.toLowerCase()
      Object.entries(employerKeywords).forEach(([theme, keywords]) => {
        if (keywords.some(kw => lower.includes(kw))) {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1
          if (!themeExamples[theme] && phrase.length < 50) {
            themeExamples[theme] = phrase
          }
        }
      })
    })

    return Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme, count]) => ({
        theme,
        count,
        example: themeExamples[theme]
      }))
  }

  // Get top 3 short, specific phrases directly (fallback)
  const getTopPhrases = (phrases: string[]) => {
    // Filter to short, specific phrases
    return phrases
      .filter(p => p.length >= 10 && p.length <= 60)
      .slice(0, 3)
  }

  // Count competitor mentions
  const competitorCounts: Record<string, number> = {}
  competitors.forEach(c => {
    competitorCounts[c] = (competitorCounts[c] || 0) + 1
  })
  const topCompetitor = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])[0]

  return {
    positiveThemes: findThemes(positives),
    negativeThemes: findThemes(negatives),
    topPositivePhrases: getTopPhrases(positives),
    topNegativePhrases: getTopPhrases(negatives),
    topCompetitor: topCompetitor ? topCompetitor[0] : null,
    totalPositives: positives.length,
    totalNegatives: negatives.length,
  }
}

// Generate dynamic summary from response analysis
function generateDynamicSummary(
  company: HBReportData['company'],
  report: HBReportData['report'],
  responses: HBReportData['responses'],
  sentimentCounts: HBReportData['sentimentCounts']
) {
  const analysis = analyzeResponseThemes(responses)
  const total = responses.length
  const favorable = sentimentCounts.strong + sentimentCounts.positive
  const favorablePct = Math.round((favorable / total) * 100)

  // Determine overall tone
  let tone: 'positive' | 'mixed' | 'negative'
  if (favorablePct >= 60) tone = 'positive'
  else if (favorablePct >= 40) tone = 'mixed'
  else tone = 'negative'

  // Build the summary
  const parts: string[] = []

  // Opening line based on tone
  if (tone === 'positive') {
    parts.push(`AI assistants generally describe ${company.name} favorably to job seekers.`)
  } else if (tone === 'mixed') {
    parts.push(`AI assistants present a nuanced view of ${company.name}, highlighting both strengths and areas of concern.`)
  } else {
    parts.push(`AI assistants flag several concerns when job seekers ask about ${company.name}.`)
  }

  // Key strengths from themes
  if (analysis.positiveThemes.length > 0) {
    const themes = analysis.positiveThemes
    const themeLabels: Record<string, string> = {
      compensation: 'competitive compensation',
      benefits: 'strong benefits',
      culture: 'company culture',
      growth: 'career growth opportunities',
      balance: 'work-life balance',
      leadership: 'leadership quality',
      tech: 'technical environment',
      mission: 'meaningful mission',
    }
    const labels = themes.map(t => themeLabels[t.theme] || t.theme)
    if (labels.length === 1) {
      parts.push(`Responses consistently praise ${labels[0]}.`)
    } else if (labels.length === 2) {
      parts.push(`Key strengths include ${labels[0]} and ${labels[1]}.`)
    } else {
      parts.push(`Key strengths include ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}.`)
    }
  } else if (analysis.topPositivePhrases.length > 0) {
    // Fallback to showing a direct quote
    parts.push(`AI frequently mentions: "${analysis.topPositivePhrases[0]}".`)
  }

  // Key concerns from themes
  if (analysis.negativeThemes.length > 0) {
    const themes = analysis.negativeThemes
    const themeLabels: Record<string, string> = {
      compensation: 'compensation concerns',
      benefits: 'benefits',
      culture: 'workplace culture',
      growth: 'growth opportunities',
      balance: 'work-life balance challenges',
      leadership: 'management issues',
      tech: 'technical environment',
      mission: 'company direction',
    }
    const labels = themes.map(t => themeLabels[t.theme] || t.theme)
    if (labels.length === 1) {
      parts.push(`Some responses raise ${labels[0]} as a concern.`)
    } else {
      parts.push(`Areas to address include ${labels.slice(0, 2).join(' and ')}.`)
    }
  } else if (analysis.topNegativePhrases.length > 0 && analysis.totalNegatives >= 3) {
    // Only show if there are meaningful negative mentions
    parts.push(`Some responses note: "${analysis.topNegativePhrases[0]}".`)
  }

  // Topic gaps - actionable insight
  if (report.topicsMissing && report.topicsMissing.length > 0) {
    const missing = report.topicsMissing.slice(0, 2).map(t => t.replace(/_/g, ' '))
    parts.push(`Consider adding content about ${missing.join(' and ')} to improve AI knowledge.`)
  }

  // Competitor context (only if insightful)
  if (analysis.topCompetitor && analysis.topCompetitor !== company.name) {
    parts.push(`AI frequently compares you to ${analysis.topCompetitor}.`)
  }

  return parts.join(' ')
}

export function ReportClient({ data, userRole = null, isSuperAdmin = false }: ReportClientProps) {
  const [activeTab, setActiveTab] = useState<HBTabId>('start')
  const canSetup = userRole === 'owner' || userRole === 'admin'
  const visibleTabs = useMemo(() => canSetup ? hbTabs : hbTabs.filter(t => t.id !== 'setup'), [canSetup])
  const [platformFilter, setPlatformFilter] = useState<HBPlatform | 'all'>('all')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [showMethodology, setShowMethodology] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<HBQuestionCategory | 'all'>('all')
  const tabContentRef = useRef<HTMLDivElement>(null)

  const { report, company, organization, navBrands: initialNavBrands, responses, prompts, sentimentCounts } = data
  const [navBrands, setNavBrands] = useState(initialNavBrands)

  const reportUrl = typeof window !== 'undefined' ? window.location.href : ''

  // Generate dynamic summary from actual response data
  const dynamicSummary = generateDynamicSummary(company, report, responses, sentimentCounts)

  // Calculate mention counts per platform
  const platformMentions = (Object.keys(hbPlatformConfig) as HBPlatform[]).reduce(
    (acc, platform) => {
      const platformResponses = responses.filter((r) => r.platform === platform)
      acc[platform] = {
        mentioned: platformResponses.filter((r) => r.domainMentioned).length,
        total: platformResponses.length,
      }
      return acc
    },
    {} as Record<HBPlatform, { mentioned: number; total: number }>
  )

  // Get platform-filtered responses (before sentiment filter)
  const platformFilteredResponses = responses.filter((r) =>
    platformFilter === 'all' || r.platform === platformFilter
  )

  // Calculate dynamic sentiment counts based on platform filter
  const dynamicSentimentCounts = {
    strong: platformFilteredResponses.filter((r) => r.sentimentCategory === 'strong').length,
    positive: platformFilteredResponses.filter((r) => r.sentimentCategory === 'positive').length,
    mixed: platformFilteredResponses.filter((r) => r.sentimentCategory === 'mixed').length,
    negative: platformFilteredResponses.filter((r) => r.sentimentCategory === 'negative').length,
  }

  // Filter responses by platform AND sentiment AND category
  const filteredResponses = platformFilteredResponses.filter((r) =>
    (sentimentFilter === 'all' || r.sentimentCategory === sentimentFilter) &&
    (categoryFilter === 'all' || r.promptCategory === categoryFilter)
  )

  // Clipboard text generators per tab
  const clipboardText = useMemo(() => {
    const footer = `\n\n---\nGenerated by HiringBrand.io${reportUrl ? `\n${reportUrl}` : ''}`

    const texts: Record<HBTabId, string> = {
      start: [
        `${company.name} — HiringBrand Report`,
        ``,
        `This report shows how AI assistants describe ${company.name} to job seekers.`,
        `We queried ${Object.keys(hbPlatformConfig).length} AI platforms (${Object.values(hbPlatformConfig).map(p => p.name).join(', ')}) with ${prompts.length} questions about employer reputation, culture, compensation, and more.`,
        ``,
        report.competitorAnalysis ? `Competitors researched: ${report.competitorAnalysis.employers.filter(e => !e.isTarget).map(e => e.name).join(', ')}` : null,
        footer,
      ].filter(Boolean).join('\n'),

      overview: [
        `${company.name} — Employer Brand Summary`,
        ``,
        `Desirability: ${report.visibilityScore}/100`,
        report.researchabilityScore !== null ? `Awareness: ${report.researchabilityScore}/100` : null,
        report.differentiationScore !== null ? `Differentiation: ${report.differentiationScore}/100` : null,
        ``,
        dynamicSummary,
        ``,
        `Sentiment Breakdown:`,
        `  Strong: ${sentimentCounts.strong}`,
        `  Positive: ${sentimentCounts.positive}`,
        `  Mixed: ${sentimentCounts.mixed}`,
        `  Negative: ${sentimentCounts.negative}`,
        footer,
      ].filter(Boolean).join('\n'),

      responses: [
        `${company.name} — AI Responses Summary`,
        ``,
        `${responses.length} responses across ${Object.keys(hbPlatformConfig).length} AI platforms`,
        ``,
        `Sentiment Breakdown:`,
        `  Strong: ${sentimentCounts.strong}`,
        `  Positive: ${sentimentCounts.positive}`,
        `  Mixed: ${sentimentCounts.mixed}`,
        `  Negative: ${sentimentCounts.negative}`,
        ``,
        `Topics covered: ${report.topicsCovered.join(', ')}`,
        report.topicsMissing.length > 0 ? `Topics missing: ${report.topicsMissing.join(', ')}` : null,
        footer,
      ].filter(Boolean).join('\n'),

      clippings: [
        `${company.name} — Employer Brand Clippings`,
        ``,
        ...(report.mentionStats ? [
          `Total clippings: ${report.mentionStats.total}`,
          `Positive: ${report.mentionStats.bySentiment.positive}, Negative: ${report.mentionStats.bySentiment.negative}`,
          `Avg sentiment: ${report.mentionStats.avgSentimentScore}/10`,
          ``,
          ...(report.mentionStats.insights?.map(i => `• [${i.type}] ${i.text}`) || []),
          ``,
          `Top sources: ${report.mentionStats.topDomains.slice(0, 5).map(d => d.domain).join(', ')}`,
          ``,
          `Key clippings:`,
          ...data.mentions.slice(0, 10).map((m, i) => `${i + 1}. [${m.sentiment}] ${m.title || m.url} (${m.domainName})`),
        ] : ['No web clippings data available.']),
        footer,
      ].join('\n'),

      competitors: [
        `${company.name} — Competitor Analysis`,
        ``,
        ...(report.competitorAnalysis ? [
          `Employers analyzed: ${report.competitorAnalysis.employers.map(e => e.name).join(', ')}`,
          ``,
          `Dimension Scores (0-10):`,
          ...report.competitorAnalysis.employers.map(e =>
            `  ${e.name}: ${Object.entries(e.scores).map(([d, s]) => `${d}: ${s}`).join(', ')}`
          ),
          ``,
          `Strengths: ${report.competitorAnalysis.insights.strengths.join(', ')}`,
          `Weaknesses: ${report.competitorAnalysis.insights.weaknesses.join(', ')}`,
        ] : ['No competitor analysis available.']),
        footer,
      ].join('\n'),

      trends: [
        `${company.name} — Trends Overview`,
        ``,
        `Current Scores:`,
        `  Desirability: ${report.visibilityScore}/100`,
        report.researchabilityScore !== null ? `  Awareness: ${report.researchabilityScore}/100` : null,
        report.differentiationScore !== null ? `  Differentiation: ${report.differentiationScore}/100` : null,
        ``,
        `Track changes over time with weekly scans.`,
        footer,
      ].filter(Boolean).join('\n'),

      actions: [
        `${company.name} — Action Plan`,
        ``,
        ...(report.strategicSummary ? [
          report.strategicSummary.executiveSummary,
          ``,
          `Your 90-Day Plan:`,
          ``,
          ...report.strategicSummary.recommendations
            .filter(r => r.priority === 'immediate')
            .map((r, i) => `This Week #${i + 1}: ${r.title} — ${r.description}`),
          ``,
          ...report.strategicSummary.recommendations
            .filter(r => r.priority === 'short_term')
            .map((r, i) => `This Month #${i + 1}: ${r.title} — ${r.description}`),
          ``,
          ...report.strategicSummary.recommendations
            .filter(r => r.priority === 'long_term')
            .map((r, i) => `This Quarter #${i + 1}: ${r.title} — ${r.description}`),
        ] : ['No action plan available yet.']),
        footer,
      ].join('\n'),

      setup: [
        `${company.name} — Setup`,
        ``,
        `Configure scan questions and competitors for your next employer brand scan.`,
        footer,
      ].join('\n'),
    }

    return texts
  }, [company.name, report, data.mentions, responses.length, sentimentCounts, dynamicSummary, reportUrl, prompts.length])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: hbColors.surfaceDim,
        fontFamily: hbFonts.body,
      }}
    >
      {/* Navigation */}
      <HBNav
        organizationName={organization?.name || 'Account'}
        brands={navBrands}
        currentReportToken={report.urlToken}
      />
      {isSuperAdmin && (
        <div style={{
          background: `${hbColors.coral}12`,
          borderBottom: `2px solid ${hbColors.coral}`,
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: hbFonts.body,
          fontSize: '13px',
          color: hbColors.coral,
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            background: hbColors.coral,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '100px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
          }}>
            Admin View
          </span>
          Viewing as super admin &mdash; {organization?.name}
        </div>
      )}

      {/* Report Header */}
      <header
        style={{
          background: hbColors.surface,
          padding: '32px 32px 24px',
          borderBottom: `1px solid ${hbColors.surfaceDim}`,
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          {/* Company logo placeholder */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: hbRadii.xl,
              background: `linear-gradient(135deg, ${hbColors.teal}, ${hbColors.tealDeep})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontFamily: hbFonts.display,
              fontWeight: 700,
              fontSize: '28px',
              boxShadow: hbShadows.tealLg,
              flexShrink: 0,
            }}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>

          {/* Company details */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1
              style={{
                fontFamily: hbFonts.display,
                fontSize: '32px',
                fontWeight: 700,
                color: hbColors.slate,
                letterSpacing: '-0.2px',
                lineHeight: 1.2,
                marginBottom: '8px',
              }}
            >
              {company.name}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                color: hbColors.slateLight,
                fontSize: '14px',
                flexWrap: 'wrap',
              }}
            >
              <span>{company.domain}</span>
              {company.industry && (
                <>
                  <span style={{ opacity: 0.5 }}>|</span>
                  <span>{company.industry}</span>
                </>
              )}
              {company.location && (
                <>
                  <span style={{ opacity: 0.5 }}>|</span>
                  <span>{company.location}</span>
                </>
              )}
            </div>
          </div>

          {/* Scan status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: hbColors.tealLight,
              borderRadius: hbRadii.full,
              fontSize: '12px',
              fontWeight: 500,
              color: hbColors.tealDeep,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                background: hbColors.teal,
                borderRadius: '50%',
              }}
            />
            Scanned {new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <HBTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={visibleTabs} />

      {/* Content */}
      <main
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '32px',
        }}
      >
        <HBDownloadBar
          activeTab={activeTab}
          clipboardText={clipboardText[activeTab]}
          tabContentRef={tabContentRef}
          companyName={company.name}
        />
        <div ref={tabContentRef}>
        {/* Start Here Tab */}
        {activeTab === 'start' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Welcome header */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '22px', fontWeight: 700, color: hbColors.slate, margin: '0 0 12px 0' }}>
                Welcome to your Employer Brand Report
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.7, margin: 0 }}>
                When candidates research {company.name}, many now turn to AI assistants instead of traditional search engines.
                This report shows you exactly what those AI tools are telling people about working at your company — and what you can do to improve it.
              </p>
            </div>

            {/* What we did */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.xl,
                padding: '28px',
                boxShadow: hbShadows.sm,
              }}
            >
              <h3 style={{ fontFamily: hbFonts.display, fontSize: '18px', fontWeight: 600, color: hbColors.slate, margin: '0 0 16px 0' }}>
                How this report was created
              </h3>
              <p style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid, lineHeight: 1.7, margin: '0 0 20px 0' }}>
                We designed {prompts.length} questions based on the topics job seekers most commonly ask AI about employers — things like compensation, culture, career growth, leadership, and work-life balance. These questions are modelled on real candidate behaviour and cover {Object.keys(hbCategoryConfig).length} key categories that influence hiring decisions. We then asked each question to {Object.keys(hbPlatformConfig).length} leading AI platforms — the same tools your candidates use every day — and analysed every response for tone, accuracy, and how you compare to competitors.
              </p>

              {/* Platforms queried */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.slate, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AI platforms queried
                </h4>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {(Object.keys(hbPlatformConfig) as HBPlatform[]).map((platform) => {
                    const config = hbPlatformConfig[platform]
                    const platformResponses = responses.filter(r => r.platform === platform)
                    return (
                      <div
                        key={platform}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 16px',
                          background: hbColors.surfaceRaised,
                          borderRadius: hbRadii.lg,
                          border: `1px solid ${hbColors.surfaceDim}`,
                        }}
                      >
                        <img
                          src={config.iconPath}
                          alt={config.name}
                          width={config.iconSize.width}
                          height={config.iconSize.height}
                          style={{ borderRadius: '4px' }}
                        />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: hbColors.slate }}>{config.name}</div>
                          <div style={{ fontSize: '12px', color: hbColors.slateLight }}>{platformResponses.length} responses</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Questions asked */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.slate, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Questions we asked ({prompts.length} total)
                </h4>
                <p style={{ fontFamily: hbFonts.body, fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.6, margin: '0 0 8px 0' }}>
                  We asked questions across {Object.keys(hbCategoryConfig).length} categories that matter most to job seekers — from compensation and culture to leadership and career growth.
                </p>
                <p style={{ fontFamily: hbFonts.body, fontSize: '12px', color: canSetup ? hbColors.tealDeep : hbColors.slateLight, lineHeight: 1.5, margin: '0 0 12px 0', fontStyle: 'italic' }}>
                  {canSetup ? (
                    <>
                      You can add, edit, or remove questions on the{' '}
                      <button
                        onClick={() => setActiveTab('setup')}
                        style={{ background: 'none', border: 'none', padding: 0, color: hbColors.tealDeep, fontWeight: 600, cursor: 'pointer', fontFamily: hbFonts.body, fontSize: '12px', fontStyle: 'italic', textDecoration: 'underline' }}
                      >
                        Setup tab
                      </button>
                      . Changes take effect on your next scan.
                    </>
                  ) : (
                    'Account administrators can customise which questions are asked in future scans.'
                  )}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Group by category */}
                  {(Object.keys(hbCategoryConfig) as HBQuestionCategory[]).map((cat) => {
                    const catConfig = hbCategoryConfig[cat]
                    const catPrompts = prompts.filter(p => p.category === cat)
                    if (catPrompts.length === 0) return null
                    return (
                      <div key={cat}>
                        <button
                          onClick={() => {
                            const el = document.getElementById(`start-cat-${cat}`)
                            if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            background: hbColors.surfaceRaised,
                            border: `1px solid ${hbColors.surfaceDim}`,
                            borderRadius: hbRadii.md,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: catConfig.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontFamily: hbFonts.body, fontSize: '13px', fontWeight: 600, color: hbColors.slate, flex: 1 }}>
                            {catConfig.label}
                          </span>
                          <span style={{ fontSize: '12px', color: hbColors.slateLight }}>
                            {catPrompts.length} question{catPrompts.length !== 1 ? 's' : ''}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="2" style={{ flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        <div id={`start-cat-${cat}`} style={{ display: 'none', paddingLeft: '20px', paddingTop: '4px' }}>
                          {catPrompts.map((p, i) => (
                            <div key={i} style={{ fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.6, padding: '4px 0', borderBottom: i < catPrompts.length - 1 ? `1px solid ${hbColors.surfaceDim}` : 'none' }}>
                              "{p.promptText}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Competitors researched */}
              {report.competitorAnalysis && (
                <div>
                  <h4 style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.slate, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Competitors researched
                  </h4>
                  <p style={{ fontFamily: hbFonts.body, fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.6, margin: '0 0 8px 0' }}>
                    We identified these competitors by analysing which employers AI platforms most frequently mention alongside {company.name} when candidates ask about jobs in your industry and location. These are the companies AI sees as your closest talent competitors — the employers candidates are comparing you to. We then scored each on {report.competitorAnalysis.dimensions.length} key dimensions to show where you lead and where you lag.
                  </p>
                  <p style={{ fontFamily: hbFonts.body, fontSize: '12px', color: canSetup ? hbColors.tealDeep : hbColors.slateLight, lineHeight: 1.5, margin: '0 0 12px 0', fontStyle: 'italic' }}>
                    {canSetup ? (
                      <>
                        You can add, edit, or remove competitors on the{' '}
                        <button
                          onClick={() => setActiveTab('setup')}
                          style={{ background: 'none', border: 'none', padding: 0, color: hbColors.tealDeep, fontWeight: 600, cursor: 'pointer', fontFamily: hbFonts.body, fontSize: '12px', fontStyle: 'italic', textDecoration: 'underline' }}
                        >
                          Setup tab
                        </button>
                        . Changes take effect on your next scan.
                      </>
                    ) : (
                      'Account administrators can customise which competitors are tracked in future scans.'
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {report.competitorAnalysis.employers
                      .filter(e => !e.isTarget)
                      .map((employer, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 16px',
                            background: hbColors.surfaceRaised,
                            borderRadius: hbRadii.full,
                            border: `1px solid ${hbColors.surfaceDim}`,
                            fontSize: '14px',
                            fontWeight: 500,
                            color: hbColors.slate,
                          }}
                        >
                          {employer.name}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* What you'll learn */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.xl,
                padding: '28px',
                boxShadow: hbShadows.sm,
              }}
            >
              <h3 style={{ fontFamily: hbFonts.display, fontSize: '18px', fontWeight: 600, color: hbColors.slate, margin: '0 0 20px 0' }}>
                What you'll find in this report
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  {
                    icon: '📊',
                    title: 'Summary',
                    desc: 'Three headline scores that show how desirable, well-known, and distinctive your employer brand appears to AI. This is your at-a-glance health check.',
                  },
                  {
                    icon: '💬',
                    title: 'AI Responses',
                    desc: 'Read the exact words AI uses when candidates ask about you. See which responses are positive, mixed, or negative — and what specific phrases are shaping perception.',
                  },
                  {
                    icon: '👥',
                    title: 'Competitors',
                    desc: 'A side-by-side comparison on key employer dimensions like culture, compensation, and growth. See where you lead and where competitors have the edge.',
                  },
                  {
                    icon: '📈',
                    title: 'Trends',
                    desc: 'Track how your scores change over time. Each new scan adds a data point so you can measure whether your employer branding efforts are working.',
                  },
                  {
                    icon: '🎯',
                    title: 'Action Plan',
                    desc: 'A prioritised 90-day plan of specific actions — from quick wins you can do this week to strategic initiatives that build lasting brand advantage.',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      background: hbColors.surfaceRaised,
                      borderRadius: hbRadii.lg,
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <h4 style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.slate, margin: '0 0 4px 0' }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What you can do with it */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.xl,
                padding: '28px',
                boxShadow: hbShadows.sm,
              }}
            >
              <h3 style={{ fontFamily: hbFonts.display, fontSize: '18px', fontWeight: 600, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Actions you can take after reading this report
              </h3>
              <p style={{ fontFamily: hbFonts.body, fontSize: '14px', color: hbColors.slateMid, lineHeight: 1.7, margin: '0 0 20px 0' }}>
                This report isn't just data — it's a playbook. Here are some of the things teams commonly do after reviewing their results:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { action: 'Create or update your careers page', detail: 'Fill in the topics AI doesn\'t know about — like compensation philosophy, remote policy, or growth paths — so AI can learn from your content.' },
                  { action: 'Publish employee stories and blog posts', detail: 'AI assistants pull from publicly available content. The more specific, credible information about your culture and values that exists online, the better AI can represent you.' },
                  { action: 'Update your company profiles', detail: 'Sites like Glassdoor, LinkedIn, and Indeed feed into AI training data. Make sure these profiles are current and reflect your real employer brand.' },
                  { action: 'Address negative perceptions head-on', detail: 'If AI is flagging concerns (like work-life balance or management), create content that honestly addresses these topics. Transparency builds trust.' },
                  { action: 'Brief your leadership team', detail: 'Use the copy and export features on each tab to share findings with your CEO or hiring managers. The Action Plan tab gives you a ready-made 90-day roadmap.' },
                  { action: 'Re-scan regularly to track progress', detail: 'Each scan creates a new data point on the Trends tab. Running monthly scans lets you measure the impact of your employer branding work.' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '12px 16px',
                      background: hbColors.surfaceRaised,
                      borderRadius: hbRadii.lg,
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: hbColors.tealLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: hbColors.tealDeep,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <h4 style={{ fontFamily: hbFonts.display, fontSize: '14px', fontWeight: 600, color: hbColors.slate, margin: '0 0 2px 0' }}>
                        {item.action}
                      </h4>
                      <p style={{ fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.5, margin: 0 }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab footer → Summary */}
            <HBTabFooter
              nextTab="overview"
              nextLabel="Summary"
              previewText={`See your three headline scores and how AI describes ${company.name} at a glance.`}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Tab description */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '20px', fontWeight: 700, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Here's where you stand
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                Your employer brand health at a glance. Three headline scores show how desirable, well-known, and distinctive {company.name} appears to AI assistants. Look for any score below 60 — that's where candidates are getting a weak impression.
              </p>
            </div>

            {/* Three Score Cards - First */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
              }}
            >
              {/* Desirability Score */}
              <div
                style={{
                  background: hbColors.surface,
                  borderRadius: hbRadii.xl,
                  padding: '32px',
                  boxShadow: hbShadows.sm,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <HBScoreRing
                  score={report.visibilityScore}
                  size="md"
                  label="Desirability"
                  showLabel={false}
                />
                <h3
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: hbColors.slate,
                    marginTop: '16px',
                    marginBottom: '4px',
                  }}
                >
                  Desirability
                </h3>
                <p
                  style={{
                    fontFamily: hbFonts.body,
                    fontSize: '13px',
                    color: hbColors.slateLight,
                    textAlign: 'center',
                    margin: '0 0 4px 0',
                  }}
                >
                  How positively AI describes you
                </p>
                {report.strategicSummary && (
                  <p
                    style={{
                      fontFamily: hbFonts.body,
                      fontSize: '13px',
                      color: hbColors.slateMid,
                      textAlign: 'left',
                      margin: '8px 0 0 0',
                      lineHeight: 1.4,
                      alignSelf: 'stretch',
                    }}
                  >
                    {report.strategicSummary.scoreInterpretation.desirability}
                  </p>
                )}
                <button
                  onClick={() => { setSentimentFilter('all'); setPlatformFilter('all'); setActiveTab('responses') }}
                  style={{
                    marginTop: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: hbFonts.body,
                    fontSize: '12px',
                    color: getScoreColor(report.visibilityScore),
                    fontWeight: 500,
                  }}
                >
                  See AI responses →
                </button>
              </div>

              {/* AI Awareness Score */}
              <div
                style={{
                  background: hbColors.surface,
                  borderRadius: hbRadii.xl,
                  padding: '32px',
                  boxShadow: hbShadows.sm,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <HBScoreRing
                  score={report.researchabilityScore ?? 50}
                  size="md"
                  label="AI Awareness"
                  showLabel={false}
                />
                <h3
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: hbColors.slate,
                    marginTop: '16px',
                    marginBottom: '4px',
                  }}
                >
                  AI Awareness
                </h3>
                <p
                  style={{
                    fontFamily: hbFonts.body,
                    fontSize: '13px',
                    color: hbColors.slateLight,
                    textAlign: 'center',
                    margin: '0 0 4px 0',
                  }}
                >
                  How much AI knows about you
                </p>
                {report.strategicSummary && (
                  <p
                    style={{
                      fontFamily: hbFonts.body,
                      fontSize: '13px',
                      color: hbColors.slateMid,
                      textAlign: 'left',
                      margin: '8px 0 0 0',
                      lineHeight: 1.4,
                      alignSelf: 'stretch',
                    }}
                  >
                    {report.strategicSummary.scoreInterpretation.awareness}
                  </p>
                )}
                <button
                  onClick={() => setActiveTab('responses')}
                  style={{
                    marginTop: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: hbFonts.body,
                    fontSize: '12px',
                    color: getScoreColor(report.researchabilityScore ?? 50),
                    fontWeight: 500,
                  }}
                >
                  See AI responses →
                </button>
              </div>

              {/* Differentiation Score */}
              <div
                style={{
                  background: hbColors.surface,
                  borderRadius: hbRadii.xl,
                  padding: '32px',
                  boxShadow: hbShadows.sm,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <HBScoreRing
                  score={report.differentiationScore ?? 50}
                  size="md"
                  label="Differentiation"
                  showLabel={false}
                />
                <h3
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: hbColors.slate,
                    marginTop: '16px',
                    marginBottom: '4px',
                  }}
                >
                  Differentiation
                </h3>
                <p
                  style={{
                    fontFamily: hbFonts.body,
                    fontSize: '13px',
                    color: hbColors.slateLight,
                    textAlign: 'center',
                    margin: '0 0 4px 0',
                  }}
                >
                  How unique your brand appears
                </p>
                {report.strategicSummary && (
                  <p
                    style={{
                      fontFamily: hbFonts.body,
                      fontSize: '13px',
                      color: hbColors.slateMid,
                      textAlign: 'left',
                      margin: '8px 0 0 0',
                      lineHeight: 1.4,
                      alignSelf: 'stretch',
                    }}
                  >
                    {report.strategicSummary.scoreInterpretation.differentiation}
                  </p>
                )}
                <button
                  onClick={() => setActiveTab('competitors')}
                  style={{
                    marginTop: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: hbFonts.body,
                    fontSize: '12px',
                    color: getScoreColor(report.differentiationScore ?? 50),
                    fontWeight: 500,
                  }}
                >
                  See competitors →
                </button>
              </div>
            </div>

            {/* How Scores Connect - Explainer */}
            <div
              style={{
                background: hbColors.surfaceRaised,
                borderRadius: hbRadii.lg,
                padding: '16px 20px',
                borderLeft: `3px solid ${hbColors.teal}`,
              }}
            >
              <p
                style={{
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  color: hbColors.slateMid,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                <strong style={{ color: hbColors.slate }}>How your scores work:</strong>{' '}
                Your three headline scores measure{' '}
                <em>how positively AI describes you</em> (Desirability),{' '}
                <em>how much AI knows about you</em> (Awareness), and{' '}
                <em>how uniquely AI positions you</em> (Differentiation).
                These are shaped by 7 employer dimensions — compensation, culture, growth, work-life balance, leadership, technology, and mission — which you can explore on the{' '}
                <button
                  onClick={() => setActiveTab('competitors')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: hbColors.teal,
                    fontWeight: 600,
                    fontFamily: hbFonts.body,
                    fontSize: '13px',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Competitors tab
                </button>.
              </p>
            </div>

            {/* Sentiment Analysis Card */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.lg,
                padding: '24px',
                boxShadow: hbShadows.sm,
              }}
            >
              {/* Section header */}
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '18px',
                    fontWeight: 600,
                    color: hbColors.slate,
                    marginBottom: '8px',
                  }}
                >
                  Response Sentiment Distribution
                </h3>
                <p style={{ fontSize: '14px', color: hbColors.slateMid, margin: 0, lineHeight: 1.5 }}>
                  We asked {responses.length} questions about {company.name} across {Object.keys(hbPlatformConfig).length} AI platforms and scored each response for tone and accuracy. The bar below shows how those responses break down — more green means AI is actively recommending you to job seekers.
                </p>
              </div>

              {/* Stacked Sentiment Bar - the main visualization */}
              {(() => {
                const total = responses.length
                const negPct = (sentimentCounts.negative / total) * 100
                const mixPct = (sentimentCounts.mixed / total) * 100
                const posPct = (sentimentCounts.positive / total) * 100
                const strPct = (sentimentCounts.strong / total) * 100

                return (
                  <div style={{ marginBottom: '20px' }}>
                    {/* The bar */}
                    <div
                      style={{
                        display: 'flex',
                        height: '32px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: hbColors.surfaceDim,
                      }}
                    >
                      {sentimentCounts.negative > 0 && (
                        <div
                          style={{
                            width: `${negPct}%`,
                            minWidth: negPct > 0 ? '24px' : 0,
                            background: `linear-gradient(135deg, ${sentimentColors.negative}, #B91C1C)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'width 0.5s ease',
                          }}
                          title={`Negative: ${sentimentCounts.negative} responses (${Math.round(negPct)}%)`}
                        >
                          <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                            {sentimentCounts.negative}
                          </span>
                        </div>
                      )}
                      {sentimentCounts.mixed > 0 && (
                        <div
                          style={{
                            width: `${mixPct}%`,
                            minWidth: mixPct > 0 ? '24px' : 0,
                            background: `linear-gradient(135deg, ${sentimentColors.mixed}, #D97706)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'width 0.5s ease',
                          }}
                          title={`Mixed: ${sentimentCounts.mixed} responses (${Math.round(mixPct)}%)`}
                        >
                          <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                            {sentimentCounts.mixed}
                          </span>
                        </div>
                      )}
                      {sentimentCounts.positive > 0 && (
                        <div
                          style={{
                            width: `${posPct}%`,
                            minWidth: posPct > 0 ? '24px' : 0,
                            background: `linear-gradient(135deg, ${sentimentColors.positive}, #0D9488)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'width 0.5s ease',
                          }}
                          title={`Positive: ${sentimentCounts.positive} responses (${Math.round(posPct)}%)`}
                        >
                          <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                            {sentimentCounts.positive}
                          </span>
                        </div>
                      )}
                      {sentimentCounts.strong > 0 && (
                        <div
                          style={{
                            width: `${strPct}%`,
                            minWidth: strPct > 0 ? '24px' : 0,
                            background: `linear-gradient(135deg, ${sentimentColors.strong}, #047857)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'width 0.5s ease',
                          }}
                          title={`Strong: ${sentimentCounts.strong} responses (${Math.round(strPct)}%)`}
                        >
                          <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                            {sentimentCounts.strong}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Legend below bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {sentimentCounts.negative > 0 && (
                          <button
                            onClick={() => { setSentimentFilter('negative'); setActiveTab('responses') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: sentimentColors.negative }} />
                            <span style={{ color: hbColors.slateMid, textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}>
                              <strong style={{ color: sentimentColors.negative }}>{sentimentCounts.negative}</strong> Negative
                            </span>
                          </button>
                        )}
                        {sentimentCounts.mixed > 0 && (
                          <button
                            onClick={() => { setSentimentFilter('mixed'); setActiveTab('responses') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: sentimentColors.mixed }} />
                            <span style={{ color: hbColors.slateMid }}>
                              <strong style={{ color: '#92400E' }}>{sentimentCounts.mixed}</strong> Mixed
                            </span>
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {sentimentCounts.positive > 0 && (
                          <button
                            onClick={() => { setSentimentFilter('positive'); setActiveTab('responses') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: sentimentColors.positive }} />
                            <span style={{ color: hbColors.slateMid }}>
                              <strong style={{ color: sentimentColors.positive }}>{sentimentCounts.positive}</strong> Positive
                            </span>
                          </button>
                        )}
                        {sentimentCounts.strong > 0 && (
                          <button
                            onClick={() => { setSentimentFilter('strong'); setActiveTab('responses') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: sentimentColors.strong }} />
                            <span style={{ color: hbColors.slateMid }}>
                              <strong style={{ color: sentimentColors.strong }}>{sentimentCounts.strong}</strong> Strong
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* What questions did we ask AI? - Collapsible */}
            <div
              style={{
                background: hbColors.surfaceRaised,
                borderRadius: hbRadii.lg,
                border: `1px solid ${hbColors.surfaceDim}`,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: hbFonts.body,
                    fontSize: '14px',
                    fontWeight: 600,
                    color: hbColors.slateMid,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hbColors.slateLight} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  What questions did we ask AI?
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={hbColors.slateLight}
                  strokeWidth="2"
                  style={{
                    transform: showMethodology ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showMethodology && (
                <div style={{ padding: '0 20px 20px' }}>
                  <p
                    style={{
                      fontFamily: hbFonts.body,
                      fontSize: '13px',
                      color: hbColors.slateMid,
                      lineHeight: 1.6,
                      marginBottom: '16px',
                    }}
                  >
                    We asked {prompts.length} employer reputation questions across 4 AI platforms
                    (ChatGPT, Claude, Gemini, Perplexity) and analyzed each response for sentiment,
                    topic coverage, and competitive positioning. Here are the exact questions asked:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prompts.map((prompt, index) => {
                      const categoryConfig = hbCategoryConfig[prompt.category as HBQuestionCategory] || {
                        label: 'Other',
                        color: hbColors.slateLight,
                      }
                      return (
                        <div
                          key={prompt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 14px',
                            background: hbColors.surface,
                            borderRadius: hbRadii.md,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: hbFonts.mono,
                              fontSize: '11px',
                              fontWeight: 600,
                              color: hbColors.tealDeep,
                              width: '20px',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </span>
                          <span
                            style={{
                              fontFamily: hbFonts.body,
                              fontSize: '13px',
                              color: hbColors.slate,
                              flex: 1,
                            }}
                          >
                            {prompt.promptText}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              background: `${categoryConfig.color}15`,
                              color: categoryConfig.color,
                              borderRadius: hbRadii.full,
                              fontSize: '10px',
                              fontWeight: 600,
                              fontFamily: hbFonts.body,
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {categoryConfig.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Topic Knowledge - What AI knows with confidence levels */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.lg,
                padding: '24px',
                boxShadow: hbShadows.sm,
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3
                    style={{
                      fontFamily: hbFonts.display,
                      fontSize: '18px',
                      fontWeight: 600,
                      color: hbColors.slate,
                    }}
                  >
                    Employer Topics Coverage
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: hbColors.teal }} />
                    <span style={{ color: hbColors.slateLight }}>Strong</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: hbColors.gold }} />
                    <span style={{ color: hbColors.slateLight }}>Basic</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: hbColors.surfaceDim, border: `1px dashed ${hbColors.slateLight}` }} />
                    <span style={{ color: hbColors.slateLight }}>Missing</span>
                  </div>
                </div>
                </div>
                <p style={{ fontSize: '14px', color: hbColors.slateMid, margin: 0, lineHeight: 1.5 }}>
                  Each topic below represents an employer attribute that job seekers commonly ask AI about. We analysed every AI response to determine which topics are covered in detail, mentioned briefly, or missing entirely — gaps here mean candidates aren't getting answers about you.
                </p>
              </div>

              {/* All topics with confidence indicators - 5 per row for even layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                {(['compensation', 'benefits', 'work_life_balance', 'remote_policy', 'growth', 'culture', 'leadership', 'diversity', 'perks', 'interview_process'] as const).map((topic) => {
                  const topicData = report.topicsWithConfidence?.find(t => t.topic === topic)
                  const isCovered = report.topicsCovered.includes(topic)
                  const confidence = topicData?.confidence || (isCovered ? 'medium' : 'none')

                  const getConfidenceStyle = () => {
                    switch (confidence) {
                      case 'high':
                        return { bg: hbColors.tealLight, border: hbColors.teal, color: hbColors.tealDeep, icon: '✓✓' }
                      case 'medium':
                        return { bg: hbColors.tealLight, border: hbColors.teal, color: hbColors.tealDeep, icon: '✓' }
                      case 'low':
                        return { bg: hbColors.goldLight, border: hbColors.gold, color: '#92400E', icon: '~' }
                      default:
                        return { bg: hbColors.surfaceDim, border: hbColors.slateLight, color: hbColors.slateLight, icon: '—' }
                    }
                  }
                  const style = getConfidenceStyle()

                  return (
                    <div
                      key={topic}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: style.bg,
                        borderRadius: hbRadii.md,
                        borderLeft: `3px solid ${style.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: style.color,
                          width: '20px',
                        }}
                      >
                        {style.icon}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: confidence === 'none' ? hbColors.slateLight : hbColors.slate,
                          textTransform: 'capitalize',
                        }}
                      >
                        {topic.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {report.topicsMissing.length > 0 && (
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: `linear-gradient(135deg, ${hbColors.coralLight}, ${hbColors.surfaceRaised})`,
                    borderRadius: hbRadii.md,
                    borderLeft: `3px solid ${hbColors.coral}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>💡</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: hbColors.slate, marginBottom: '4px' }}>
                        Opportunity: {report.topicsMissing.length} topic{report.topicsMissing.length > 1 ? 's' : ''} with limited AI coverage
                      </div>
                      <p style={{ fontSize: '13px', color: hbColors.slateMid, lineHeight: 1.5, margin: 0 }}>
                        Add content about{' '}
                        <strong>{report.topicsMissing.slice(0, 3).map((t) => t.replace(/_/g, ' ')).join(', ')}</strong>
                        {report.topicsMissing.length > 3 ? ` and ${report.topicsMissing.length - 3} more` : ''}{' '}
                        to your careers page to improve how AI assists job seekers researching your company.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Platform breakdown - show actual differences */}
            <div
              style={{
                background: hbColors.surface,
                borderRadius: hbRadii.lg,
                padding: '24px',
                boxShadow: hbShadows.sm,
              }}
            >
              <h3
                style={{
                  fontFamily: hbFonts.display,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: hbColors.slate,
                  marginBottom: '8px',
                }}
              >
                Performance by AI Platform
              </h3>
              <p
                style={{
                  fontFamily: hbFonts.body,
                  fontSize: '14px',
                  color: hbColors.slateLight,
                  marginBottom: '20px',
                }}
              >
                How each AI assistant portrays {company.name} to job seekers
              </p>

              {/* Platform cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {(Object.keys(hbPlatformConfig) as HBPlatform[]).map((platform) => {
                  const config = hbPlatformConfig[platform]
                  const platformResponses = responses.filter((r) => r.platform === platform)
                  const total = platformResponses.length

                  // Calculate sentiment counts for this platform
                  const pStrong = platformResponses.filter(r => r.sentimentCategory === 'strong').length
                  const pPositive = platformResponses.filter(r => r.sentimentCategory === 'positive').length
                  const pMixed = platformResponses.filter(r => r.sentimentCategory === 'mixed').length
                  const pNegative = platformResponses.filter(r => r.sentimentCategory === 'negative').length

                  // Calculate desirability score for this platform (weighted sentiment)
                  const favorable = pStrong + pPositive
                  const unfavorable = pNegative
                  const baseScore = total > 0 ? (favorable / total) * 100 : 0
                  const strongBonus = total > 0 ? (pStrong / total) * 15 : 0
                  const negativePenalty = total > 0 ? (unfavorable / total) * 25 : 0
                  const platformDesirability = Math.round(Math.max(0, Math.min(100, baseScore + strongBonus - negativePenalty)))

                  // Percentages for bar
                  const negPct = total > 0 ? (pNegative / total) * 100 : 0
                  const mixPct = total > 0 ? (pMixed / total) * 100 : 0
                  const posPct = total > 0 ? (pPositive / total) * 100 : 0
                  const strPct = total > 0 ? (pStrong / total) * 100 : 0

                  return (
                    <div
                      key={platform}
                      style={{
                        background: hbColors.surfaceRaised,
                        borderRadius: hbRadii.lg,
                        padding: '20px',
                        borderLeft: `4px solid ${config.color}`,
                      }}
                    >
                      {/* Platform header with desirability score */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: hbRadii.md,
                              background: `${config.color}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={config.iconPath}
                              alt={config.name}
                              style={{
                                width: config.iconSize.width * 0.8,
                                height: config.iconSize.height * 0.8,
                                objectFit: 'contain',
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontFamily: hbFonts.display, fontSize: '15px', fontWeight: 600, color: hbColors.slate }}>
                              {config.name}
                            </div>
                            <div style={{ fontSize: '11px', color: hbColors.slateLight }}>
                              {config.weight === 10 ? '~60% market share' : config.weight === 4 ? '~15% share' : config.weight === 2 ? '~8% share' : '~5% share'}
                            </div>
                          </div>
                        </div>

                        {/* Desirability score badge */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: platformDesirability >= 60 ? '#ECFDF5' :
                                       platformDesirability >= 40 ? '#FFFBEB' : '#FEF2F2',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '18px',
                              fontWeight: 700,
                              color: platformDesirability >= 60 ? '#059669' :
                                     platformDesirability >= 40 ? '#D97706' : '#DC2626',
                              fontFamily: hbFonts.display,
                              lineHeight: 1,
                            }}
                          >
                            {platformDesirability}
                          </span>
                          <span style={{ fontSize: '9px', color: hbColors.slateLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Desirability
                          </span>
                        </div>
                      </div>

                      {/* Sentiment distribution bar */}
                      <div
                        style={{
                          display: 'flex',
                          height: '24px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          background: hbColors.surfaceDim,
                          marginBottom: '10px',
                        }}
                      >
                        {pNegative > 0 && (
                          <div
                            style={{
                              width: `${negPct}%`,
                              minWidth: '20px',
                              background: sentimentColors.negative,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={`Negative: ${pNegative}`}
                          >
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{pNegative}</span>
                          </div>
                        )}
                        {pMixed > 0 && (
                          <div
                            style={{
                              width: `${mixPct}%`,
                              minWidth: '20px',
                              background: sentimentColors.mixed,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={`Mixed: ${pMixed}`}
                          >
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{pMixed}</span>
                          </div>
                        )}
                        {pPositive > 0 && (
                          <div
                            style={{
                              width: `${posPct}%`,
                              minWidth: '20px',
                              background: sentimentColors.positive,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={`Positive: ${pPositive}`}
                          >
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{pPositive}</span>
                          </div>
                        )}
                        {pStrong > 0 && (
                          <div
                            style={{
                              width: `${strPct}%`,
                              minWidth: '20px',
                              background: sentimentColors.strong,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={`Strong: ${pStrong}`}
                          >
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{pStrong}</span>
                          </div>
                        )}
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: hbColors.slateLight }}>
                        <span>{pNegative + pMixed} unfavorable</span>
                        <span>{pPositive + pStrong} favorable</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Platform insight */}
              {(() => {
                // Find the best and worst performing platforms
                const platformScores = (Object.keys(hbPlatformConfig) as HBPlatform[]).map((platform) => {
                  const config = hbPlatformConfig[platform]
                  const platformResponses = responses.filter((r) => r.platform === platform)
                  const total = platformResponses.length
                  const pStrong = platformResponses.filter(r => r.sentimentCategory === 'strong').length
                  const pPositive = platformResponses.filter(r => r.sentimentCategory === 'positive').length
                  const pNegative = platformResponses.filter(r => r.sentimentCategory === 'negative').length
                  const favorable = pStrong + pPositive
                  const baseScore = total > 0 ? (favorable / total) * 100 : 0
                  const strongBonus = total > 0 ? (pStrong / total) * 15 : 0
                  const negativePenalty = total > 0 ? (pNegative / total) * 25 : 0
                  const score = Math.round(Math.max(0, Math.min(100, baseScore + strongBonus - negativePenalty)))
                  return { platform, name: config.name, score, weight: config.weight }
                })

                const sorted = [...platformScores].sort((a, b) => b.score - a.score)
                const best = sorted[0]
                const worst = sorted[sorted.length - 1]
                const chatgpt = platformScores.find(p => p.platform === 'chatgpt')
                const scoreDiff = best.score - worst.score

                return (
                  <div
                    style={{
                      padding: '14px 18px',
                      background: hbColors.surfaceRaised,
                      borderRadius: hbRadii.md,
                      fontSize: '13px',
                      color: hbColors.slateMid,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: hbColors.slate }}>💡 Insight:</strong>{' '}
                    {scoreDiff > 15 ? (
                      <>
                        {best.name} views {company.name} most favorably ({best.score}%), while {worst.name} is least favorable ({worst.score}%).
                        {chatgpt && chatgpt.platform !== best.platform && chatgpt.weight === 10 && (
                          <> Since ChatGPT has ~60% market share, its {chatgpt.score}% score has the biggest impact on your overall reputation.</>
                        )}
                      </>
                    ) : (
                      <>
                        Sentiment is consistent across platforms (scores range from {worst.score}% to {best.score}%).
                        {chatgpt && chatgpt.weight === 10 && (
                          <> ChatGPT's {chatgpt.score}% score carries the most weight due to its ~60% market share.</>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Next tab connector */}
            <HBTabFooter
              nextTab="responses"
              nextLabel="AI Responses"
              previewText={`See exactly what AI told job seekers about ${company.name}.`}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Responses Tab */}
        {activeTab === 'responses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tab description */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '20px', fontWeight: 700, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Here's what AI actually says
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                We asked {prompts.length} questions across {Object.keys(hbPlatformConfig).length} AI platforms. These are the exact responses job seekers receive when they ask about {company.name}. Filter by platform, sentiment, or topic to find specific responses — look for red-flagged or mixed responses that may be turning candidates away.
              </p>
            </div>

            {/* Platform filter pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPlatformFilter('all')}
                style={{
                  padding: '8px 16px',
                  borderRadius: hbRadii.full,
                  border: 'none',
                  background: platformFilter === 'all' ? hbColors.teal : hbColors.surface,
                  color: platformFilter === 'all' ? 'white' : hbColors.slateMid,
                  fontFamily: hbFonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: hbShadows.sm,
                }}
              >
                All Platforms ({responses.length})
              </button>
              {(Object.keys(hbPlatformConfig) as HBPlatform[]).map((platform) => {
                const count = responses.filter((r) => r.platform === platform).length
                return (
                  <button
                    key={platform}
                    onClick={() => setPlatformFilter(platform)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: hbRadii.full,
                      border: 'none',
                      background:
                        platformFilter === platform ? hbPlatformConfig[platform].color : hbColors.surface,
                      color: platformFilter === platform ? 'white' : hbColors.slateMid,
                      fontFamily: hbFonts.body,
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      boxShadow: hbShadows.sm,
                    }}
                  >
                    {hbPlatformConfig[platform].name} ({count})
                  </button>
                )
              })}
            </div>

            {/* Sentiment filter pills - 4 tier system */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '13px',
                  color: hbColors.slateLight,
                  fontFamily: hbFonts.body,
                  marginRight: '4px',
                }}
              >
                Sentiment:
              </span>
              <button
                onClick={() => setSentimentFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: sentimentFilter === 'all' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: sentimentFilter === 'all' ? hbColors.slate : hbColors.surface,
                  color: sentimentFilter === 'all' ? 'white' : hbColors.slateMid,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                All ({platformFilteredResponses.length})
              </button>
              <button
                onClick={() => setSentimentFilter('strong')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: sentimentFilter === 'strong' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: sentimentFilter === 'strong' ? sentimentColors.strong : hbColors.surface,
                  color: sentimentFilter === 'strong' ? 'white' : sentimentColors.strong,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Strong ({dynamicSentimentCounts.strong})
              </button>
              <button
                onClick={() => setSentimentFilter('positive')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: sentimentFilter === 'positive' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: sentimentFilter === 'positive' ? sentimentColors.positive : hbColors.surface,
                  color: sentimentFilter === 'positive' ? 'white' : sentimentColors.positive,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Positive ({dynamicSentimentCounts.positive})
              </button>
              <button
                onClick={() => setSentimentFilter('mixed')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: sentimentFilter === 'mixed' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: sentimentFilter === 'mixed' ? sentimentColors.mixed : hbColors.surface,
                  color: sentimentFilter === 'mixed' ? 'white' : '#92400E',
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Mixed ({dynamicSentimentCounts.mixed})
              </button>
              <button
                onClick={() => setSentimentFilter('negative')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: sentimentFilter === 'negative' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: sentimentFilter === 'negative' ? sentimentColors.negative : hbColors.surface,
                  color: sentimentFilter === 'negative' ? 'white' : sentimentColors.negative,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Negative ({dynamicSentimentCounts.negative})
              </button>
            </div>

            {/* Category filter pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '13px',
                  color: hbColors.slateLight,
                  fontFamily: hbFonts.body,
                  marginRight: '4px',
                }}
              >
                Topic:
              </span>
              <button
                onClick={() => setCategoryFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: hbRadii.full,
                  border: categoryFilter === 'all' ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                  background: categoryFilter === 'all' ? hbColors.slate : hbColors.surface,
                  color: categoryFilter === 'all' ? 'white' : hbColors.slateMid,
                  fontFamily: hbFonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              {(Object.keys(hbCategoryConfig) as HBQuestionCategory[]).map((cat) => {
                const config = hbCategoryConfig[cat]
                const count = platformFilteredResponses.filter((r) => r.promptCategory === cat).length
                if (count === 0) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: hbRadii.full,
                      border: categoryFilter === cat ? 'none' : `1px solid ${hbColors.surfaceDim}`,
                      background: categoryFilter === cat ? config.color : hbColors.surface,
                      color: categoryFilter === cat ? 'white' : config.color,
                      fontFamily: hbFonts.body,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {config.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Response cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredResponses.map((response) => (
                <HBResponseCard key={response.id} response={response} />
              ))}
            </div>

            <HBTabFooter
              nextTab="clippings"
              nextLabel="Clippings"
              previewText={`See what the web says about working at ${company.name}.`}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Clippings Tab */}
        {activeTab === 'clippings' && (
          <HBMentions
            mentions={data.mentions}
            mentionStats={report.mentionStats}
            companyName={company.name}
            onNavigate={setActiveTab}
          />
        )}

        {/* Competitors Tab */}
        {activeTab === 'competitors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tab description */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '20px', fontWeight: 700, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Here's how you compare
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                AI platforms compare {company.name} against other employers when candidates ask about you. This tab shows how you rank across 7 employer dimensions — look for where competitors are consistently outscoring you, as these are the areas most likely to cost you candidates.
              </p>
            </div>
            <HBCompetitorList
              competitors={report.topCompetitors}
              companyName={company.name}
              responses={responses}
              yourDesirability={report.visibilityScore}
              competitorAnalysis={report.competitorAnalysis}
            />
            <HBTabFooter
              nextTab="trends"
              nextLabel="Trends"
              previewText={`Track how ${company.name}'s competitive position changes over time.`}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tab description */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '20px', fontWeight: 700, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Here's where you're heading
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                Each scan captures a snapshot of your employer brand. This tab tracks how your scores and competitive position change over time — look for upward trends that validate your employer branding efforts, or downward shifts that need attention before they impact hiring.
              </p>
            </div>
            <HBTrends
              trends={data.trends}
              companyName={company.name}
            />
            <HBTabFooter
              nextTab="actions"
              nextLabel="Action Plan"
              previewText={`Based on these trends, here's your recommended action plan.`}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Action Plan Tab */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tab description */}
            <div>
              <h2 style={{ fontFamily: hbFonts.display, fontSize: '20px', fontWeight: 700, color: hbColors.slate, margin: '0 0 8px 0' }}>
                Here's what to do about it
              </h2>
              <p style={{ fontFamily: hbFonts.body, fontSize: '15px', color: hbColors.slateMid, lineHeight: 1.6, margin: 0 }}>
                Based on everything above — your scores, AI responses, competitive gaps, and trends — here's a prioritised action plan. Start with the quick wins this week and work through the 90-day timeline to systematically improve how AI represents {company.name} to candidates.
              </p>
            </div>
            {report.strategicSummary ? (
              <>
                {/* Brand Health Summary */}
                <div
                  style={{
                    background: hbColors.surface,
                    borderRadius: hbRadii.xl,
                    padding: '28px',
                    boxShadow: hbShadows.sm,
                    borderTop: `4px solid ${
                      report.strategicSummary.scoreInterpretation.overallHealth === 'strong' ? hbColors.teal :
                      report.strategicSummary.scoreInterpretation.overallHealth === 'moderate' ? hbColors.gold :
                      hbColors.coral
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: hbRadii.full,
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: report.strategicSummary.scoreInterpretation.overallHealth === 'strong' ? hbColors.tealLight :
                                    report.strategicSummary.scoreInterpretation.overallHealth === 'moderate' ? hbColors.goldLight :
                                    hbColors.coralLight,
                        color: report.strategicSummary.scoreInterpretation.overallHealth === 'strong' ? hbColors.tealDeep :
                               report.strategicSummary.scoreInterpretation.overallHealth === 'moderate' ? '#92400E' :
                               '#B91C1C',
                      }}
                    >
                      {report.strategicSummary.scoreInterpretation.overallHealth.replace('_', ' ')}
                    </span>
                  </div>
                  <h2
                    style={{
                      fontFamily: hbFonts.display,
                      fontSize: '22px',
                      fontWeight: 700,
                      color: hbColors.slate,
                      margin: '0 0 12px 0',
                    }}
                  >
                    Your Employer Brand Health
                  </h2>
                  <p
                    style={{
                      fontFamily: hbFonts.body,
                      fontSize: '16px',
                      lineHeight: 1.7,
                      color: hbColors.slateMid,
                      margin: '0 0 16px 0',
                    }}
                  >
                    {report.strategicSummary.executiveSummary}
                  </p>
                  <div
                    style={{
                      padding: '12px 16px',
                      background: hbColors.surfaceDim,
                      borderRadius: hbRadii.md,
                      display: 'inline-block',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: hbColors.slateLight, display: 'block', marginBottom: '2px' }}>
                      Competitive Positioning
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: hbColors.slate }}>
                      {report.strategicSummary.competitivePositioning}
                    </span>
                  </div>
                </div>

                {/* What to Amplify & What to Fix */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* What to Amplify */}
                  <div
                    style={{
                      background: hbColors.surface,
                      borderRadius: hbRadii.xl,
                      padding: '24px',
                      boxShadow: hbShadows.sm,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: hbColors.tealLight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                        }}
                      >
                        💪
                      </div>
                      <div>
                        <h3
                          style={{
                            fontFamily: hbFonts.display,
                            fontSize: '18px',
                            fontWeight: 600,
                            color: hbColors.slate,
                            margin: 0,
                          }}
                        >
                          What to Amplify
                        </h3>
                        <p style={{ fontSize: '12px', color: hbColors.slateLight, margin: 0 }}>
                          Your competitive advantages in employer brand
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {report.strategicSummary.strengths.map((strength, idx) => {
                        const pctAbove = strength.competitorAvg > 0
                          ? Math.round(((strength.score - strength.competitorAvg) / strength.competitorAvg) * 100)
                          : 0
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '16px',
                              background: hbColors.tealLight,
                              borderRadius: hbRadii.lg,
                              borderLeft: `4px solid ${hbColors.teal}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  color: hbColors.tealDeep,
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {strength.dimension}
                              </span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: hbColors.tealDeep,
                                }}
                              >
                                {pctAbove > 0 ? `${pctAbove}% above average` : `${strength.score}/10`}
                              </span>
                            </div>
                            <h4
                              style={{
                                fontFamily: hbFonts.display,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: hbColors.slate,
                                margin: '0 0 8px 0',
                              }}
                            >
                              {strength.headline}
                            </h4>
                            <p
                              style={{
                                fontSize: '13px',
                                color: hbColors.slateMid,
                                margin: '0 0 10px 0',
                                lineHeight: 1.5,
                              }}
                            >
                              <strong style={{ color: hbColors.tealDeep }}>How to leverage:</strong> {strength.leverageStrategy}
                            </p>
                            <button
                              onClick={() => { setActiveTab('responses') }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: hbColors.tealDeep,
                              }}
                            >
                              See the evidence →
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* What to Fix */}
                  <div
                    style={{
                      background: hbColors.surface,
                      borderRadius: hbRadii.xl,
                      padding: '24px',
                      boxShadow: hbShadows.sm,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: hbColors.coralLight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                        }}
                      >
                        🎯
                      </div>
                      <div>
                        <h3
                          style={{
                            fontFamily: hbFonts.display,
                            fontSize: '18px',
                            fontWeight: 600,
                            color: hbColors.slate,
                            margin: 0,
                          }}
                        >
                          What to Fix
                        </h3>
                        <p style={{ fontSize: '12px', color: hbColors.slateLight, margin: 0 }}>
                          Gaps that may impact talent acquisition
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {report.strategicSummary.gaps.map((gap, idx) => {
                        const pctBelow = gap.competitorAvg > 0
                          ? Math.round(((gap.competitorAvg - gap.score) / gap.competitorAvg) * 100)
                          : 0
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '16px',
                              background: hbColors.coralLight,
                              borderRadius: hbRadii.lg,
                              borderLeft: `4px solid ${hbColors.coral}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  color: '#B91C1C',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {gap.dimension}
                              </span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#B91C1C',
                                }}
                              >
                                {pctBelow > 0 ? `${pctBelow}% below average` : `${gap.score}/10`}
                              </span>
                            </div>
                            <h4
                              style={{
                                fontFamily: hbFonts.display,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: hbColors.slate,
                                margin: '0 0 8px 0',
                              }}
                            >
                              {gap.headline}
                            </h4>
                            <p
                              style={{
                                fontSize: '13px',
                                color: hbColors.slateMid,
                                margin: '0 0 10px 0',
                                lineHeight: 1.5,
                              }}
                            >
                              <strong style={{ color: '#B91C1C' }}>Business impact:</strong> {gap.businessImpact}
                            </p>
                            <button
                              onClick={() => { setActiveTab('competitors') }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#B91C1C',
                              }}
                            >
                              See how {gap.topCompetitor} compares →
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Your 90-Day Plan */}
                <div
                  style={{
                    background: hbColors.surface,
                    borderRadius: hbRadii.xl,
                    padding: '28px',
                    boxShadow: hbShadows.sm,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: hbColors.goldLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                      }}
                    >
                      🗓️
                    </div>
                    <div>
                      <h3
                        style={{
                          fontFamily: hbFonts.display,
                          fontSize: '20px',
                          fontWeight: 600,
                          color: hbColors.slate,
                          margin: 0,
                        }}
                      >
                        Your 90-Day Plan
                      </h3>
                      <p style={{ fontSize: '13px', color: hbColors.slateLight, margin: 0 }}>
                        Prioritized actions grouped by timeframe
                      </p>
                    </div>
                  </div>

                  {/* Timeline sections */}
                  {(() => {
                    const immediateRecs = report.strategicSummary.recommendations.filter(r => r.priority === 'immediate')
                    const shortTermRecs = report.strategicSummary.recommendations.filter(r => r.priority === 'short_term')
                    const longTermRecs = report.strategicSummary.recommendations.filter(r => r.priority === 'long_term')

                    const effortDescriptions: Record<HBEffortLevel, string> = {
                      quick_win: '< 2 hours, no approvals needed',
                      moderate: '1-2 weeks, involves content team',
                      significant: '1-3 months, cross-functional',
                    }

                    const successMetrics: Record<HBImpactLevel, string> = {
                      high: 'Expect measurable score improvement in next scan',
                      medium: 'Should improve brand perception within 2-3 scans',
                      low: 'Incremental improvement over time',
                    }

                    const timelineGroups = [
                      {
                        label: 'This Week',
                        subtitle: 'Quick wins you can start today',
                        recs: immediateRecs,
                        color: hbColors.coral,
                        bgColor: hbColors.coralLight,
                        textColor: '#B91C1C',
                      },
                      {
                        label: 'This Month',
                        subtitle: 'Moderate effort, meaningful impact',
                        recs: shortTermRecs,
                        color: hbColors.gold,
                        bgColor: hbColors.goldLight,
                        textColor: '#92400E',
                      },
                      {
                        label: 'This Quarter',
                        subtitle: 'Strategic initiatives for lasting change',
                        recs: longTermRecs,
                        color: hbColors.teal,
                        bgColor: hbColors.tealLight,
                        textColor: hbColors.tealDeep,
                      },
                    ]

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {timelineGroups.map((group) => group.recs.length > 0 && (
                          <div key={group.label}>
                            {/* Timeline header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                              <div
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: hbRadii.full,
                                  background: group.bgColor,
                                  color: group.textColor,
                                  fontSize: '13px',
                                  fontWeight: 700,
                                }}
                              >
                                {group.label}
                              </div>
                              <span style={{ fontSize: '13px', color: hbColors.slateLight }}>
                                {group.subtitle}
                              </span>
                            </div>

                            {/* Recommendation cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px', borderLeft: `3px solid ${group.color}30` }}>
                              {group.recs.map((rec, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    padding: '16px 20px',
                                    background: hbColors.surfaceRaised,
                                    borderRadius: hbRadii.lg,
                                  }}
                                >
                                  <h4
                                    style={{
                                      fontFamily: hbFonts.display,
                                      fontSize: '15px',
                                      fontWeight: 600,
                                      color: hbColors.slate,
                                      margin: '0 0 6px 0',
                                    }}
                                  >
                                    {rec.title}
                                  </h4>
                                  <p
                                    style={{
                                      fontSize: '13px',
                                      color: hbColors.slateMid,
                                      margin: '0 0 12px 0',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {rec.description}
                                  </p>
                                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', color: hbColors.slateLight }}>
                                      <strong style={{ color: hbColors.slateMid }}>Effort:</strong> {effortDescriptions[rec.effort]}
                                    </span>
                                    <span style={{ fontSize: '12px', color: hbColors.slateLight }}>
                                      <strong style={{ color: hbColors.slateMid }}>Success metric:</strong> {successMetrics[rec.impact]}
                                    </span>
                                  </div>
                                  {rec.relatedDimension && (
                                    <button
                                      onClick={() => { setActiveTab('responses') }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: group.textColor,
                                        marginTop: '8px',
                                      }}
                                    >
                                      See related AI responses →
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Industry Context Footer */}
                <div
                  style={{
                    background: hbColors.surfaceRaised,
                    borderRadius: hbRadii.lg,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: hbColors.slateLight, marginBottom: '4px' }}>
                      Industry Context
                    </div>
                    <p style={{ fontSize: '14px', color: hbColors.slateMid, margin: 0, lineHeight: 1.5 }}>
                      {report.strategicSummary.industryContext}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: '12px 16px',
                      background: hbColors.surface,
                      borderRadius: hbRadii.md,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: '11px', color: hbColors.slateLight, marginBottom: '2px' }}>
                      Top Talent Competitor
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: hbColors.slate }}>
                      {report.strategicSummary.topTalentCompetitor}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Fallback when no strategic summary is available */
              <div
                style={{
                  background: hbColors.surface,
                  borderRadius: hbRadii.lg,
                  padding: '48px',
                  textAlign: 'center',
                  boxShadow: hbShadows.sm,
                  border: `1px solid ${hbColors.surfaceDim}`,
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: hbColors.goldLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '28px',
                  }}
                >
                  ⏳
                </div>
                <h3
                  style={{
                    fontFamily: hbFonts.display,
                    fontSize: '20px',
                    fontWeight: 600,
                    color: hbColors.slate,
                    marginBottom: '8px',
                  }}
                >
                  Strategic Analysis Loading
                </h3>
                <p
                  style={{
                    fontFamily: hbFonts.body,
                    fontSize: '15px',
                    color: hbColors.slateMid,
                    maxWidth: '400px',
                    margin: '0 auto',
                  }}
                >
                  The AI-generated strategic summary is being prepared. Please refresh this page in a few moments.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Setup Tab (admin/owner only) */}
        {activeTab === 'setup' && canSetup && (
          <HBSetup
            reportToken={report.urlToken}
            companyName={company.name}
            onRescanTriggered={() => {
              setNavBrands(prev => prev.map(b =>
                b.domain === company.domain ? { ...b, isScanning: true } : b
              ))
            }}
          />
        )}
        </div>
      </main>
    </div>
  )
}
