'use client'

import { useState, useMemo } from 'react'
import {
  Globe,
  MessageSquare,
  BarChart3,
  Users,
  Lightbulb,
  FileCode,
  Lock,
  Filter,
  TrendingUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Brain
} from 'lucide-react'

/**
 * Format AI response text by converting markdown-style formatting to styled content
 * - Converts **bold** to <strong> tags
 * - Converts *italic* to <em> tags
 * - Converts numbered lists (1. item) to styled list items
 * - Converts bullet points (- item, * item at start of line) to styled bullets
 * - Strips markdown headers (# ## ###)
 * - Converts markdown tables to styled tables
 */
function formatResponseText(text: string): React.ReactNode[] {
  if (!text) return []

  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  // Process inline formatting (bold and italic)
  const formatInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let keyIndex = 0

    while (remaining.length > 0) {
      // Check for bold (**text**) - allow any content between ** including spaces
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
      if (boldMatch) {
        parts.push(
          <strong key={`${keyPrefix}-bold-${keyIndex++}`} className="text-[var(--text)]">
            {boldMatch[1]}
          </strong>
        )
        remaining = remaining.slice(boldMatch[0].length)
        continue
      }

      // Check for italic (*text*) - but not ** which is bold
      const italicMatch = remaining.match(/^\*([^*]+)\*(?!\*)/)
      if (italicMatch) {
        parts.push(
          <em key={`${keyPrefix}-italic-${keyIndex++}`} className="text-[var(--text-mid)]">
            {italicMatch[1]}
          </em>
        )
        remaining = remaining.slice(italicMatch[0].length)
        continue
      }

      // Find the next markdown token
      const nextBold = remaining.indexOf('**')
      // Look for single * that isn't part of **
      let nextItalic = -1
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === '*') {
          // Check it's not part of **
          if (remaining[i + 1] !== '*' && (i === 0 || remaining[i - 1] !== '*')) {
            nextItalic = i
            break
          }
        }
      }

      let nextToken = remaining.length
      if (nextBold !== -1 && nextBold < nextToken) nextToken = nextBold
      if (nextItalic !== -1 && nextItalic < nextToken) nextToken = nextItalic

      // Add plain text up to the next token
      if (nextToken > 0) {
        parts.push(remaining.slice(0, nextToken))
        remaining = remaining.slice(nextToken)
      } else if (remaining.length > 0) {
        // If we're stuck, add one character and move on
        parts.push(remaining[0])
        remaining = remaining.slice(1)
      }
    }

    return parts
  }

  // Detect table sections and process them together
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Check if this is the start of a markdown table (line with |)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = []

      // Collect all table lines
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }

      // Skip separator lines (|---|---|) and parse table
      const dataRows = tableLines.filter(l => !l.match(/^\|[\s-:|]+\|$/))

      if (dataRows.length > 0) {
        const tableKey = `table-${i}`
        const headerCells = dataRows[0].split('|').filter(c => c.trim())
        const bodyRows = dataRows.slice(1)

        result.push(
          <div key={tableKey} className="overflow-x-auto" style={{ margin: '16px 0' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {headerCells.map((cell, cellIdx) => (
                    <th
                      key={cellIdx}
                      className="text-left font-mono text-xs text-[var(--text-mid)] uppercase"
                      style={{ padding: '8px 12px' }}
                    >
                      {formatInline(cell.trim(), `${tableKey}-h-${cellIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => {
                  const cells = row.split('|').filter(c => c.trim())
                  return (
                    <tr key={rowIdx} className="border-b border-[var(--border-subtle)]">
                      {cells.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="text-[var(--text-dim)]"
                          style={{ padding: '8px 12px' }}
                        >
                          {formatInline(cell.trim(), `${tableKey}-${rowIdx}-${cellIdx}`)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // Strip markdown headers (# ## ### etc.)
    let processedLine = line
    const headerMatch = line.match(/^#{1,6}\s+(.*)/)
    if (headerMatch) {
      processedLine = headerMatch[1]
    }

    // Check for bullet points (- item or * item at start of line, but not ** bold)
    const bulletMatch = processedLine.match(/^[\s]*[-]\s+(.*)/) ||
                        processedLine.match(/^[\s]*\*\s+(?!\*)(.*)/)
    const numberedMatch = processedLine.match(/^[\s]*(\d+)\.\s+(.*)/)

    // Handle numbered list items
    if (numberedMatch) {
      const content = formatInline(numberedMatch[2], `${i}`)
      result.push(
        <div key={i} className="flex" style={{ gap: '12px', marginTop: i > 0 ? '8px' : '0' }}>
          <span className="text-[var(--green)] font-mono flex-shrink-0" style={{ width: '24px' }}>
            {numberedMatch[1]}.
          </span>
          <span>{content}</span>
        </div>
      )
      i++
      continue
    }

    // Handle bullet points
    if (bulletMatch) {
      const content = formatInline(bulletMatch[1], `${i}`)
      result.push(
        <div key={i} className="flex" style={{ gap: '12px', marginTop: i > 0 ? '6px' : '0' }}>
          <span className="text-[var(--green)]">•</span>
          <span>{content}</span>
        </div>
      )
      i++
      continue
    }

    // Regular line - process inline formatting
    const content = formatInline(processedLine, `${i}`)

    if (processedLine.trim() === '') {
      result.push(<div key={i} style={{ height: '12px' }} />)
    } else {
      result.push(
        <span key={i}>
          {content}
          {i < lines.length - 1 && <br />}
        </span>
      )
    }
    i++
  }

  return result
}

// Tab types
type TabId = 'overview' | 'responses' | 'readiness' | 'measurements' | 'competitors' | 'brandAwareness' | 'actions' | 'prd'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  locked?: boolean
  lockMessage?: string
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Globe },
  { id: 'responses', label: 'AI Responses', icon: MessageSquare },
  { id: 'readiness', label: 'AI Readiness', icon: Shield },
  { id: 'measurements', label: 'Measurements', icon: BarChart3 },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'brandAwareness', label: 'Brand Awareness', icon: Brain },
  { id: 'actions', label: 'Action Plans', icon: Lightbulb, locked: true, lockMessage: 'Upgrade to get personalized recommendations' },
  { id: 'prd', label: 'PRD & Specs', icon: FileCode, locked: true, lockMessage: 'Upgrade to generate ready-to-ship PRDs' },
]

interface Analysis {
  business_type: string
  business_name: string | null
  services: string[]
  location: string | null
  target_audience?: string | null
  key_phrases?: string[]
  industry?: string
}

interface Response {
  platform: string
  response_text: string
  domain_mentioned: boolean
  prompt: { prompt_text: string } | null
}

interface Prompt {
  id: string
  prompt_text: string
  category: string
}

interface Competitor {
  name: string
  count: number
}

interface CrawlData {
  hasSitemap?: boolean
  hasRobotsTxt?: boolean
  pagesCrawled?: number
  schemaTypes?: string[]
  hasMetaDescriptions?: boolean
}

interface BrandAwarenessResult {
  platform: string
  query_type: string
  tested_entity: string
  tested_attribute: string | null
  entity_recognized: boolean
  attribute_mentioned: boolean
  response_text: string
  confidence_score: number
  compared_to: string | null
  positioning: string | null
}

interface ReportTabsProps {
  analysis: Analysis | null
  responses: Response[] | null
  prompts?: Prompt[] | null
  brandAwareness?: BrandAwarenessResult[] | null
  visibilityScore: number
  platformScores: Record<string, number>
  competitors?: Competitor[]
  crawlData?: CrawlData
  domain: string
  onUpgradeClick: () => void
}

export function ReportTabs({
  analysis,
  responses,
  prompts,
  brandAwareness,
  visibilityScore,
  platformScores,
  competitors = [],
  crawlData,
  domain,
  onUpgradeClick
}: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [brandPlatformFilter, setBrandPlatformFilter] = useState<string>('all')

  return (
    <div style={{ marginTop: '48px' }}>
      {/* Tab Navigation - Spread across full width */}
      <div
        className="border-b border-[var(--border)]"
        style={{ marginBottom: '40px' }}
      >
        <nav
          className="flex"
          style={{ marginBottom: '-1px' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => !tab.locked && setActiveTab(tab.id)}
                className={`
                  relative flex items-center justify-center gap-2 flex-1 py-4 font-mono transition-all
                  border-b-2
                  ${isActive
                    ? 'text-[var(--text)] border-[var(--green)] bg-[var(--surface)]'
                    : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text-mid)] hover:bg-[var(--surface)]/50'
                  }
                  ${tab.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{ fontSize: '12px', minWidth: 0 }}
              >
                <Icon size={15} className="flex-shrink-0" />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                {tab.locked && (
                  <Lock size={10} className="text-[var(--text-ghost)] flex-shrink-0" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'overview' && (
          <OverviewTab analysis={analysis} prompts={prompts} domain={domain} />
        )}
        {activeTab === 'responses' && (
          <ResponsesTab
            responses={responses}
            platformFilter={platformFilter}
            onFilterChange={setPlatformFilter}
          />
        )}
        {activeTab === 'readiness' && (
          <AIReadinessTab analysis={analysis} crawlData={crawlData} domain={domain} />
        )}
        {activeTab === 'measurements' && (
          <MeasurementsTab
            visibilityScore={visibilityScore}
            platformScores={platformScores}
            analysis={analysis}
          />
        )}
        {activeTab === 'competitors' && (
          <CompetitorsTab
            competitors={competitors}
            onUpgradeClick={onUpgradeClick}
          />
        )}
        {activeTab === 'brandAwareness' && (
          <BrandAwarenessTab
            brandAwareness={brandAwareness}
            analysis={analysis}
            domain={domain}
            platformFilter={brandPlatformFilter}
            onFilterChange={setBrandPlatformFilter}
            onUpgradeClick={onUpgradeClick}
          />
        )}
        {activeTab === 'actions' && (
          <LockedTab
            icon={Lightbulb}
            title="Personalized Action Plans"
            description="Get specific, prioritized recommendations to improve your AI visibility."
            features={[
              'Content gap recommendations',
              'Technical SEO for AI crawlers',
              'Schema markup suggestions',
              'Citation-building strategies'
            ]}
            onUpgrade={onUpgradeClick}
          />
        )}
        {activeTab === 'prd' && (
          <LockedTab
            icon={FileCode}
            title="PRD & Technical Specs"
            description="Ready-to-ship product requirements for your AI coding tools."
            features={[
              'Cursor/Claude Code ready PRDs',
              'Implementation task breakdown',
              'Code snippets and examples',
              'Integration specifications'
            ]}
            onUpgrade={onUpgradeClick}
          />
        )}
      </div>
    </div>
  )
}

// ============================================
// OVERVIEW TAB
// ============================================

const categoryLabels: Record<string, string> = {
  general: 'General Discovery',
  location: 'Location-Based',
  service: 'Service-Specific',
  comparison: 'Comparison',
  recommendation: 'Recommendation',
}

const categoryColors: Record<string, string> = {
  general: 'var(--blue)',
  location: 'var(--green)',
  service: 'var(--amber)',
  comparison: 'var(--red)',
  recommendation: 'var(--text-mid)',
}

function OverviewTab({
  analysis,
  prompts,
  domain
}: {
  analysis: Analysis | null
  prompts?: Prompt[] | null
  domain: string
}) {
  if (!analysis) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Globe size={48} className="mx-auto mb-4 opacity-30" />
        <p>No analysis data available</p>
      </div>
    )
  }

  // Group prompts by category
  const promptsByCategory = prompts?.reduce((acc, prompt) => {
    const category = prompt.category || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(prompt)
    return acc
  }, {} as Record<string, Prompt[]>) || {}

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Business Identity */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          What We Detected
        </h3>

        <div style={{ display: 'grid', gap: '28px' }}>
          {analysis.business_name && (
            <div>
              <label className="text-[var(--text-dim)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
                Business Name
              </label>
              <p className="text-[var(--text)] text-xl font-medium">
                {analysis.business_name}
              </p>
            </div>
          )}

          <div>
            <label className="text-[var(--text-dim)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
              Business Type
            </label>
            <p className="text-[var(--text)] text-lg">
              {analysis.business_type}
            </p>
          </div>

          <div className="grid sm:grid-cols-2" style={{ gap: '24px' }}>
            {analysis.location && (
              <div>
                <label className="text-[var(--text-dim)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
                  Location
                </label>
                <p className="text-[var(--text-mid)]">
                  {analysis.location}
                </p>
              </div>
            )}

            {analysis.industry && (
              <div>
                <label className="text-[var(--text-dim)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
                  Industry
                </label>
                <p className="text-[var(--text-mid)]">
                  {analysis.industry}
                </p>
              </div>
            )}

            {analysis.target_audience && (
              <div>
                <label className="text-[var(--text-dim)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
                  Target Audience
                </label>
                <p className="text-[var(--text-mid)]">
                  {analysis.target_audience}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Services */}
      {analysis.services && analysis.services.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            Products & Services
          </h3>

          <div className="flex flex-wrap" style={{ gap: '12px' }}>
            {analysis.services.map((service, index) => (
              <span
                key={index}
                className="bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-mid)] font-mono"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Phrases */}
      {analysis.key_phrases && analysis.key_phrases.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            Key Phrases We Identified
          </h3>

          <div className="flex flex-wrap" style={{ gap: '12px' }}>
            {analysis.key_phrases.map((phrase, index) => (
              <span
                key={index}
                className="bg-[var(--green)]/10 border border-[var(--green)]/20 text-[var(--green)] font-mono"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Generated Questions */}
      {prompts && prompts.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <h3
              className="text-[var(--green)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Questions We Asked AI
            </h3>
            <span className="text-[var(--text-dim)] font-mono text-xs">
              {prompts.length} questions
            </span>
          </div>

          <p
            className="text-[var(--text-dim)] text-sm"
            style={{ marginBottom: '24px', lineHeight: '1.6' }}
          >
            We crawled your website and identified your business as {analysis?.business_name ? <strong className="text-[var(--text-mid)]">{analysis.business_name}</strong> : 'your company'}
            {analysis?.business_type && analysis.business_type !== 'Business website' && <>, a <strong className="text-[var(--text-mid)]">{analysis.business_type.toLowerCase()}</strong></>}
            {analysis?.location && <> in <strong className="text-[var(--text-mid)]">{analysis.location}</strong></>}.
            These are the exact questions we asked ChatGPT, Claude, and Gemini to see if they recommend you.
          </p>

          <div style={{ display: 'grid', gap: '12px' }}>
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id || index}
                className="flex items-start bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '16px 20px', gap: '16px' }}
              >
                <span
                  className="flex-shrink-0 font-mono text-[var(--text-ghost)]"
                  style={{ fontSize: '12px', width: '24px' }}
                >
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[var(--text-mid)]"
                    style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '8px' }}
                  >
                    {prompt.prompt_text}
                  </p>
                  <span
                    className="font-mono text-xs"
                    style={{ color: categoryColors[prompt.category] || 'var(--text-ghost)' }}
                  >
                    {categoryLabels[prompt.category] || prompt.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade prompt for editing */}
          <div
            className="flex items-center justify-between bg-[var(--surface)] border border-dashed border-[var(--border)]"
            style={{ marginTop: '24px', padding: '20px 24px', gap: '16px' }}
          >
            <div className="flex items-center" style={{ gap: '12px' }}>
              <Lock size={18} className="text-[var(--text-ghost)]" />
              <div>
                <p className="text-[var(--text-mid)] text-sm font-medium">
                  Want to customize these questions?
                </p>
                <p className="text-[var(--text-dim)] text-xs" style={{ marginTop: '4px' }}>
                  Edit existing questions, add your own, and re-run analysis to track changes over time.
                </p>
              </div>
            </div>
            <span
              className="flex-shrink-0 text-[var(--green)] font-mono text-xs cursor-pointer hover:underline"
            >
              Upgrade →
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// AI READINESS TAB
// ============================================

interface ReadinessCheck {
  id: string
  label: string
  description: string
  impact: 'high' | 'medium' | 'low'
  check: (analysis: Analysis | null, crawlData?: CrawlData) => 'pass' | 'fail' | 'warning' | 'unknown'
}

const readinessChecks: ReadinessCheck[] = [
  {
    id: 'business_clarity',
    label: 'Clear Business Identity',
    description: 'AI can determine what your business does and offers',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.business_name && analysis.business_type !== 'Business website') return 'pass'
      if (analysis.business_type !== 'Business website') return 'warning'
      return 'fail'
    }
  },
  {
    id: 'services_defined',
    label: 'Services/Products Listed',
    description: 'Your offerings are clearly described on the site',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.services && analysis.services.length >= 3) return 'pass'
      if (analysis.services && analysis.services.length > 0) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'location_specified',
    label: 'Location Information',
    description: 'Geographic service area is specified for local discovery',
    impact: 'high',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.location) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'target_audience',
    label: 'Target Audience Defined',
    description: 'Clear indication of who you serve helps AI match queries',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.target_audience) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'industry_context',
    label: 'Industry Context',
    description: 'Industry classification helps AI categorize your business',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.industry && analysis.industry !== 'General') return 'pass'
      return 'warning'
    }
  },
  {
    id: 'key_phrases',
    label: 'Relevant Keywords',
    description: 'Important phrases that describe your expertise',
    impact: 'medium',
    check: (analysis) => {
      if (!analysis) return 'unknown'
      if (analysis.key_phrases && analysis.key_phrases.length >= 5) return 'pass'
      if (analysis.key_phrases && analysis.key_phrases.length > 0) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'sitemap',
    label: 'XML Sitemap Available',
    description: 'Helps AI crawlers discover and index all your pages',
    impact: 'high',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.hasSitemap) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'page_depth',
    label: 'Sufficient Content Depth',
    description: 'Multiple pages provide more context for AI training',
    impact: 'medium',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.pagesCrawled && crawlData.pagesCrawled >= 10) return 'pass'
      if (crawlData.pagesCrawled && crawlData.pagesCrawled >= 5) return 'warning'
      return 'fail'
    }
  },
  {
    id: 'schema_markup',
    label: 'Schema Markup (Structured Data)',
    description: 'JSON-LD helps AI understand your business data',
    impact: 'high',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.schemaTypes && crawlData.schemaTypes.length > 0) return 'pass'
      return 'fail'
    }
  },
  {
    id: 'meta_descriptions',
    label: 'Meta Descriptions',
    description: 'Clear summaries help AI understand page content',
    impact: 'medium',
    check: (_, crawlData) => {
      if (!crawlData) return 'unknown'
      if (crawlData.hasMetaDescriptions) return 'pass'
      return 'warning'
    }
  },
]

