'use client'

import { useState } from 'react'
import { Briefcase, Code, Building2, Lock, ChevronRight, Eye, Target, Zap, Globe, CheckCircle2, AlertCircle, XCircle, Users, TrendingUp, Crown, Minus } from 'lucide-react'
import type { Analysis, TabId, Response, CrawlData, Competitor } from '../shared'
import { platformColors, platformNames } from '../shared'

// Readiness check logic (duplicated from AIReadinessTab for calculation)
const calculateReadinessResults = (analysis: Analysis | null, crawlData?: CrawlData) => {
  const checks = [
    { id: 'business_clarity', check: () => analysis?.business_name && analysis?.business_type !== 'Business website' ? 'pass' : analysis?.business_type !== 'Business website' ? 'warning' : 'fail' },
    { id: 'services_defined', check: () => analysis?.services && analysis.services.length >= 3 ? 'pass' : analysis?.services && analysis.services.length > 0 ? 'warning' : 'fail' },
    { id: 'location_specified', check: () => analysis?.location ? 'pass' : 'fail' },
    { id: 'target_audience', check: () => analysis?.target_audience ? 'pass' : 'fail' },
    { id: 'industry_context', check: () => analysis?.industry && analysis.industry !== 'General' ? 'pass' : 'warning' },
    { id: 'key_phrases', check: () => analysis?.key_phrases && analysis.key_phrases.length >= 5 ? 'pass' : analysis?.key_phrases && analysis.key_phrases.length > 0 ? 'warning' : 'fail' },
    { id: 'sitemap', check: () => crawlData?.hasSitemap ? 'pass' : 'fail' },
    { id: 'page_depth', check: () => crawlData?.pagesCrawled && crawlData.pagesCrawled >= 10 ? 'pass' : crawlData?.pagesCrawled && crawlData.pagesCrawled >= 5 ? 'warning' : 'fail' },
    { id: 'schema_markup', check: () => crawlData?.schemaTypes && crawlData.schemaTypes.length > 0 ? 'pass' : 'fail' },
    { id: 'meta_descriptions', check: () => crawlData?.hasMetaDescriptions ? 'pass' : 'warning' },
  ]

  const results = checks.map(c => ({ id: c.id, status: analysis || crawlData ? c.check() : 'unknown' }))
  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length
  const totalChecks = results.filter(r => r.status !== 'unknown').length
  const percent = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0

  return { passCount, failCount, warningCount, percent }
}

// Score status message based on percentage (same thresholds as MeasurementsTab, but friendlier for summary)
const getScoreStatus = (score: number): { message: string; color: string } => {
  if (score < 20) return { message: 'Low, but fixable!', color: 'var(--text-dim)' }
  if (score < 40) return { message: 'Building momentum', color: 'var(--amber)' }
  if (score < 60) return { message: 'Ahead of most', color: 'var(--green)' }
  return { message: 'Strong visibility', color: 'var(--green)' }
}

// Competitor position logic
const getCompetitorPosition = (competitors: Competitor[], domain: string, responses: Response[] | null): { label: string; color: string; icon: typeof Crown } => {
  // Calculate our mention count from responses
  const ourMentions = responses?.filter(r => r.domain_mentioned).length || 0

  // Find the top competitor's mention count
  const topCompetitorCount = competitors.length > 0 ? competitors[0].count : 0

  if (ourMentions === 0) {
    return { label: 'No Mentions', color: 'var(--text-dim)', icon: Minus }
  }

  if (competitors.length === 0 || ourMentions > topCompetitorCount) {
    return { label: 'Leading', color: 'var(--green)', icon: Crown }
  }

  // Within 20% of top competitor = Stronger
  if (ourMentions >= topCompetitorCount * 0.8) {
    return { label: 'Stronger', color: 'var(--green)', icon: TrendingUp }
  }

  // Within 50% = Equal
  if (ourMentions >= topCompetitorCount * 0.5) {
    return { label: 'Equal', color: 'var(--amber)', icon: Minus }
  }

  return { label: 'Weaker', color: 'var(--red)', icon: TrendingUp }
}

