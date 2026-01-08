'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  Brain,
  Compass,
  Settings,
  Briefcase,
  Code,
  Building2,
  Plus,
  Pencil,
  ChevronRight,
  Sparkles,
  Eye,
  Target,
  Zap,
  Info
} from 'lucide-react'
import { ScoreGauge } from './ScoreGauge'
import Link from 'next/link'
/**
 * Save scroll position before navigating to pricing page
 * This allows restoring position when user returns via back button
 */
function handlePricingClick() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('report_scroll_position', String(window.scrollY))
  }
}

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

// Tab types - reordered: Start Here first, Setup (was Overview), AI Readiness before AI Responses
type TabId = 'startHere' | 'setup' | 'readiness' | 'responses' | 'measurements' | 'competitors' | 'brandAwareness' | 'actions' | 'prd'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  locked?: boolean
  premium?: boolean // Shows gold padlock instead of grey
  lockMessage?: string
}

const tabs: Tab[] = [
  { id: 'startHere', label: 'Start Here', icon: Compass },
  { id: 'setup', label: 'Setup', icon: Settings },
  { id: 'readiness', label: 'AI Readiness', icon: Shield },
  { id: 'responses', label: 'AI Responses', icon: MessageSquare },
  { id: 'measurements', label: 'Measurements', icon: BarChart3 },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'brandAwareness', label: 'Brand Awareness', icon: Brain, premium: true, lockMessage: 'Deep brand analysis available to subscribers' },
  { id: 'actions', label: 'Action Plans', icon: Lightbulb, locked: true, premium: true, lockMessage: 'Subscribers get personalized action plans' },
  { id: 'prd', label: 'PRD & Specs', icon: FileCode, locked: true, premium: true, lockMessage: 'Subscribers get ready-to-ship PRDs' },
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
  // Always start with default tab on server/initial render to avoid hydration mismatch
  const [activeTab, setActiveTab] = useState<TabId>('startHere')
  const [isTabRestored, setIsTabRestored] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [brandPlatformFilter, setBrandPlatformFilter] = useState<string>('all')
  const tabsRef = useRef<HTMLDivElement>(null)

  // Restore active tab from sessionStorage after hydration (for back button restoration)
  useEffect(() => {
    const savedTab = sessionStorage.getItem('report_active_tab')
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTab(savedTab as TabId)
      // Clear the saved tab after restoring (one-time use)
      sessionStorage.removeItem('report_active_tab')
    }
    setIsTabRestored(true)
  }, [])

  // Save active tab to sessionStorage whenever it changes (but only after initial restoration)
  useEffect(() => {
    if (isTabRestored) {
      sessionStorage.setItem('report_active_tab', activeTab)
    }
  }, [activeTab, isTabRestored])

  const scrollToTabsAndNavigate = (tabId: TabId) => {
    setActiveTab(tabId)
    // Scroll to tabs with a small offset from top
    setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <div ref={tabsRef} style={{ marginTop: '48px', scrollMarginTop: '24px' }}>
      {/* Tab Navigation - Spread across full width */}
      <div
        className="border-b border-[var(--border)]"
        style={{ marginBottom: '40px' }}
      >
        <nav
          className="flex"
          style={{ marginBottom: '-1px' }}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isLast = index === tabs.length - 1
            const showGoldLock = tab.premium || tab.locked

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 font-mono transition-all
                  border-b-2 cursor-pointer
                  ${isActive
                    ? 'text-[var(--text)] border-[var(--green)] bg-[var(--surface)]'
                    : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text-mid)] hover:bg-[var(--surface)]/50'
                  }
                  ${!isLast ? 'border-r border-r-[var(--border-subtle)]' : ''}
                `}
                style={{ fontSize: '11px', minWidth: 0, padding: '16px 8px' }}
              >
                <Icon size={18} className="flex-shrink-0" style={{ marginBottom: '8px' }} />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                {showGoldLock && (
                  <Lock
                    size={10}
                    className="absolute"
                    style={{
                      top: '8px',
                      right: '8px',
                      color: 'var(--gold)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'startHere' && (
          <StartHereTab
            analysis={analysis}
            domain={domain}
            onContinue={() => scrollToTabsAndNavigate('setup')}
          />
        )}
        {activeTab === 'setup' && (
          <SetupTab analysis={analysis} prompts={prompts} domain={domain} />
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
            responses={responses}
            analysis={analysis}
            brandAwareness={brandAwareness}
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
// START HERE TAB
// ============================================

function StartHereTab({
  analysis,
  domain,
  onContinue
}: {
  analysis: Analysis | null
  domain: string
  onContinue: () => void
}) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>('business-owner')

  const personas = [
    {
      id: 'business-owner',
      icon: Briefcase,
      title: 'Business Owners',
      color: 'var(--green)',
    },
    {
      id: 'developer',
      icon: Code,
      title: 'Developers & Builders',
      color: 'var(--blue)',
    },
    {
      id: 'agency',
      icon: Building2,
      title: 'Agencies',
      color: 'var(--amber)',
    }
  ]

  // Tab explanations tailored by persona - detailed for engaged users
  const getTabGuide = () => {
    const businessOwnerGuide = [
      {
        tab: 'Setup',
        desc: 'See how we identified your business, services, and location. This powers everything else.',
        detail: 'We crawled your website and used AI to understand what you do, who you serve, and where you operate. You can also add custom questions to test — want to see if AI recommends you for a specific service or product? Add it here and re-run the analysis.'
      },
      {
        tab: 'AI Readiness',
        desc: 'A quick health check — is your website structured so AI can understand you?',
        detail: 'AI assistants prefer sites with clear structure, schema markup, and good meta descriptions. We check for the technical basics that help AI "read" your site properly.'
      },
      {
        tab: 'AI Responses',
        desc: 'The big one. We asked AI assistants questions your customers might ask. Did they recommend you?',
        detail: 'We ran real queries like "best [your service] in [your area]" across ChatGPT, Claude, Gemini, and Perplexity. You\'ll see the exact responses and whether you were mentioned, ignored, or beaten by competitors.'
      },
      {
        tab: 'Measurements',
        desc: 'Your visibility score across ChatGPT, Claude, Gemini, and Perplexity.',
        detail: 'Not all platforms are equal — ChatGPT has 80% of AI search traffic, so we weight mentions accordingly. A ChatGPT mention is worth 10x more than a Claude mention in real-world terms.'
      },
      {
        tab: 'Competitors',
        desc: 'Who is AI recommending instead of you? Know your competition.',
        detail: 'When AI doesn\'t mention you, it mentions someone else. We show you exactly who\'s getting recommended so you can study what they\'re doing right.'
      },
    ]

    const developerGuide = [
      {
        tab: 'Setup',
        desc: 'Review extracted business entities, services array, and location data from your site crawl.',
        detail: 'Our crawler extracts structured data from your HTML, meta tags, and page content. You can add custom queries to test specific use cases — useful for A/B testing how different prompt formulations affect visibility across models.'
      },
      {
        tab: 'AI Readiness',
        desc: 'Technical signals: schema markup, sitemap, meta descriptions, and crawlability factors.',
        detail: 'JSON-LD schema, XML sitemaps, meta robots directives, and semantic HTML all affect how AI training data is indexed. We check for the signals that matter for LLM retrieval systems.'
      },
      {
        tab: 'AI Responses',
        desc: 'Raw LLM outputs showing exactly how each model responds to industry queries.',
        detail: 'Unfiltered API responses from GPT-4, Claude 3.5, Gemini Pro, and Perplexity. Useful for understanding model-specific behaviors and prompt sensitivity. We highlight entity mentions and sentiment.'
      },
      {
        tab: 'Measurements',
        desc: 'Quantified visibility metrics with reach-weighted scoring across platforms.',
        detail: 'Scoring formula: (ChatGPT × 10 + Perplexity × 4 + Gemini × 2 + Claude × 1) / 17. Weights based on real referral traffic data. Individual platform breakdowns available for A/B testing your changes.'
      },
      {
        tab: 'Competitors',
        desc: 'Entity extraction showing which domains appear in AI recommendations.',
        detail: 'We parse AI responses to extract mentioned businesses and domains. Useful for reverse-engineering what content and structure gets cited by different models.'
      },
    ]

    const agencyGuide = [
      {
        tab: 'Setup',
        desc: 'Client business profile — verify the data before presenting to stakeholders.',
        detail: 'Review the extracted business profile and add custom questions tailored to your client\'s priorities. Testing specific services or products? Add those queries here to show clients exactly where they stand for the searches that matter most to them.'
      },
      {
        tab: 'AI Readiness',
        desc: 'Quick wins and red flags to prioritize in your SEO recommendations.',
        detail: 'Each check maps to a specific fix you can scope and price. Schema markup issues are often 2-4 hour fixes with measurable impact. Great for upselling technical SEO work.'
      },
      {
        tab: 'AI Responses',
        desc: 'Evidence of visibility (or lack thereof) — screenshot-worthy for reports.',
        detail: 'Use these actual AI responses in your client reports and pitches. Nothing sells GEO services better than showing a prospect that their competitor is getting mentioned and they\'re not.'
      },
      {
        tab: 'Measurements',
        desc: 'Benchmark scores to track over time and compare across client portfolio.',
        detail: 'The reach-weighted score gives you a single number to track month-over-month. Compare across your client portfolio to identify who needs the most attention and who\'s your success story.'
      },
      {
        tab: 'Competitors',
        desc: 'Competitive intelligence to inform content and link-building strategy.',
        detail: 'When competitor X keeps appearing in AI responses, they\'re doing something right. Analyze their content, backlink profile, and schema implementation to reverse-engineer their success.'
      },
    ]

    switch (selectedPersona) {
      case 'developer': return developerGuide
      case 'agency': return agencyGuide
      default: return businessOwnerGuide
    }
  }

  const getSubscriberBenefits = () => {
    switch (selectedPersona) {
      case 'developer':
        return [
          'Ready-to-implement PRDs for Cursor, Claude Code, or Windsurf',
          'Schema markup code snippets tailored to your business',
          'Weekly automated re-scans with API access',
          'Technical action plans with priority scoring',
        ]
      case 'agency':
        return [
          'Weekly monitoring across all client sites',
          'Competitor tracking with trend analysis',
          'Exportable reports for client presentations',
          'Priority action plans with estimated impact',
        ]
      default:
        return [
          'Personalized action plans to improve your visibility',
          'Weekly monitoring to track your progress',
          'Competitor tracking to stay ahead',
          'Direct brand awareness testing across all AI platforms',
        ]
    }
  }

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Welcome Header */}
      <div style={{ padding: '20px 0 0' }}>
        <h2
          className="text-2xl font-medium text-[var(--text)]"
          style={{ marginBottom: '16px' }}
        >
          We&apos;ve analyzed how AI assistants see{' '}
          <span className="text-[var(--green)]">{analysis?.business_name || domain}</span>
        </h2>
        <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.6', marginBottom: '16px' }}>
          Thanks for requesting your AI Visibility Report.
        </p>
        <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.6', marginBottom: '16px' }}>
          You&apos;re now seeing your business the way ChatGPT, Claude, Gemini, and Perplexity do — and it might be different from what you&apos;d expect. Unlike Google, there&apos;s no paid advertising in AI responses. What these assistants recommend comes entirely from how they understand your content. OutrankLLM shows you exactly what to change so AI starts recommending you.
        </p>
        <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.6' }}>
          Select your role below for a tailored guide on getting the most from this analysis.
        </p>
      </div>

      {/* Persona Pills - Inline selection */}
      <div>
        <p className="text-[var(--text-dim)] text-sm" style={{ marginBottom: '12px' }}>
          I am a...
        </p>
        <div className="flex flex-wrap" style={{ gap: '12px' }}>
          {personas.map((persona) => {
            const Icon = persona.icon
            const isSelected = selectedPersona === persona.id

            return (
              <button
                key={persona.id}
                onClick={() => setSelectedPersona(persona.id)}
                className="flex items-center gap-2 transition-all"
                style={{
                  padding: '10px 20px',
                  backgroundColor: isSelected ? `${persona.color}15` : 'var(--surface)',
                  border: `1px solid ${isSelected ? persona.color : 'var(--border)'}`,
                  color: isSelected ? persona.color : 'var(--text-mid)',
                }}
              >
                <Icon size={16} />
                <span className="font-mono text-sm">{persona.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Guide - Shows when persona selected */}
      {selectedPersona && (
        <div
          className="bg-[var(--surface)] border border-[var(--border)]"
          style={{ padding: '28px' }}
        >
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
          >
            How to Use This Report
          </h3>

          <div style={{ display: 'grid', gap: '24px' }}>
            {getTabGuide().map((item, index) => (
              <div key={item.tab} className="flex" style={{ gap: '16px' }}>
                <div
                  className="flex-shrink-0 flex items-center justify-center font-mono text-xs"
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: 'var(--green)/10',
                    color: 'var(--green)',
                    borderRadius: '50%',
                  }}
                >
                  {index + 1}
                </div>
                <div>
                  <div style={{ marginBottom: '6px' }}>
                    <span className="font-medium text-[var(--text)]">{item.tab}</span>
                    <span className="text-[var(--text-dim)]"> — </span>
                    <span className="text-[var(--text-mid)] text-sm">{item.desc}</span>
                  </div>
                  <p className="text-[var(--text-dim)] text-sm" style={{ lineHeight: '1.5' }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Locked features teaser */}
          <div
            style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
              <Lock size={14} style={{ color: 'var(--gold)' }} />
              <span className="text-sm" style={{ color: 'var(--gold)' }}>
                Subscribers also get access to:
              </span>
            </div>
            <div className="grid sm:grid-cols-2" style={{ gap: '8px' }}>
              {getSubscriberBenefits().map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <ChevronRight size={12} className="text-[var(--text-ghost)] flex-shrink-0" style={{ marginTop: '4px' }} />
                  <span className="text-[var(--text-dim)] text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {analysis && (
        <div
          className="bg-[var(--surface-elevated)] border border-[var(--border)]"
          style={{ padding: '24px' }}
        >
          <h4
            className="text-[var(--text-ghost)] font-mono text-xs uppercase tracking-wider"
            style={{ marginBottom: '20px' }}
          >
            What We Found
          </h4>
          <div className="grid sm:grid-cols-4" style={{ gap: '24px' }}>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <Eye size={14} className="text-[var(--green)]" />
                <span className="text-[var(--text-dim)] text-xs font-mono">Business</span>
              </div>
              <p className="text-[var(--text)]">{analysis.business_name || domain}</p>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <Target size={14} className="text-[var(--green)]" />
                <span className="text-[var(--text-dim)] text-xs font-mono">Type</span>
              </div>
              <p className="text-[var(--text)]">{analysis.business_type || 'Analyzing...'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <Zap size={14} className="text-[var(--green)]" />
                <span className="text-[var(--text-dim)] text-xs font-mono">Services</span>
              </div>
              <p className="text-[var(--text)]">{analysis.services?.length || 0} detected</p>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <Globe size={14} className="text-[var(--green)]" />
                <span className="text-[var(--text-dim)] text-xs font-mono">Location</span>
              </div>
              <p className="text-[var(--text)]">{analysis.location || 'Not detected'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div style={{ padding: '12px 0' }}>
        <button
          onClick={onContinue}
          className="font-mono text-sm transition-all inline-flex items-center gap-2 bg-[var(--green)] text-[var(--bg)] hover:opacity-90"
          style={{ padding: '16px 32px' }}
        >
          {selectedPersona ? 'Start Exploring Your Report' : 'Continue to Setup'}
          <ChevronRight size={16} />
        </button>
        {!selectedPersona && (
          <p className="text-[var(--text-ghost)] text-xs" style={{ marginTop: '8px' }}>
            Or select a role above for a tailored guide
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================
// SETUP TAB (formerly Overview)
// ============================================

const categoryLabels: Record<string, string> = {
  // New research-based categories
  finding_provider: 'Finding a Provider',
  product_specific: 'Product Search',
  service: 'Service Search',
  comparison: 'Comparison',
  review: 'Reviews & Ratings',
  how_to: 'How-To',
  // Legacy categories (for backward compatibility)
  general: 'General',
  location: 'Location-Based',
  recommendation: 'Recommendation',
}

const categoryColors: Record<string, string> = {
  // New research-based categories
  finding_provider: 'var(--green)',
  product_specific: 'var(--amber)',
  service: 'var(--blue)',
  comparison: 'var(--red)',
  review: 'var(--text-mid)',
  how_to: 'var(--text-dim)',
  // Legacy categories
  general: 'var(--blue)',
  location: 'var(--green)',
  recommendation: 'var(--text-mid)',
}

function SetupTab({
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
        <Settings size={48} className="mx-auto mb-4 opacity-30" />
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
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Settings size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Your Report Configuration:</strong> We crawled your website and extracted key information about your business. This data powers the questions we ask AI assistants. Subscribers can edit and customize these settings.
            </p>
          </div>
        </div>
      </div>

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
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <h3
              className="text-[var(--green)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Products & Services
            </h3>
            <span className="text-[var(--text-dim)] font-mono text-xs">
              {analysis.services.length} detected
            </span>
          </div>

          <div className="flex flex-wrap" style={{ gap: '12px', marginBottom: '20px' }}>
            {analysis.services.map((service, index) => (
              <span
                key={index}
                className="bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-mid)] font-mono"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {service}
              </span>
            ))}
            {/* Subscribe to add more button */}
            <Link
              href="/pricing?from=report"
              onClick={handlePricingClick}
              className="flex items-center gap-2 transition-all hover:opacity-80"
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                background: 'transparent',
                border: '1px dashed var(--gold-dim)',
                color: 'var(--gold)',
                textDecoration: 'none',
              }}
            >
              <Plus size={14} />
              <span className="font-mono">Subscribe to add more</span>
              <Lock size={12} />
            </Link>
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
            style={{ marginBottom: '16px', lineHeight: '1.6' }}
          >
            We analyzed your website and identified your business as {analysis?.business_name ? <strong className="text-[var(--text-mid)]">{analysis.business_name}</strong> : 'your company'}
            {analysis?.business_type && analysis.business_type !== 'Business website' && <>, a <strong className="text-[var(--text-mid)]">{analysis.business_type.toLowerCase()}</strong></>}
            {analysis?.location && <> in <strong className="text-[var(--text-mid)]">{analysis.location}</strong></>}.
          </p>

          {/* Search-based queries indicator */}
          <div
            className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border-subtle)] px-3 py-2"
            style={{ marginBottom: '24px', width: 'fit-content' }}
          >
            <Globe size={14} className="text-[var(--green)]" />
            <span className="text-xs text-[var(--text-mid)]">
              Based on real search queries people use for businesses like yours
            </span>
          </div>

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

          {/* Upgrade prompt for editing - Gold styling for premium feature */}
          <div
            className="flex items-center justify-between"
            style={{
              marginTop: '24px',
              padding: '20px 24px',
              gap: '16px',
              background: 'var(--gold-glow)',
              border: '1px dashed var(--gold-dim)',
            }}
          >
            <div className="flex items-center" style={{ gap: '12px' }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                }}
              >
                <Lock size={16} style={{ color: 'var(--bg)' }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--gold)' }}>
                  Want to customize these questions?
                </p>
                <p className="text-[var(--text-dim)] text-xs" style={{ marginTop: '4px' }}>
                  Edit questions, add your own, and re-run analysis to track changes over time.
                </p>
              </div>
            </div>
            <a
              href="/pricing?from=report"
              onClick={handlePricingClick}
              className="flex-shrink-0 font-mono text-xs flex items-center gap-2 transition-all hover:opacity-80"
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <Sparkles size={14} />
              Unlock Editing
            </a>
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
  const [showStickyUpsell, setShowStickyUpsell] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  // Track scroll to show sticky upsell as soon as user starts scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky upsell after minimal scroll (50px)
      setShowStickyUpsell(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate results for each check
  const results = readinessChecks.map(check => ({
    ...check,
    status: check.check(analysis, crawlData)
  }))

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length
  const totalChecks = results.filter(r => r.status !== 'unknown').length
  const readinessPercent = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0

  // Group by impact
  const highImpact = results.filter(r => r.impact === 'high')
  const mediumImpact = results.filter(r => r.impact === 'medium')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Shield size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Technical Readiness Check:</strong> We analyzed your website&apos;s structure, content, and metadata to determine how easily AI systems can understand and index your business. Each factor is rated by its impact on AI visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div ref={summaryRef} className="card" style={{ padding: '32px' }}>
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
              {readinessPercent}%
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
            <ReadinessCheckRow key={check.id} check={check} analysis={analysis} crawlData={crawlData} />
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
            <ReadinessCheckRow key={check.id} check={check} analysis={analysis} crawlData={crawlData} />
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

      {/* Sticky Floating Upsell - Different message for passing vs failing sites */}
      {showStickyUpsell && (
        <div
          style={{
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 50,
            padding: '16px 24px',
            background: failCount > 0
              ? 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(30,20,20,0.98) 100%)'
              : 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(20,30,20,0.98) 100%)',
            borderTop: failCount > 0 ? '1px solid var(--red-dim)' : '1px solid var(--green)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="flex items-center" style={{ gap: '16px' }}>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: failCount > 0
                    ? 'linear-gradient(135deg, var(--red) 0%, #b91c1c 100%)'
                    : 'linear-gradient(135deg, var(--green) 0%, #16a34a 100%)',
                }}
              >
                {failCount > 0 ? (
                  <XCircle size={20} style={{ color: 'white' }} />
                ) : (
                  <CheckCircle2 size={20} style={{ color: 'white' }} />
                )}
              </div>
              <div>
                {failCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      {failCount} issue{failCount > 1 ? 's' : ''} affecting AI visibility
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      Get step-by-step fixes
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      {readinessPercent}% AI ready
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      Monitor weekly to maintain your edge
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/pricing?from=report"
              onClick={handlePricingClick}
              className="font-mono text-sm flex items-center gap-2 transition-all hover:scale-105"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              <Sparkles size={16} />
              {failCount > 0 ? 'Get Fixes & Action Plans' : 'Subscribe for Weekly Monitoring'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadinessCheckRow({
  check,
  analysis,
  crawlData
}: {
  check: ReadinessCheck & { status: string }
  analysis: Analysis | null
  crawlData?: CrawlData
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusConfig = {
    pass: { icon: CheckCircle2, color: 'var(--green)', bg: 'var(--green)' },
    warning: { icon: AlertCircle, color: 'var(--amber)', bg: 'var(--amber)' },
    fail: { icon: XCircle, color: 'var(--red)', bg: 'var(--red)' },
    unknown: { icon: AlertCircle, color: 'var(--text-ghost)', bg: 'var(--text-ghost)' },
  }

  const config = statusConfig[check.status as keyof typeof statusConfig] || statusConfig.unknown
  const Icon = config.icon

  // Get detected value for each check type
  const getDetectedValue = (): string | null => {
    switch (check.id) {
      case 'business_clarity':
        return analysis?.business_name || analysis?.business_type || null
      case 'services_defined':
        return analysis?.services?.slice(0, 3).join(', ') || null
      case 'location_specified':
        return analysis?.location || null
      case 'target_audience':
        return analysis?.target_audience || null
      case 'industry_context':
        return analysis?.industry || null
      case 'key_phrases':
        return analysis?.key_phrases?.slice(0, 3).join(', ') || null
      case 'sitemap':
        return crawlData?.hasSitemap ? 'Found' : 'Not found'
      case 'page_depth':
        return crawlData?.pagesCrawled ? `${crawlData.pagesCrawled} pages` : null
      case 'schema_markup':
        return crawlData?.schemaTypes?.join(', ') || null
      case 'meta_descriptions':
        return crawlData?.hasMetaDescriptions ? 'Found' : 'Not found'
      default:
        return null
    }
  }

  const detectedValue = getDetectedValue()
  const hasDetails = detectedValue !== null

  return (
    <div
      className="bg-[var(--surface-elevated)] border border-[var(--border)]"
      style={{ padding: '20px' }}
    >
      <div
        className="flex items-start cursor-pointer"
        style={{ gap: '16px' }}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
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
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs uppercase"
                style={{ color: config.color }}
              >
                {check.status}
              </span>
              {hasDetails && (
                <ChevronDown
                  size={14}
                  className="text-[var(--text-ghost)]"
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              )}
            </div>
          </div>
          <p className="text-[var(--text-dim)] text-sm">
            {check.description}
          </p>
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && hasDetails && (
        <div
          className="border-t border-[var(--border-subtle)]"
          style={{ marginTop: '16px', paddingTop: '16px', marginLeft: '48px' }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
            <Eye size={12} className="text-[var(--text-ghost)]" />
            <span className="font-mono text-xs text-[var(--text-ghost)] uppercase">
              Detected Value
            </span>
          </div>
          <p className="text-[var(--text-mid)] text-sm font-mono" style={{ lineHeight: '1.5' }}>
            {detectedValue}
          </p>
        </div>
      )}
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
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <Users size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Competitor Analysis:</strong> These are businesses that AI assistants mentioned when answering questions relevant to your industry. Understanding who AI recommends helps identify what signals you need to compete for visibility.
            </p>
          </div>
        </div>
      </div>

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

      {/* Competitor Tracking - Mocked trend chart with frosted overlay */}
      <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div>
            <h3
              className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '4px' }}
            >
              Competitor Comparison
            </h3>
            <p className="text-[var(--text-ghost)] text-xs">
              {otherCompetitors.length + 1} competitors detected in AI responses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={12} style={{ color: 'var(--gold)' }} />
            <span
              className="font-mono text-xs"
              style={{ color: 'var(--gold)' }}
            >
              Subscribers Only
            </span>
          </div>
        </div>

        {/* Mocked Comparison Chart - Bright and visible */}
        <div
          className="relative"
          style={{ height: '280px', backgroundColor: 'var(--surface-elevated)', padding: '20px' }}
        >
          {/* Fake bar chart showing competitor mentions */}
          <svg
            viewBox="0 0 400 220"
            className="w-full h-full"
          >
            {/* Y-axis labels */}
            <text x="8" y="30" fontSize="11" fill="#888">100%</text>
            <text x="8" y="85" fontSize="11" fill="#888">75%</text>
            <text x="8" y="140" fontSize="11" fill="#888">50%</text>
            <text x="8" y="195" fontSize="11" fill="#888">25%</text>

            {/* Grid lines - visible */}
            {[30, 85, 140, 195].map((y) => (
              <line
                key={y}
                x1="45"
                y1={y}
                x2="380"
                y2={y}
                stroke="#333"
                strokeWidth="1"
              />
            ))}

            {/* Competitor bars - BRIGHT with gradients */}
            {/* #1 Competitor - Highest */}
            <rect x="60" y="40" width="50" height="160" fill="#ef4444" rx="4" />
            <text x="85" y="35" fontSize="10" fill="#ef4444" textAnchor="middle" fontWeight="bold">72%</text>

            {/* #2 Competitor */}
            <rect x="130" y="70" width="50" height="130" fill="#f59e0b" rx="4" />
            <text x="155" y="65" fontSize="10" fill="#f59e0b" textAnchor="middle">58%</text>

            {/* #3 Competitor */}
            <rect x="200" y="95" width="50" height="105" fill="#8b5cf6" rx="4" />
            <text x="225" y="90" fontSize="10" fill="#8b5cf6" textAnchor="middle">47%</text>

            {/* #4 Competitor */}
            <rect x="270" y="130" width="50" height="70" fill="#6b7280" rx="4" />
            <text x="295" y="125" fontSize="10" fill="#6b7280" textAnchor="middle">31%</text>

            {/* You - Highlighted */}
            <rect x="340" y="155" width="50" height="45" fill="#22c55e" rx="4" />
            <text x="365" y="150" fontSize="10" fill="#22c55e" textAnchor="middle" fontWeight="bold">20%</text>

            {/* X-axis labels */}
            <text x="85" y="215" fontSize="11" fill="#888" textAnchor="middle">#1</text>
            <text x="155" y="215" fontSize="11" fill="#888" textAnchor="middle">#2</text>
            <text x="225" y="215" fontSize="11" fill="#888" textAnchor="middle">#3</text>
            <text x="295" y="215" fontSize="11" fill="#888" textAnchor="middle">#4</text>
            <text x="365" y="215" fontSize="11" fill="#22c55e" textAnchor="middle" fontWeight="bold">You</text>
          </svg>

          {/* Frosted overlay - lighter to show chart */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.7) 100%)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                marginBottom: '16px',
              }}
            >
              <Users size={24} style={{ color: 'var(--bg)' }} />
            </div>
            <p className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
              See All {otherCompetitors.length + 1} Competitors
            </p>
            <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '320px', marginBottom: '20px' }}>
              Compare your AI visibility against competitors and track changes over time
            </p>
            <button
              onClick={onUpgradeClick}
              className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={14} />
              Unlock Competitor Intel
            </button>
          </div>
        </div>

        {/* Preview of blurred competitor names */}
        <div className="flex flex-wrap gap-3" style={{ marginTop: '20px', opacity: 0.4 }}>
          {otherCompetitors.slice(0, 4).map((_, index) => (
            <span
              key={index}
              className="font-mono text-xs text-[var(--text-ghost)] bg-[var(--surface-elevated)] px-3 py-1"
              style={{ filter: 'blur(3px)' }}
            >
              Competitor {String.fromCharCode(65 + index)}
            </span>
          ))}
          {otherCompetitors.length > 4 && (
            <span className="font-mono text-xs text-[var(--text-ghost)]">
              +{otherCompetitors.length - 4} more
            </span>
          )}
        </div>
      </div>

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
// BRAND AWARENESS TAB (Teaser for Free Tier)
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
  // For free tier, show teaser instead of actual data
  const isFreeUser = true // TODO: Get from subscription context

  if (isFreeUser) {
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
              <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
                <strong className="text-[var(--text)]">Brand Awareness Testing:</strong> Unlike the AI Responses tab which tests organic mentions, this feature directly asks AI assistants what they know about <strong className="text-[var(--text)]">{analysis?.business_name || domain}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Mocked Brand Recognition Preview */}
        <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <h3
              className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Brand Recognition by Platform
            </h3>
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--gold)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>
                Subscribers Only
              </span>
            </div>
          </div>

          {/* Mocked platform grid - Bright and visible */}
          <div
            className="relative"
            style={{ height: '220px', backgroundColor: 'var(--surface-elevated)', padding: '16px' }}
          >
            <div
              className="grid grid-cols-2 sm:grid-cols-4 h-full"
              style={{ gap: '16px' }}
            >
              {[
                { name: 'ChatGPT', color: '#ef4444', status: '✓', statusColor: '#22c55e' },
                { name: 'Perplexity', color: '#1FB8CD', status: '✓', statusColor: '#22c55e' },
                { name: 'Gemini', color: '#3b82f6', status: '?', statusColor: '#f59e0b' },
                { name: 'Claude', color: '#22c55e', status: '✗', statusColor: '#ef4444' },
              ].map(({ name, color, status, statusColor }) => (
                <div
                  key={name}
                  className="border"
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--surface)',
                    borderColor: color,
                    borderWidth: '2px',
                  }}
                >
                  <div className="flex items-center justify-center gap-2" style={{ marginBottom: '12px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '2px' }} />
                    <span className="font-mono text-sm" style={{ color }}>{name}</span>
                  </div>
                  <div
                    className="font-mono text-3xl font-bold"
                    style={{ color: statusColor }}
                  >
                    {status}
                  </div>
                  <div className="text-xs" style={{ marginTop: '8px', color: statusColor }}>
                    {status === '✓' ? 'Recognized' : status === '✗' ? 'Not Found' : 'Unknown'}
                  </div>
                </div>
              ))}
            </div>

            {/* Frosted overlay - lighter */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.7) 100%)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  marginBottom: '16px',
                }}
              >
                <Brain size={24} style={{ color: 'var(--bg)' }} />
              </div>
              <p className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
                Discover What AI Knows About You
              </p>
              <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '360px', marginBottom: '20px' }}>
                Find out which AI assistants recognize your brand and what they know about your services
              </p>
              <button
                onClick={onUpgradeClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                Unlock Brand Analysis
              </button>
            </div>
          </div>
        </div>

        {/* What You'll Learn */}
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
          >
            What Subscribers Learn
          </h3>

          <div className="grid sm:grid-cols-3" style={{ gap: '24px' }}>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
                <Eye size={18} className="text-[var(--green)]" />
                <span className="font-medium text-[var(--text)]">Brand Recognition</span>
              </div>
              <p className="text-[var(--text-dim)] text-sm">
                Does each AI platform recognize your brand when asked directly?
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
                <Target size={18} className="text-[var(--green)]" />
                <span className="font-medium text-[var(--text)]">Service Knowledge</span>
              </div>
              <p className="text-[var(--text-dim)] text-sm">
                Which of your services does AI know about? Find knowledge gaps.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
                <Users size={18} className="text-[var(--green)]" />
                <span className="font-medium text-[var(--text)]">Competitive Position</span>
              </div>
              <p className="text-[var(--text-dim)] text-sm">
                How does AI position you compared to your top competitor?
              </p>
            </div>
          </div>
        </div>

        {/* Why This Matters */}
        <div className="card" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '20px', letterSpacing: '0.1em' }}
          >
            Why Brand Awareness Matters
          </h3>
          <p className="text-[var(--text-mid)]" style={{ fontSize: '14px', lineHeight: '1.7' }}>
            AI assistants are trained on historical data that&apos;s typically 6-18 months old. This means your brand needs to be in their training corpus to be recommended. Brand awareness testing reveals what each AI actually knows about your business — and where the gaps are.
          </p>
        </div>
      </div>
    )
  }

  // Original code for subscribers follows...
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

  // Create a map of which platforms recognized the brand (for competitor comparison context)
  const platformRecognition = new Map<string, boolean>()
  for (const result of brandRecallResults) {
    platformRecognition.set(result.platform, result.entity_recognized)
  }

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
            {competitorCompareResults.map((result, index) => {
              const brandRecognized = platformRecognition.get(result.platform) ?? false

              return (
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
                    {brandRecognized ? (
                      <PositioningBadge positioning={result.positioning} />
                    ) : (
                      <span
                        className="font-mono text-xs"
                        style={{
                          padding: '4px 10px',
                          backgroundColor: 'var(--text-ghost)15',
                          color: 'var(--text-ghost)',
                          border: '1px solid var(--text-ghost)30',
                        }}
                      >
                        Brand Not Known
                      </span>
                    )}
                  </div>

                  {!brandRecognized ? (
                    <div
                      className="flex items-center text-[var(--text-ghost)] text-sm"
                      style={{ gap: '8px' }}
                    >
                      <AlertCircle size={14} />
                      <span>
                        Unable to compare — {platformNames[result.platform] || result.platform} doesn&apos;t have your brand in its knowledge base
                      </span>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )
            })}
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
  perplexity: '#1FB8CD',
}

const platformNames: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
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
  const [mentionsOnly, setMentionsOnly] = useState(false)
  const [showStickyUpsell, setShowStickyUpsell] = useState(false)
  const firstResponseRef = useRef<HTMLDivElement>(null)

  // Track scroll to show sticky upsell as soon as user starts scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky upsell after minimal scroll (50px)
      setShowStickyUpsell(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!responses || responses.length === 0) {
    return (
      <div className="text-center text-[var(--text-dim)]" style={{ padding: '80px 0' }}>
        <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
        <p>No AI responses recorded yet</p>
      </div>
    )
  }

  // Apply platform filter first
  let filteredResponses = platformFilter === 'all'
    ? responses
    : responses.filter(r => r.platform === platformFilter)

  // Then apply mentions filter
  if (mentionsOnly) {
    filteredResponses = filteredResponses.filter(r => r.domain_mentioned)
  }

  // Count by platform
  const platformCounts = responses.reduce((acc, r) => {
    acc[r.platform] = (acc[r.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Count mentions
  const mentionCount = responses.filter(r => r.domain_mentioned).length

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <MessageSquare size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Organic Visibility Test:</strong> We asked each AI assistant questions that a potential customer might ask (like &quot;recommend a plumber near me&quot;). These are the actual responses — look for whether your brand was mentioned organically.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="flex items-center justify-between flex-wrap border-b border-[var(--border)]"
        style={{ paddingBottom: '20px', gap: '16px' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[var(--text-dim)]" />
            <span className="text-[var(--text-dim)] font-mono text-sm">Filter by:</span>
          </div>

          {/* Mentions Only Toggle */}
          <button
            onClick={() => setMentionsOnly(!mentionsOnly)}
            className={`
              flex items-center gap-2 font-mono text-xs transition-all
              ${mentionsOnly
                ? 'bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/30'
                : 'bg-transparent text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text-mid)]'
              }
            `}
            style={{
              padding: '6px 12px',
              border: '1px solid',
            }}
          >
            <CheckCircle2 size={12} />
            Mentions only ({mentionCount})
          </button>
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

      {/* Empty state when filtering */}
      {filteredResponses.length === 0 && (
        <div className="text-center text-[var(--text-dim)]" style={{ padding: '60px 0' }}>
          <MessageSquare size={40} className="mx-auto mb-4 opacity-30" />
          <p>No responses match your filters</p>
          <button
            onClick={() => {
              setMentionsOnly(false)
              onFilterChange('all')
            }}
            className="text-[var(--green)] font-mono text-sm hover:underline"
            style={{ marginTop: '12px' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Response Cards */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {filteredResponses.map((response, index) => {
          const isExpanded = expandedIndex === index
          const truncateAt = 1200  // Increased from 500 to show more context before truncating
          const shouldTruncate = (response.response_text?.length || 0) > truncateAt

          return (
            <div
              key={index}
              ref={index === 0 ? firstResponseRef : undefined}
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

      {/* Sticky Floating Upsell - Shows when mention rate is low and user has scrolled */}
      {(() => {
        const mentionRate = responses.length > 0 ? (mentionCount / responses.length) * 100 : 0
        const shouldShowUpsell = mentionRate < 50 // Show if less than 50% mention rate

        if (!shouldShowUpsell || !showStickyUpsell) return null

        return (
          <div
            style={{
              position: 'fixed',
              bottom: '0',
              left: '0',
              right: '0',
              zIndex: 50,
              padding: '16px 24px',
              background: 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(30,25,20,0.98) 100%)',
              borderTop: '1px solid var(--gold-dim)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
              <div className="flex items-center" style={{ gap: '16px' }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--red) 0%, #b91c1c 100%)',
                  }}
                >
                  <AlertCircle size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      Only {Math.round(mentionRate)}% AI visibility
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      Get action plans to improve
                    </span>
                  </div>
                </div>
              </div>

              <a
                href="/pricing?from=report"
                onClick={handlePricingClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:scale-105"
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                <Sparkles size={16} />
                Get Fixes & Action Plans
              </a>
            </div>
          </div>
        )
      })()}
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
  responses,
  analysis,
  brandAwareness
}: {
  visibilityScore: number
  platformScores: Record<string, number>
  responses: Response[] | null
  analysis: Analysis | null
  brandAwareness?: BrandAwarenessResult[] | null
}) {
  const [showStickyUpsell, setShowStickyUpsell] = useState(false)

  // Track scroll to show sticky upsell as soon as user starts scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky upsell after minimal scroll (50px)
      setShowStickyUpsell(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate readiness score based on analysis quality
  const readinessScore = calculateReadinessScore(analysis)

  // Calculate per-platform mention stats from responses
  const platformStats = useMemo(() => {
    if (!responses) return {}

    const stats: Record<string, { mentioned: number; total: number }> = {}

    for (const response of responses) {
      if (!stats[response.platform]) {
        stats[response.platform] = { mentioned: 0, total: 0 }
      }
      stats[response.platform].total++
      if (response.domain_mentioned) {
        stats[response.platform].mentioned++
      }
    }

    return stats
  }, [responses])

  // Platform display order
  const platformOrder = ['chatgpt', 'claude', 'gemini', 'perplexity']

  // Use platformStats from responses if available, otherwise fall back to platformScores from report
  const hasResponseStats = Object.keys(platformStats).length > 0
  const orderedPlatforms = hasResponseStats
    ? platformOrder.filter(p => p in platformStats)
    : platformOrder.filter(p => p in platformScores)

  // Calculate summary metrics
  const totalQueries = responses?.length || 0
  const totalMentions = responses?.filter(r => r.domain_mentioned).length || 0
  const queryCoverage = totalQueries > 0 ? Math.round((totalMentions / totalQueries) * 100) : 0

  // Brand recognition from brand awareness data
  const brandRecallResults = brandAwareness?.filter(r => r.query_type === 'brand_recall') || []
  const recognizedPlatforms = brandRecallResults.filter(r => r.entity_recognized).length
  const totalBrandPlatforms = brandRecallResults.length

  // Service knowledge from brand awareness data
  const serviceCheckResults = brandAwareness?.filter(r => r.query_type === 'service_check') || []
  const knownServices = serviceCheckResults.filter(r => r.attribute_mentioned).length
  const totalServiceChecks = serviceCheckResults.length
  const serviceKnowledge = totalServiceChecks > 0 ? Math.round((knownServices / totalServiceChecks) * 100) : 0

  // Define metrics for the table
  const metrics = [
    {
      name: 'Query Coverage',
      current: `${queryCoverage}%`,
      description: 'Percentage of queries where your brand was mentioned',
    },
    {
      name: 'Brand Recognition',
      current: totalBrandPlatforms > 0 ? `${recognizedPlatforms}/${totalBrandPlatforms} platforms` : 'N/A',
      description: 'AI platforms that recognize your brand when asked directly',
    },
    {
      name: 'Service Knowledge',
      current: totalServiceChecks > 0 ? `${serviceKnowledge}%` : 'N/A',
      description: 'Percentage of your services that AI knows about',
    },
    {
      name: 'Website Readiness',
      current: `${readinessScore}/100`,
      description: 'How well your site is structured for AI discovery',
    },
  ]

  return (
    <div style={{ display: 'grid', gap: '40px' }}>
      {/* Description Box */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-start" style={{ gap: '16px' }}>
          <BarChart3 size={20} className="text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
              <strong className="text-[var(--text)]">Your Performance Metrics:</strong> This page shows two key measurements: <em>AI Visibility</em> tracks how often each platform mentioned your brand organically, while <em>Website Readiness</em> scores how well your site is structured for AI discovery.
            </p>
          </div>
        </div>
      </div>

      {/* Score Gauge */}
      <div
        className="bg-[var(--surface)] border border-[var(--border)]"
        style={{ padding: '40px' }}
      >
        <div className="flex justify-center" style={{ marginBottom: '24px' }}>
          <ScoreGauge score={visibilityScore} size="lg" />
        </div>

        {/* Score Explanation */}
        <div
          className="flex items-start bg-[var(--surface-elevated)] border border-[var(--border-subtle)]"
          style={{ padding: '14px 18px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', gap: '12px' }}
        >
          <Info size={16} className="text-[var(--text-dim)] flex-shrink-0" style={{ marginTop: '2px' }} />
          <p className="text-[var(--text-dim)] text-xs" style={{ lineHeight: '1.6' }}>
            <strong className="text-[var(--text-mid)]">Reach-Weighted Score:</strong> Platforms are weighted by their real-world traffic share. ChatGPT mentions count 10x more than Claude, reflecting actual user reach (~80% vs ~1% of AI referrals).
          </p>
        </div>
      </div>

      {/* Metrics Summary Table */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          Key Metrics Summary
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th
                  className="text-left font-mono text-xs text-[var(--text-dim)] uppercase"
                  style={{ padding: '12px 16px', paddingLeft: '0' }}
                >
                  Metric
                </th>
                <th
                  className="text-left font-mono text-xs text-[var(--text-dim)] uppercase"
                  style={{ padding: '12px 16px' }}
                >
                  Current
                </th>
                <th
                  className="text-left font-mono text-xs text-[var(--text-dim)] uppercase hidden sm:table-cell"
                  style={{ padding: '12px 16px' }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, index) => (
                <tr key={index} className="border-b border-[var(--border-subtle)]">
                  <td
                    className="text-[var(--text)] font-medium"
                    style={{ padding: '16px', paddingLeft: '0' }}
                  >
                    {metric.name}
                  </td>
                  <td
                    className="text-[var(--green)] font-mono"
                    style={{ padding: '16px' }}
                  >
                    {metric.current}
                  </td>
                  <td
                    className="text-[var(--text-dim)] text-sm hidden sm:table-cell"
                    style={{ padding: '16px' }}
                  >
                    {metric.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Platform Visibility Gauges */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '8px', letterSpacing: '0.1em' }}
        >
          AI Visibility by Platform
        </h3>
        <p className="text-[var(--text-ghost)] text-xs" style={{ marginBottom: '32px' }}>
          How often each AI mentioned your brand when answering questions.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '24px' }}>
          {orderedPlatforms.map((platform) => {
            // Use response stats if available, otherwise use platformScores from report
            const stats = hasResponseStats ? platformStats[platform] : null
            const score = stats
              ? (stats.total > 0 ? Math.round((stats.mentioned / stats.total) * 100) : 0)
              : (platformScores[platform] ?? 0)
            const color = platformColors[platform] || 'var(--text-dim)'

            return (
              <div
                key={platform}
                style={{ textAlign: 'center' }}
              >
                {/* Circular Gauge */}
                <div
                  className="relative"
                  style={{ width: '140px', height: '140px', marginBottom: '16px', marginLeft: 'auto', marginRight: 'auto' }}
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
                      stroke={color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${score * 2.64} 264`}
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dasharray 1s ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="font-mono font-medium"
                      style={{ fontSize: '32px', color }}
                    >
                      {score}%
                    </span>
                  </div>
                </div>

                {/* Platform Name */}
                <div className="flex items-center justify-center gap-2" style={{ marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: color,
                    }}
                  />
                  <span className="font-mono text-sm text-[var(--text)]">
                    {platformNames[platform] || platform}
                  </span>
                </div>

                {/* Mention Count */}
                <p className="text-[var(--text-dim)] text-xs">
                  {stats ? `${stats.mentioned}/${stats.total} questions mentioned` : `Score: ${score}%`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trend Chart - Mocked with frosted overlay for free tier */}
      <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h3
            className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            Visibility Trends
          </h3>
          <div className="flex items-center gap-2">
            <Lock size={12} style={{ color: 'var(--gold)' }} />
            <span
              className="font-mono text-xs"
              style={{ color: 'var(--gold)' }}
            >
              Subscribers Only
            </span>
          </div>
        </div>

        {/* Mocked Chart - Shows what subscribers see */}
        <div
          className="relative"
          style={{ height: '260px', backgroundColor: 'var(--surface-elevated)', padding: '20px' }}
        >
          {/* Fake chart data visualization - Bright and visible */}
          <svg
            viewBox="0 0 400 180"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Background gradient */}
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines - more visible */}
            {[20, 60, 100, 140].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke="#333"
                strokeWidth="1"
              />
            ))}

            {/* Y-axis labels */}
            <text x="5" y="25" fontSize="10" fill="#666">100%</text>
            <text x="5" y="65" fontSize="10" fill="#666">75%</text>
            <text x="5" y="105" fontSize="10" fill="#666">50%</text>
            <text x="5" y="145" fontSize="10" fill="#666">25%</text>

            {/* Area fill under ChatGPT line */}
            <polygon
              points="40,130 90,110 140,118 190,95 240,100 290,80 340,65 390,55 390,160 40,160"
              fill="url(#chartGradient)"
            />

            {/* ChatGPT trend line - BRIGHT */}
            <polyline
              points="40,130 90,110 140,118 190,95 240,100 290,80 340,65 390,55"
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* ChatGPT data points */}
            <circle cx="40" cy="130" r="4" fill="#ef4444" />
            <circle cx="90" cy="110" r="4" fill="#ef4444" />
            <circle cx="140" cy="118" r="4" fill="#ef4444" />
            <circle cx="190" cy="95" r="4" fill="#ef4444" />
            <circle cx="240" cy="100" r="4" fill="#ef4444" />
            <circle cx="290" cy="80" r="4" fill="#ef4444" />
            <circle cx="340" cy="65" r="4" fill="#ef4444" />
            <circle cx="390" cy="55" r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />

            {/* Perplexity trend line - BRIGHT */}
            <polyline
              points="40,145 90,138 140,132 190,122 240,108 290,100 340,88 390,72"
              fill="none"
              stroke="#1FB8CD"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Gemini trend line - BRIGHT */}
            <polyline
              points="40,152 90,148 140,142 190,138 240,130 290,122 340,108 390,100"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Claude trend line - BRIGHT */}
            <polyline
              points="40,158 90,154 140,155 190,148 240,142 290,138 340,130 390,118"
              fill="none"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* X-axis labels */}
          <div
            className="absolute bottom-2 left-12 right-4 flex justify-between text-[var(--text-mid)] font-mono text-xs"
          >
            <span>Week 1</span>
            <span>Week 2</span>
            <span>Week 3</span>
            <span>Week 4</span>
            <span>Week 5</span>
          </div>

          {/* Frosted overlay - lighter to show chart through */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.7) 100%)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                marginBottom: '16px',
              }}
            >
              <Lock size={24} style={{ color: 'var(--bg)' }} />
            </div>
            <p className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
              Track Your Progress Over Time
            </p>
            <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '320px', marginBottom: '20px' }}>
              Subscribers get weekly scans to track how your AI visibility changes over time
            </p>
            <a
              href="/pricing?from=report"
              onClick={handlePricingClick}
              className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <Sparkles size={14} />
              Unlock Tracking
            </a>
          </div>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap items-center justify-center gap-4"
          style={{ marginTop: '20px', opacity: 0.4 }}
        >
          {[
            { name: 'ChatGPT', color: 'var(--red)' },
            { name: 'Perplexity', color: '#1FB8CD' },
            { name: 'Gemini', color: 'var(--blue)' },
            { name: 'Claude', color: 'var(--green)' },
          ].map(({ name, color }) => (
            <div key={name} className="flex items-center gap-2">
              <span style={{ width: '12px', height: '3px', backgroundColor: color }} />
              <span className="font-mono text-xs text-[var(--text-dim)]">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Floating Upsell - Shows when visibility is low and user has scrolled */}
      {(() => {
        const shouldShowUpsell = queryCoverage < 50 // Show if less than 50% query coverage

        if (!shouldShowUpsell || !showStickyUpsell) return null

        return (
          <div
            style={{
              position: 'fixed',
              bottom: '0',
              left: '0',
              right: '0',
              zIndex: 50,
              padding: '16px 24px',
              background: 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(30,25,20,0.98) 100%)',
              borderTop: '1px solid var(--gold-dim)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
              <div className="flex items-center" style={{ gap: '16px' }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--red) 0%, #b91c1c 100%)',
                  }}
                >
                  <AlertCircle size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text)] font-medium">
                      Only {queryCoverage}% AI visibility
                    </span>
                    <span className="text-[var(--text-ghost)]">•</span>
                    <span className="text-[var(--text-dim)] text-sm">
                      Get action plans to improve
                    </span>
                  </div>
                </div>
              </div>

              <a
                href="/pricing?from=report"
                onClick={handlePricingClick}
                className="font-mono text-sm flex items-center gap-2 transition-all hover:scale-105"
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                <Sparkles size={16} />
                Get Fixes & Action Plans
              </a>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ============================================
// LOCKED TAB (Enhanced with frosted mockup preview)
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
  // Check if this is Action Plans or PRD to show appropriate mockup
  const isActionPlans = title.toLowerCase().includes('action')
  const isPRD = title.toLowerCase().includes('prd')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Mocked Content Preview */}
      <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div className="flex items-center gap-3">
            <Icon size={20} className="text-[var(--text-dim)]" />
            <h3
              className="text-[var(--text-dim)] font-mono uppercase tracking-wider"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={12} style={{ color: 'var(--gold)' }} />
            <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>
              Subscribers Only
            </span>
          </div>
        </div>

        {/* Mocked preview content - BRIGHT and visible */}
        <div className="relative" style={{ minHeight: '340px', backgroundColor: 'var(--surface-elevated)', padding: '20px' }}>
          {/* Fake content based on type */}
          <div>
            {isActionPlans ? (
              // Action Plans mockup - BRIGHT
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  { priority: 'HIGH', action: 'Add schema markup for LocalBusiness', impact: '+25%', priorityColor: '#ef4444' },
                  { priority: 'HIGH', action: 'Create FAQ page targeting AI queries', impact: '+20%', priorityColor: '#ef4444' },
                  { priority: 'MED', action: 'Add structured service descriptions', impact: '+15%', priorityColor: '#f59e0b' },
                  { priority: 'MED', action: 'Improve meta descriptions for AI crawlers', impact: '+10%', priorityColor: '#f59e0b' },
                  { priority: 'LOW', action: 'Add customer testimonials with schema', impact: '+8%', priorityColor: '#22c55e' },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center border"
                    style={{
                      padding: '14px 18px',
                      gap: '14px',
                      backgroundColor: 'var(--surface)',
                      borderColor: item.priorityColor,
                      borderLeftWidth: '4px',
                    }}
                  >
                    <span
                      className="font-mono text-xs px-3 py-1 flex-shrink-0 font-bold"
                      style={{
                        backgroundColor: `${item.priorityColor}20`,
                        color: item.priorityColor,
                      }}
                    >
                      {item.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-mid)] text-sm">{item.action}</p>
                    </div>
                    <span
                      className="font-mono text-sm font-bold flex-shrink-0"
                      style={{ color: '#22c55e' }}
                    >
                      {item.impact}
                    </span>
                  </div>
                ))}
              </div>
            ) : isPRD ? (
              // PRD mockup - BRIGHT
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="border" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderColor: '#22c55e', borderWidth: '2px' }}>
                  <div className="font-mono text-xs uppercase font-bold" style={{ marginBottom: '12px', color: '#22c55e' }}>
                    Product Requirements Document
                  </div>
                  <h4 className="text-[var(--text)] font-medium text-lg" style={{ marginBottom: '8px' }}>
                    AI Visibility Enhancement PRD
                  </h4>
                  <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.6' }}>
                    Technical implementation guide for improving visibility in AI assistant responses...
                  </p>
                </div>
                <div className="grid sm:grid-cols-2" style={{ gap: '12px' }}>
                  {[
                    { section: 'Schema Implementation', color: '#ef4444', items: 4 },
                    { section: 'Content Structure', color: '#f59e0b', items: 3 },
                    { section: 'Technical SEO', color: '#3b82f6', items: 5 },
                    { section: 'Monitoring Setup', color: '#22c55e', items: 2 },
                  ].map(({ section, color, items }) => (
                    <div
                      key={section}
                      className="border"
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--surface)',
                        borderColor: color,
                        borderLeftWidth: '4px',
                      }}
                    >
                      <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
                        <FileCode size={16} style={{ color }} />
                        <span className="font-mono text-sm font-medium" style={{ color }}>{section}</span>
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">{items} implementation tasks</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Generic mockup - BRIGHT
              <div className="grid" style={{ gap: '12px' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border"
                    style={{
                      padding: '18px',
                      backgroundColor: 'var(--surface)',
                      borderColor: '#22c55e',
                      borderLeftWidth: '4px',
                    }}
                  >
                    <div className="h-4 rounded" style={{ width: '40%', marginBottom: '10px', backgroundColor: '#333' }} />
                    <div className="h-3 rounded" style={{ width: '90%', marginBottom: '6px', backgroundColor: '#222' }} />
                    <div className="h-3 rounded" style={{ width: '75%', backgroundColor: '#222' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Frosted overlay with CTA - lighter */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.75) 100%)',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                marginBottom: '20px',
              }}
            >
              <Icon size={28} style={{ color: 'var(--bg)' }} />
            </div>
            <h3
              className="text-xl font-medium text-[var(--text)]"
              style={{ marginBottom: '12px' }}
            >
              {title}
            </h3>
            <p
              className="text-[var(--text-dim)] text-sm text-center"
              style={{ marginBottom: '24px', maxWidth: '400px' }}
            >
              {description}
            </p>
            <button
              onClick={onUpgrade}
              className="font-mono text-sm flex items-center gap-2 transition-all hover:opacity-90"
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
                color: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={16} />
              Unlock {title}
            </button>
          </div>
        </div>
      </div>

      {/* What's Included */}
      <div className="card" style={{ padding: '32px' }}>
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '24px', letterSpacing: '0.1em' }}
        >
          What&apos;s Included
        </h3>

        <div className="grid sm:grid-cols-2" style={{ gap: '20px' }}>
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--green)/10',
                }}
              >
                <CheckCircle2 size={14} className="text-[var(--green)]" />
              </div>
              <span className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.5' }}>
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// UTILITIES
// ============================================

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