function AIReadinessTab({
  analysis,
  crawlData,
  domain
}: {
  analysis: Analysis | null
  crawlData?: CrawlData
  domain: string
}) {
  // Calculate results for each check
  const results = readinessChecks.map(check => ({
    ...check,
    status: check.check(analysis, crawlData)
  }))

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length
  const totalChecks = results.filter(r => r.status !== 'unknown').length

  // Group by impact
  const highImpact = results.filter(r => r.impact === 'high')
  const mediumImpact = results.filter(r => r.impact === 'medium')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Summary */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          AI Readiness Score
        </h3>

        <div className="flex items-center justify-between flex-wrap" style={{ gap: '24px' }}>
          <div className="flex items-center" style={{ gap: '32px' }}>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <CheckCircle2 size={20} className="text-[var(--green)]" />
              <span className="font-mono text-lg text-[var(--text)]">{passCount}</span>
              <span className="text-[var(--text-dim)] text-sm">passed</span>
            </div>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <AlertCircle size={20} className="text-[var(--amber)]" />
              <span className="font-mono text-lg text-[var(--text)]">{warningCount}</span>
              <span className="text-[var(--text-dim)] text-sm">warnings</span>
            </div>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <XCircle size={20} className="text-[var(--red)]" />
              <span className="font-mono text-lg text-[var(--text)]">{failCount}</span>
              <span className="text-[var(--text-dim)] text-sm">failed</span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-3xl text-[var(--text)]">
              {totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0}%
            </span>
            <span className="text-[var(--text-dim)] text-sm block">ready for AI</span>
          </div>
        </div>
      </div>

      {/* High Impact Checks */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--red)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          High Impact Factors
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          {highImpact.map((check) => (
            <ReadinessCheckRow key={check.id} check={check} />
          ))}
        </div>
      </div>

      {/* Medium Impact Checks */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--amber)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Medium Impact Factors
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          {mediumImpact.map((check) => (
            <ReadinessCheckRow key={check.id} check={check} />
          ))}
        </div>
      </div>

      {/* What to do */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why This Matters
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          AI assistants like ChatGPT, Claude, and Gemini use signals from your website to understand
          and recommend your business. The checks above identify what&apos;s helping or hurting your
          AI visibility. Fixing failed items can significantly improve how often AI recommends you.
        </p>
      </div>
    </div>
  )
}