export function StartHereTab({
  analysis,
  domain,
  onContinue,
  isSubscriber = false,
  responses = null,
  crawlData,
  competitors = [],
  platformScores = {},
}: {
  analysis: Analysis | null
  domain: string
  onContinue: () => void
  isSubscriber?: boolean
  responses?: Response[] | null
  crawlData?: CrawlData
  competitors?: Competitor[]
  platformScores?: Record<string, number>
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

  // Calculate metrics
  const readiness = calculateReadinessResults(analysis, crawlData)
  const competitorPosition = getCompetitorPosition(competitors, domain, responses)

  // Platform scores with <5% displayed as "<5%"
  const formatScore = (score: number | undefined): string => {
    const s = score || 0
    if (s < 5) return '<5%'
    return `${Math.round(s)}%`
  }

  const chatgptScore = platformScores.chatgpt || 0
  const claudeScore = platformScores.claude || 0
  const geminiScore = platformScores.gemini || 0
  const perplexityScore = platformScores.perplexity || 0

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Welcome Header */}
      <div style={{ padding: '20px 0 0' }}>
        <h2
          className="text-2xl font-medium text-[var(--text)]"
          style={{ marginBottom: '12px' }}
        >
          Your AI Visibility Summary for{' '}
          <span className="text-[var(--green)]">{analysis?.business_name || domain}</span>
        </h2>
        <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.6' }}>
          We crawled your website to understand your business, asked ChatGPT, Claude, Gemini, and Perplexity questions your customers ask, and identified who else is getting recommended instead of you.
        </p>
      </div>

      {/* Metrics Summary - 3 Groups */}
      <div
        className="flex flex-wrap"
        style={{ gap: '16px' }}
      >
        {/* Group 1: AI Readiness */}
        <div
          className="bg-[var(--surface)] border border-[var(--border)] text-center"
          style={{ padding: '20px', minWidth: '180px', flex: '1 1 180px' }}
        >
          <div className="flex items-center justify-center gap-2" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={16} className="text-[var(--green)]" />
            <span className="font-mono text-xs text-[var(--green)] uppercase tracking-wide">AI Readiness Check</span>
          </div>
          <div className="font-mono text-3xl text-[var(--text)]" style={{ marginBottom: '12px' }}>
            {readiness.percent}%
          </div>
          <div className="flex items-center justify-center gap-4 text-xs">
            <span style={{ color: 'var(--green)' }}>{readiness.passCount} passed</span>
            <span style={{ color: 'var(--amber)' }}>{readiness.warningCount} warnings</span>
            <span style={{ color: 'var(--red)' }}>{readiness.failCount} failed</span>
          </div>
        </div>

        {/* Group 2: AI Platform Scores */}
        <div
          className="bg-[var(--surface)] border border-[var(--border)]"
          style={{ padding: '20px', flex: '2 1 400px' }}
        >
          <div className="flex items-center justify-center gap-2" style={{ marginBottom: '16px' }}>
            <Eye size={16} className="text-[var(--green)]" />
            <span className="font-mono text-xs text-[var(--green)] uppercase tracking-wide">AI Visibility by Platform</span>
          </div>
          <div
            className="grid text-center"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}
          >
            {/* ChatGPT */}
            <div>
              <div className="font-mono text-3xl text-[var(--text)]" style={{ marginBottom: '4px' }}>
                {formatScore(chatgptScore)}
              </div>
              <div className="flex items-center justify-center gap-1" style={{ marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors.chatgpt }} />
                <span className="text-xs text-[var(--text-dim)]">ChatGPT</span>
              </div>
              <div className="text-xs" style={{ color: getScoreStatus(chatgptScore).color }}>
                {getScoreStatus(chatgptScore).message}
              </div>
            </div>

            {/* Claude */}
            <div>
              <div className="font-mono text-3xl text-[var(--text)]" style={{ marginBottom: '4px' }}>
                {formatScore(claudeScore)}
              </div>
              <div className="flex items-center justify-center gap-1" style={{ marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors.claude }} />
                <span className="text-xs text-[var(--text-dim)]">Claude</span>
              </div>
              <div className="text-xs" style={{ color: getScoreStatus(claudeScore).color }}>
                {getScoreStatus(claudeScore).message}
              </div>
            </div>

            {/* Gemini */}
            <div>
              <div className="font-mono text-3xl text-[var(--text)]" style={{ marginBottom: '4px' }}>
                {formatScore(geminiScore)}
              </div>
              <div className="flex items-center justify-center gap-1" style={{ marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors.gemini }} />
                <span className="text-xs text-[var(--text-dim)]">Gemini</span>
              </div>
              <div className="text-xs" style={{ color: getScoreStatus(geminiScore).color }}>
                {getScoreStatus(geminiScore).message}
              </div>
            </div>

            {/* Perplexity */}
            <div>
              <div className="font-mono text-3xl text-[var(--text)]" style={{ marginBottom: '4px' }}>
                {formatScore(perplexityScore)}
              </div>
              <div className="flex items-center justify-center gap-1" style={{ marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors.perplexity }} />
                <span className="text-xs text-[var(--text-dim)]">Perplexity</span>
              </div>
              <div className="text-xs" style={{ color: getScoreStatus(perplexityScore).color }}>
                {getScoreStatus(perplexityScore).message}
              </div>
            </div>
          </div>
        </div>

        {/* Group 3: Competitor Position */}
        <div
          className="bg-[var(--surface)] border border-[var(--border)] text-center"
          style={{ padding: '20px', minWidth: '180px', flex: '1 1 180px' }}
        >
          <div className="flex items-center justify-center gap-2" style={{ marginBottom: '16px' }}>
            <Users size={16} className="text-[var(--green)]" />
            <span className="font-mono text-xs text-[var(--green)] uppercase tracking-wide">vs Competitors</span>
          </div>
          <div className="flex items-center justify-center gap-2" style={{ marginBottom: '12px' }}>
            <competitorPosition.icon size={24} style={{ color: competitorPosition.color }} />
            <span className="font-mono text-2xl" style={{ color: competitorPosition.color, whiteSpace: 'nowrap' }}>
              {competitorPosition.label}
            </span>
          </div>
          <div className="text-xs text-[var(--text-dim)]">
            {competitors.length > 0 ? `${competitors.length} competitors found` : 'No competitors detected'}
          </div>
        </div>
      </div>

      {/* What's next guidance */}
      <div className="text-[var(--text-mid)]" style={{ lineHeight: '1.7', fontSize: '14px' }}>
        {isSubscriber ? (
          <p>
            Use the tabs above to explore your full report — from technical readiness checks to the actual AI responses and competitive analysis. You can manage your subscription and add more domains from your{' '}
            <a href="/dashboard" className="text-[var(--green)] hover:underline">Dashboard</a>.
          </p>
        ) : (
          <p>
            Use the tabs above to explore your full report — from technical readiness checks to the actual AI responses and competitive analysis. Select your role below for a tailored guide on getting the most from this analysis.
          </p>
        )}
      </div>

      {/* Persona Pills - Inline selection */}
      <div
        className="bg-[var(--surface-elevated)] border border-[var(--border)]"
        style={{ padding: '24px' }}
      >
        <h3
          className="text-[var(--green)] font-mono uppercase tracking-wider"
          style={{ fontSize: '11px', marginBottom: '8px', letterSpacing: '0.1em' }}
        >
          Tailored Guidance
        </h3>
        <p className="text-[var(--text-mid)] text-sm" style={{ marginBottom: '16px', lineHeight: '1.6' }}>
          Different roles care about different parts of this report. Select yours and we&apos;ll show you which tabs matter most and what to look for.
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

          {/* Locked features teaser - only show for non-subscribers */}
          {!isSubscriber && (
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
          )}
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