function ReadinessCheckRow({ check }: { check: ReadinessCheck & { status: string } }) {
  const statusConfig = {
    pass: { icon: CheckCircle2, color: 'var(--green)', bg: 'var(--green)' },
    warning: { icon: AlertCircle, color: 'var(--amber)', bg: 'var(--amber)' },
    fail: { icon: XCircle, color: 'var(--red)', bg: 'var(--red)' },
    unknown: { icon: AlertCircle, color: 'var(--text-ghost)', bg: 'var(--text-ghost)' },
  }

  const config = statusConfig[check.status as keyof typeof statusConfig] || statusConfig.unknown
  const Icon = config.icon

  return (
    <div
      className="flex items-start bg-[var(--surface-elevated)] border border-[var(--border)]"
      style={{ padding: '20px', gap: '16px' }}
    >
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{ width: '32px', height: '32px', backgroundColor: `${config.bg}15` }}
      >
        <Icon size={16} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
          <span className="font-medium text-[var(--text)]">{check.label}</span>
          <span
            className="font-mono text-xs uppercase"
            style={{ color: config.color }}
          >
            {check.status}
          </span>
        </div>
        <p className="text-[var(--text-dim)] text-sm">
          {check.description}
        </p>
      </div>
    </div>
  )
}

// ============================================
// COMPETITORS TAB
// ============================================

function CompetitorsTab({
  competitors,
  onUpgradeClick
}: {
  competitors: Competitor[]
  onUpgradeClick: () => void
}) {
  if (!competitors || competitors.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Users size={48} className="mx-auto mb-4 opacity-30" />
        <p>No competitors detected in AI responses</p>
      </div>
    )
  }

  // Show first competitor fully, mask the rest
  const [firstCompetitor, ...otherCompetitors] = competitors

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* First competitor - fully visible */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Top Competitor Mentioned
        </h3>

        <div className="flex items-center justify-between" style={{ gap: '16px' }}>
          <div className="flex items-center" style={{ gap: '16px' }}>
            <div
              className="font-mono font-bold text-[var(--green)]"
              style={{ fontSize: '24px', width: '40px' }}
            >
              #1
            </div>
            <div>
              <div className="font-medium text-[var(--text)] text-lg">
                {firstCompetitor.name}
              </div>
              <div className="text-[var(--text-dim)] text-sm font-mono">
                Mentioned {firstCompetitor.count} times by AI
              </div>
            </div>
          </div>
          <div
            className="bg-[var(--green)]/10 border border-[var(--green)]/20 px-4 py-2"
          >
            <span className="font-mono text-[var(--green)] text-lg">{firstCompetitor.count}</span>
            <span className="text-[var(--text-dim)] text-xs ml-2">mentions</span>
          </div>
        </div>
      </div>

      {/* Other competitors - masked */}
      {otherCompetitors.length > 0 && (
        <div className="card relative" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            Other Competitors ({otherCompetitors.length} more)
          </h3>

          <div style={{ display: 'grid', gap: '16px' }}>
            {otherCompetitors.map((competitor, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '20px', gap: '16px' }}
              >
                <div className="flex items-center" style={{ gap: '16px' }}>
                  <div
                    className="font-mono font-bold text-[var(--text-dim)]"
                    style={{ fontSize: '18px', width: '40px' }}
                  >
                    #{index + 2}
                  </div>
                  <div>
                    <div
                      className="font-medium text-[var(--text-ghost)]"
                      style={{ filter: 'blur(5px)', userSelect: 'none' }}
                    >
                      {competitor.name}
                    </div>
                    <div className="text-[var(--text-ghost)] text-sm font-mono">
                      Competitor {String.fromCharCode(65 + index)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <Lock size={14} className="text-[var(--text-ghost)]" />
                  <span className="font-mono text-[var(--text-ghost)]">{competitor.count}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade overlay */}
          <div
            className="absolute inset-0 flex items-end justify-center"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, var(--surface) 70%)',
              padding: '32px'
            }}
          >
            <button
              onClick={onUpgradeClick}
              className="form-button flex items-center gap-2"
              style={{ width: 'auto', padding: '16px 28px' }}
            >
              <Lock size={14} />
              Unlock All Competitors
            </button>
          </div>
        </div>
      )}

      {/* Why competitors matter */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why Competitors Matter
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          These are businesses that AI assistants mention when users ask questions relevant to your
          industry. Understanding who AI recommends instead of you helps identify what content and
          authority signals you need to compete for AI visibility.
        </p>
      </div>
    </div>
  )
}

// ============================================
// BRAND AWARENESS TAB
// ============================================

function BrandAwarenessTab({
  brandAwareness,
  analysis,
  domain,
  platformFilter,
  onFilterChange,
  onUpgradeClick
}: {
  brandAwareness?: BrandAwarenessResult[] | null
  analysis: Analysis | null
  domain: string
  platformFilter: string
  onFilterChange: (filter: string) => void
  onUpgradeClick: () => void
}) {
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)

  if (!brandAwareness || brandAwareness.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <Brain size={48} className="mx-auto mb-4 opacity-30" />
        <p>No brand awareness data available</p>
        <p className="text-sm" style={{ marginTop: '8px' }}>
          Brand awareness testing runs during the initial scan
        </p>
      </div>
    )
  }

  // Filter by platform
  const filteredResults = platformFilter === 'all'
    ? brandAwareness
    : brandAwareness.filter(r => r.platform === platformFilter)

  // Group results by type
  const brandRecallResults = filteredResults.filter(r => r.query_type === 'brand_recall')
  const serviceCheckResults = filteredResults.filter(r => r.query_type === 'service_check')
  const competitorCompareResults = filteredResults.filter(r => r.query_type === 'competitor_compare')

  // Get unique platforms
  const platforms = [...new Set(brandAwareness.map(r => r.platform))]

  // Calculate recognition stats
  const recognizedCount = brandRecallResults.filter(r => r.entity_recognized).length
  const totalPlatforms = brandRecallResults.length

  // Group service checks by service
  const servicesByName = new Map<string, BrandAwarenessResult[]>()
  for (const result of serviceCheckResults) {
    if (result.tested_attribute) {
      const existing = servicesByName.get(result.tested_attribute) || []
      existing.push(result)
      servicesByName.set(result.tested_attribute, existing)
    }
  }

  // Find knowledge gaps (services not known by any platform)
  const knowledgeGaps = [...servicesByName.entries()]
    .filter(([_, results]) => !results.some(r => r.attribute_mentioned))
    .map(([service]) => service)

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Methodology Explainer */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Brain size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6', marginBottom: '12px' }}>
              <strong className="text-[var(--text)]">Different from AI Responses:</strong> In the AI Responses tab, we ask generic questions (like &quot;recommend a {analysis?.business_type || 'business'} in {analysis?.location || 'my area'}&quot;) and see if your brand gets mentioned organically. Here, we <em>directly ask</em> each AI about your brand to test what&apos;s actually in their knowledge base.
            </p>
            <div
              className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded text-[var(--text-dim)] text-xs"
              style={{ padding: '12px 14px', lineHeight: '1.6' }}
            >
              <span className="text-[var(--text-ghost)] font-mono">PROMPT:</span>{' '}
              &quot;What do you know about {analysis?.business_name || '[Your Business]'} ({domain || 'your-domain.com'})? What services do they offer and where are they located?&quot;
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="flex items-center justify-between flex-wrap border-b border-[var(--border)]"
        style={{ paddingBottom: '20px', gap: '16px' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[var(--text-dim)]" />
          <span className="text-[var(--text-dim)] font-mono text-sm">Filter by AI:</span>
        </div>

        <div className="flex flex-wrap" style={{ gap: '8px' }}>
          <FilterButton
            active={platformFilter === 'all'}
            onClick={() => onFilterChange('all')}
          >
            All
          </FilterButton>
          {platforms.map(platform => (
            <FilterButton
              key={platform}
              active={platformFilter === platform}
              onClick={() => onFilterChange(platform)}
              color={platformColors[platform]}
            >
              {platformNames[platform] || platform}
            </FilterButton>
          ))}
        </div>
      </div>

      {/* Brand Recognition Section */}
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            Brand Recognition
          </h3>
          <span className="font-mono text-[var(--text-mid)]">
            {recognizedCount}/{totalPlatforms} platforms
          </span>
        </div>

        <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
          When directly asked, does the AI have knowledge of {analysis?.business_name || 'your business'}? A &quot;Recognized&quot; result means the AI provided specific information rather than saying it doesn&apos;t know.
        </p>

        <div style={{ display: 'grid', gap: '16px' }}>
          {brandRecallResults.map((result, index) => (
            <div
              key={index}
              className="bg-[var(--surface-elevated)] border border-[var(--border)]"
              style={{ padding: '20px' }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <div className="flex items-center" style={{ gap: '12px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: platformColors[result.platform] || 'var(--text-dim)',
                    }}
                  />
                  <span className="font-mono text-sm text-[var(--text)]">
                    {platformNames[result.platform] || result.platform}
                  </span>
                </div>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  {result.entity_recognized ? (
                    <>
                      <CheckCircle2 size={16} className="text-[var(--green)]" />
                      <span className="font-mono text-sm text-[var(--green)]">Recognized</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} className="text-[var(--red)]" />
                      <span className="font-mono text-sm text-[var(--red)]">Not Found</span>
                    </>
                  )}
                </div>
              </div>

              <div
                className="text-[var(--text-dim)] text-sm"
                style={{
                  lineHeight: '1.6',
                  maxHeight: expandedResponse === `recall-${index}` ? 'none' : '72px',
                  overflow: 'hidden',
                }}
              >
                {result.response_text
                  ? formatResponseText(
                      expandedResponse === `recall-${index}`
                        ? result.response_text
                        : result.response_text.slice(0, 300) + ((result.response_text.length > 300) ? '...' : '')
                    )
                  : 'No response recorded'}
              </div>

              {(result.response_text?.length || 0) > 300 && (
                <button
                  onClick={() => setExpandedResponse(
                    expandedResponse === `recall-${index}` ? null : `recall-${index}`
                  )}
                  className="text-[var(--green)] font-mono text-xs hover:underline"
                  style={{ marginTop: '8px' }}
                >
                  {expandedResponse === `recall-${index}` ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Service Knowledge Section */}
      {servicesByName.size > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '12px', letterSpacing: '0.1em' }}
          >
            Service Knowledge
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
            Does AI know about the services you offer?
          </p>

          {/* Service Table */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th
                    className="text-left font-mono text-xs text-[var(--text-dim)] uppercase"
                    style={{ padding: '12px 16px', paddingLeft: '0' }}
                  >
                    Service
                  </th>
                  {platforms.map(platform => (
                    <th
                      key={platform}
                      className="text-center font-mono text-xs text-[var(--text-dim)]"
                      style={{ padding: '12px 16px', width: '100px' }}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: platformColors[platform] || 'var(--text-dim)',
                          }}
                        />
                        {platformNames[platform]?.slice(0, 3) || platform.slice(0, 3)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...servicesByName.entries()].map(([service, results], index) => {
                  const isGap = !results.some(r => r.attribute_mentioned)
                  return (
                    <tr
                      key={index}
                      className={`border-b border-[var(--border-subtle)] ${isGap ? 'bg-[var(--red)]/5' : ''}`}
                    >
                      <td
                        className="text-[var(--text-mid)] text-sm"
                        style={{ padding: '16px', paddingLeft: '0' }}
                      >
                        {service}
                        {isGap && (
                          <span className="text-[var(--red)] text-xs font-mono ml-2">GAP</span>
                        )}
                      </td>
                      {platforms.map(platform => {
                        const platformResult = results.find(r => r.platform === platform)
                        const mentioned = platformResult?.attribute_mentioned
                        return (
                          <td
                            key={platform}
                            className="text-center"
                            style={{ padding: '16px', width: '100px' }}
                          >
                            {mentioned ? (
                              <CheckCircle2 size={18} className="mx-auto text-[var(--green)]" />
                            ) : (
                              <XCircle size={18} className="mx-auto text-[var(--text-ghost)]" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Knowledge Gap Warning */}
          {knowledgeGaps.length > 0 && (
            <div
              className="flex items-start bg-[var(--red)]/10 border border-[var(--red)]/20"
              style={{ padding: '16px 20px', marginTop: '24px', gap: '12px' }}
            >
              <AlertCircle size={18} className="text-[var(--red)] flex-shrink-0" style={{ marginTop: '2px' }} />
              <div>
                <p className="text-[var(--text)] text-sm font-medium" style={{ marginBottom: '4px' }}>
                  Knowledge Gap Detected
                </p>
                <p className="text-[var(--text-dim)] text-sm">
                  No AI assistant knows about: <strong className="text-[var(--text-mid)]">{knowledgeGaps.join(', ')}</strong>.
                  Consider adding more content about these services.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Competitor Positioning Section */}
      {competitorCompareResults.length > 0 && (
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '12px', letterSpacing: '0.1em' }}
          >
            Competitive Positioning
          </h3>
          <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
            How AI compares you to: <strong className="text-[var(--text-mid)]">{competitorCompareResults[0]?.compared_to || 'competitors'}</strong>
          </p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {competitorCompareResults.map((result, index) => (
              <div
                key={index}
                className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '20px' }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: platformColors[result.platform] || 'var(--text-dim)',
                      }}
                    />
                    <span className="font-mono text-sm text-[var(--text)]">
                      {platformNames[result.platform] || result.platform}
                    </span>
                  </div>
                  <PositioningBadge positioning={result.positioning} />
                </div>

                <div
                  className="text-[var(--text-dim)] text-sm"
                  style={{
                    lineHeight: '1.6',
                    maxHeight: expandedResponse === `compare-${index}` ? 'none' : '96px',
                    overflow: 'hidden',
                  }}
                >
                  {result.response_text
                    ? formatResponseText(
                        expandedResponse === `compare-${index}`
                          ? result.response_text
                          : result.response_text.slice(0, 400) + ((result.response_text.length > 400) ? '...' : '')
                      )
                    : 'No response recorded'}
                </div>

                {(result.response_text?.length || 0) > 400 && (
                  <button
                    onClick={() => setExpandedResponse(
                      expandedResponse === `compare-${index}` ? null : `compare-${index}`
                    )}
                    className="text-[var(--green)] font-mono text-xs hover:underline"
                    style={{ marginTop: '8px' }}
                  >
                    {expandedResponse === `compare-${index}` ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upgrade CTA for full competitor analysis */}
          <div
            className="flex items-center justify-between bg-[var(--surface)] border border-dashed border-[var(--border)]"
            style={{ marginTop: '24px', padding: '20px 24px', gap: '16px' }}
          >
            <div className="flex items-center" style={{ gap: '12px' }}>
              <Lock size={18} className="text-[var(--text-ghost)]" />
              <div>
                <p className="text-[var(--text-mid)] text-sm font-medium">
                  Want analysis for all competitors?
                </p>
                <p className="text-[var(--text-dim)] text-xs" style={{ marginTop: '4px' }}>
                  Get brand awareness comparisons for every competitor detected in your report.
                </p>
              </div>
            </div>
            <button
              onClick={onUpgradeClick}
              className="flex-shrink-0 text-[var(--green)] font-mono text-xs cursor-pointer hover:underline"
            >
              Upgrade →
            </button>
          </div>
        </div>
      )}

      {/* Why Brand Awareness Matters */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
        >
          Why Brand Awareness Matters
        </h3>
        <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          Unlike Google which indexes websites in real-time, AI assistants are trained on historical data
          that&apos;s typically 6-18 months old. This means your brand needs to be in their training corpus
          to be recommended. This tab shows what each AI actually knows about your business versus what
          your website claims—revealing critical gaps in your AI visibility.
        </p>
      </div>
    </div>
  )
}

function PositioningBadge({ positioning }: { positioning: string | null }) {
  const config = {
    stronger: { label: 'Stronger', color: 'var(--green)', bg: 'var(--green)' },
    weaker: { label: 'Weaker', color: 'var(--red)', bg: 'var(--red)' },
    equal: { label: 'Equal', color: 'var(--amber)', bg: 'var(--amber)' },
    not_compared: { label: 'Not Compared', color: 'var(--text-ghost)', bg: 'var(--text-ghost)' },
  }

  const style = config[positioning as keyof typeof config] || config.not_compared

  return (
    <span
      className="font-mono text-xs uppercase"
      style={{
        padding: '4px 10px',
        backgroundColor: `${style.bg}15`,
        color: style.color,
        border: `1px solid ${style.bg}30`,
      }}
    >
      {style.label}
    </span>
  )
}

// ============================================
// RESPONSES TAB
// ============================================

const platformColors: Record<string, string> = {
  chatgpt: 'var(--red)',
  claude: 'var(--green)',
  gemini: 'var(--blue)',
}

const platformNames: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
}

function ResponsesTab({
  responses,
  platformFilter,
  onFilterChange
}: {
  responses: Response[] | null
  platformFilter: string
  onFilterChange: (filter: string) => void
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (!responses || responses.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
        <p>No AI responses recorded yet</p>
      </div>
    )
  }

  const filteredResponses = platformFilter === 'all'
    ? responses
    : responses.filter(r => r.platform === platformFilter)

  // Count by platform
  const platformCounts = responses.reduce((acc, r) => {
    acc[r.platform] = (acc[r.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      {/* Filter Bar */}
      <div
        className="flex items-center justify-between flex-wrap border-b border-[var(--border)]"
        style={{ paddingBottom: '20px', marginBottom: '28px', gap: '16px' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[var(--text-dim)]" />
          <span className="text-[var(--text-dim)] font-mono text-sm">Filter by:</span>
        </div>

        <div className="flex flex-wrap" style={{ gap: '8px' }}>
          <FilterButton
            active={platformFilter === 'all'}
            onClick={() => onFilterChange('all')}
          >
            All ({responses.length})
          </FilterButton>
          {Object.entries(platformCounts).map(([platform, count]) => (
            <FilterButton
              key={platform}
              active={platformFilter === platform}
              onClick={() => onFilterChange(platform)}
              color={platformColors[platform]}
            >
              {platformNames[platform] || platform} ({count})
            </FilterButton>
          ))}
        </div>
      </div>

      {/* Response Cards */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {filteredResponses.map((response, index) => {
          const isExpanded = expandedIndex === index
          const truncateAt = 500
          const shouldTruncate = (response.response_text?.length || 0) > truncateAt

          return (
            <div
              key={index}
              className="card"
              style={{ padding: '28px' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between" style={{ marginBottom: '20px' }}>
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: platformColors[response.platform] || 'var(--text-dim)',
                    }}
                  />
                  <span className="font-mono text-sm text-[var(--text)]">
                    {platformNames[response.platform] || response.platform}
                  </span>
                </div>

                {response.domain_mentioned && (
                  <span
                    className="text-[var(--green)] font-mono flex items-center gap-1"
                    style={{ fontSize: '12px' }}
                  >
                    <span style={{ fontSize: '14px' }}>✓</span> Mentioned
                  </span>
                )}
              </div>

              {/* Question */}
              {response.prompt?.prompt_text && (
                <div
                  className="bg-[var(--surface-elevated)] border-l-2 border-[var(--border)]"
                  style={{ padding: '16px 20px', marginBottom: '20px' }}
                >
                  <span className="text-[var(--text-ghost)] font-mono text-xs block" style={{ marginBottom: '8px' }}>
                    QUESTION
                  </span>
                  <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    {response.prompt.prompt_text}
                  </p>
                </div>
              )}

              {/* Response */}
              <div>
                <span className="text-[var(--text-ghost)] font-mono text-xs block" style={{ marginBottom: '12px' }}>
                  RESPONSE
                </span>
                <div
                  className="text-[var(--text-mid)]"
                  style={{ fontSize: '14px', lineHeight: '1.7' }}
                >
                  {formatResponseText(
                    isExpanded || !shouldTruncate
                      ? response.response_text || ''
                      : (response.response_text?.slice(0, truncateAt) || '') + '...'
                  )}
                </div>

                {shouldTruncate && (
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    className="text-[var(--green)] font-mono text-sm hover:underline flex items-center gap-1"
                    style={{ marginTop: '12px' }}
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                    <ChevronDown
                      size={14}
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterButton({
  children,
  active,
  onClick,
  color
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        font-mono text-sm transition-all
        ${active
          ? 'bg-[var(--surface-elevated)] text-[var(--text)] border-[var(--border)]'
          : 'bg-transparent text-[var(--text-dim)] border-transparent hover:text-[var(--text-mid)]'
        }
      `}
      style={{
        padding: '8px 14px',
        border: '1px solid',
        borderColor: active ? 'var(--border)' : 'transparent',
        fontSize: '12px',
      }}
    >
      {color && (
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            backgroundColor: color,
            marginRight: '8px',
          }}
        />
      )}
      {children}
    </button>
  )
}

// ============================================
// MEASUREMENTS TAB
// ============================================

function MeasurementsTab({
  visibilityScore,
  platformScores,
  analysis
}: {
  visibilityScore: number
  platformScores: Record<string, number>
  analysis: Analysis | null
}) {
  // Calculate readiness score based on analysis quality
  const readinessScore = calculateReadinessScore(analysis)

  return (
    <div style={{ display: 'grid', gap: '40px' }}>
      {/* Dual Score Display */}
      <div
        className="grid md:grid-cols-2"
        style={{ gap: '24px' }}
      >
        {/* AI Visibility Score */}
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '28px', letterSpacing: '0.1em' }}
          >
            AI Visibility Score
          </h3>

          <div
            className="relative mx-auto"
            style={{ width: '160px', height: '160px', marginBottom: '24px' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={getScoreColor(visibilityScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${visibilityScore * 2.64} 264`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono font-medium"
                style={{ fontSize: '40px', color: getScoreColor(visibilityScore) }}
              >
                {visibilityScore}
              </span>
            </div>
          </div>

          <p className="text-[var(--text-dim)] text-sm" style={{ lineHeight: '1.6' }}>
            How often AI assistants mention your business when answering relevant questions.
          </p>
        </div>

        {/* Website Readiness Score */}
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '28px', letterSpacing: '0.1em' }}
          >
            Website Readiness Score
          </h3>

          <div
            className="relative mx-auto"
            style={{ width: '160px', height: '160px', marginBottom: '24px' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={getScoreColor(readinessScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${readinessScore * 2.64} 264`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono font-medium"
                style={{ fontSize: '40px', color: getScoreColor(readinessScore) }}
              >
                {readinessScore}
              </span>
            </div>
          </div>

          <p className="text-[var(--text-dim)] text-sm" style={{ lineHeight: '1.6' }}>
            How easily AI can understand and extract information from your website.
          </p>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Visibility by Platform
        </h3>

        <div style={{ display: 'grid', gap: '20px' }}>
          {Object.entries(platformScores).map(([platform, score]) => (
            <div key={platform} className="flex items-center" style={{ gap: '16px' }}>
              <div
                className="flex items-center gap-2 font-mono text-sm"
                style={{ width: '100px' }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: platformColors[platform] || 'var(--text-dim)',
                  }}
                />
                {platformNames[platform] || platform}
              </div>

              <div
                className="flex-1 bg-[var(--surface-elevated)] h-3"
                style={{ position: 'relative' }}
              >
                <div
                  style={{
                    width: `${score}%`,
                    height: '100%',
                    backgroundColor: platformColors[platform] || 'var(--text-dim)',
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>

              <span className="font-mono text-[var(--text-mid)]" style={{ width: '50px', textAlign: 'right' }}>
                {score}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Chart Placeholder */}
      <div className="card" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            Visibility Trends
          </h3>
          <span
            className="text-[var(--text-ghost)] font-mono text-xs bg-[var(--surface-elevated)] px-3 py-1"
          >
            Coming Soon
          </span>
        </div>

        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center"
          style={{ height: '240px', borderStyle: 'dashed' }}
        >
          <div className="text-center">
            <TrendingUp size={40} className="mx-auto text-[var(--text-ghost)] mb-3" />
            <p className="text-[var(--text-dim)] font-mono text-sm" style={{ marginBottom: '8px' }}>
              Track mentions over time
            </p>
            <p className="text-[var(--text-ghost)] text-xs" style={{ maxWidth: '280px' }}>
              Monitor how your AI visibility changes and compare against competitors
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// LOCKED TAB
// ============================================

function LockedTab({
  icon: Icon,
  title,
  description,
  features,
  onUpgrade
}: {
  icon: React.ElementType
  title: string
  description: string
  features: string[]
  onUpgrade: () => void
}) {
  return (
    <div className="text-center" style={{ padding: '60px 20px' }}>
      <div
        className="mx-auto rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center"
        style={{ width: '80px', height: '80px', marginBottom: '28px' }}
      >
        <Icon size={32} className="text-[var(--text-dim)]" />
      </div>

      <h3
        className="text-xl font-medium text-[var(--text)]"
        style={{ marginBottom: '12px' }}
      >
        {title}
      </h3>

      <p
        className="text-[var(--text-dim)]"
        style={{ marginBottom: '32px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}
      >
        {description}
      </p>

      <div
        className="bg-[var(--surface)] border border-[var(--border)] text-left"
        style={{ maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto', marginBottom: '32px', padding: '24px' }}
      >
        <span className="text-[var(--text-ghost)] font-mono text-xs uppercase tracking-wider block" style={{ marginBottom: '16px' }}>
          What&apos;s included
        </span>
        <ul style={{ display: 'grid', gap: '12px' }}>
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-[var(--text-mid)]">
              <span className="text-[var(--green)]" style={{ marginTop: '2px' }}>✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onUpgrade}
        className="form-button"
        style={{ width: 'auto', padding: '16px 32px' }}
      >
        <Lock size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
        Unlock {title}
      </button>
    </div>
  )
}

// ============================================
// UTILITIES
// ============================================

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--amber)'
  return 'var(--red)'
}

function calculateReadinessScore(analysis: Analysis | null): number {
  if (!analysis) return 0

  let score = 0
  const maxScore = 100

  if (analysis.business_name) score += 15
  if (analysis.business_type && analysis.business_type !== 'Business website') score += 20
  if (analysis.services && analysis.services.length > 0) {
    score += Math.min(analysis.services.length * 4, 20)
  }
  if (analysis.location) score += 10
  if (analysis.target_audience) score += 10
  if (analysis.industry && analysis.industry !== 'General') score += 10
  if (analysis.key_phrases && analysis.key_phrases.length > 0) {
    score += Math.min(analysis.key_phrases.length * 3, 15)
  }

  return Math.min(score, maxScore)
}
