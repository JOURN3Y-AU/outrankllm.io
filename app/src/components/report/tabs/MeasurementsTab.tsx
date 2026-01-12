'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Lock, AlertCircle, Sparkles, Info, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ScoreGauge } from '../ScoreGauge'
import { MultiLineTrendChart, CompetitorMentionsTrendChart, type MultiLineSeries, type CompetitorMentionsSeries } from '../TrendChart'
import type { Response, Analysis, BrandAwarenessResult } from '../shared'
import { platformColors, platformNames, calculateReadinessScore, handlePricingClick } from '../shared'

interface ScoreSnapshot {
  id: string
  run_id: string
  visibility_score: number
  chatgpt_score: number | null
  claude_score: number | null
  gemini_score: number | null
  perplexity_score: number | null
  chatgpt_mentions: number | null
  claude_mentions: number | null
  gemini_mentions: number | null
  perplexity_mentions: number | null
  query_coverage: number | null
  total_mentions: number | null
  recorded_at: string
}

interface CompetitorSnapshot {
  run_id: string
  recorded_at: string
  domain_mentions: number
  competitors: { name: string; count: number }[]
}

export function MeasurementsTab({
  visibilityScore,
  platformScores,
  responses,
  analysis,
  brandAwareness,
  isSubscriber = false,
  currentRunId,
  domain,
  domainSubscriptionId,
}: {
  visibilityScore: number
  platformScores: Record<string, number>
  responses: Response[] | null
  analysis: Analysis | null
  brandAwareness?: BrandAwarenessResult[] | null
  isSubscriber?: boolean
  currentRunId?: string
  domain?: string
  domainSubscriptionId?: string | null
}) {
  const [showStickyUpsell, setShowStickyUpsell] = useState(false)
  const [rawTrendData, setRawTrendData] = useState<ScoreSnapshot[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [rawCompetitorData, setRawCompetitorData] = useState<CompetitorSnapshot[]>([])
  const [competitorTopNames, setCompetitorTopNames] = useState<string[]>([])
  const [competitorLoading, setCompetitorLoading] = useState(false)

  // Fetch trend data for subscribers
  useEffect(() => {
    if (!isSubscriber) return

    const fetchTrends = async () => {
      setTrendLoading(true)
      try {
        const params = new URLSearchParams({ limit: '12' })
        if (domainSubscriptionId) {
          params.set('domain_subscription_id', domainSubscriptionId)
        }
        const res = await fetch(`/api/trends?${params}`)
        if (res.ok) {
          const data = await res.json()
          setRawTrendData(data.snapshots || [])
        }
      } catch (error) {
        console.error('Error fetching trends:', error)
      } finally {
        setTrendLoading(false)
      }
    }

    fetchTrends()
  }, [isSubscriber, domainSubscriptionId])

  // Fetch competitor trend data for subscribers
  useEffect(() => {
    if (!isSubscriber) return

    const fetchCompetitorTrends = async () => {
      setCompetitorLoading(true)
      try {
        const params = new URLSearchParams({ limit: '12' })
        if (domainSubscriptionId) {
          params.set('domain_subscription_id', domainSubscriptionId)
        }
        const res = await fetch(`/api/trends/competitors?${params}`)
        if (res.ok) {
          const data = await res.json()
          setRawCompetitorData(data.snapshots || [])
          setCompetitorTopNames(data.topCompetitors || [])
        }
      } catch (error) {
        console.error('Error fetching competitor trends:', error)
      } finally {
        setCompetitorLoading(false)
      }
    }

    fetchCompetitorTrends()
  }, [isSubscriber, domainSubscriptionId])

  // Filter trend data to only show data up to and including the current report
  // This ensures the trend chart values match the gauges shown above it
  const trendData = useMemo(() => {
    if (!currentRunId || rawTrendData.length === 0) return rawTrendData

    // Find the index of the current report in the trend data
    const currentIndex = rawTrendData.findIndex(s => s.run_id === currentRunId)

    // If current report not found in trend data, show all data
    if (currentIndex === -1) return rawTrendData

    // Return only data up to and including the current report
    return rawTrendData.slice(0, currentIndex + 1)
  }, [rawTrendData, currentRunId])

  // Filter competitor data to only show data up to and including the current report
  const competitorData = useMemo(() => {
    if (!currentRunId || rawCompetitorData.length === 0) return rawCompetitorData

    const currentIndex = rawCompetitorData.findIndex(s => s.run_id === currentRunId)
    if (currentIndex === -1) return rawCompetitorData

    return rawCompetitorData.slice(0, currentIndex + 1)
  }, [rawCompetitorData, currentRunId])

  // Build competitor chart series - domain + top 5 competitors
  const competitorSeries = useMemo((): CompetitorMentionsSeries[] => {
    if (competitorData.length === 0) return []

    // Domain series
    const domainSeries: CompetitorMentionsSeries = {
      name: domain || 'Your Domain',
      isDomain: true,
      data: competitorData.map(s => ({
        date: s.recorded_at,
        value: s.domain_mentions,
      })),
    }

    // Top 5 competitor series
    const competitorSeriesList: CompetitorMentionsSeries[] = competitorTopNames.slice(0, 5).map(name => ({
      name,
      data: competitorData.map(s => {
        const comp = s.competitors.find(c => c.name === name)
        return {
          date: s.recorded_at,
          value: comp?.count || 0,
        }
      }),
    }))

    return [domainSeries, ...competitorSeriesList]
  }, [competitorData, competitorTopNames, domain])

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

      {/* Trend Chart - Real data for subscribers, mocked preview for free */}
      <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.1em' }}
          >
            Visibility Trends
          </h3>
          {!isSubscriber && (
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--gold)' }} />
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--gold)' }}
              >
                Subscribers Only
              </span>
            </div>
          )}
        </div>
        <p className="text-[var(--text-ghost)] text-xs" style={{ marginBottom: '24px' }}>
          AI Visibility Score and total mentions over time
        </p>

        {isSubscriber ? (
          // Subscriber view: Real trend data
          <div>
            {trendLoading ? (
              <div
                className="flex items-center justify-center text-[var(--text-dim)]"
                style={{ height: '200px' }}
              >
                Loading trends...
              </div>
            ) : trendData.length === 0 ? (
              // No data yet - first scan
              <div
                className="flex flex-col items-center justify-center bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '40px 20px' }}
              >
                <TrendingUp size={32} className="text-[var(--green)]" style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p className="text-[var(--text)] font-medium" style={{ marginBottom: '8px' }}>
                  Your First Scan
                </p>
                <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '320px' }}>
                  Trend data will appear here after your next scheduled scan. Check back in a week to see how your visibility changes over time.
                </p>
              </div>
            ) : (
              // Real trend chart - full width with dual axes
              // Left axis: Overall visibility score (0-100) | Right axis: Platform mentions (absolute count)
              <div
                className="bg-[var(--surface-elevated)] border border-[var(--border)]"
                style={{ padding: '24px' }}
              >
                <MultiLineTrendChart
                  title="Visibility Over Time"
                  height={300}
                  rightAxisLabel="Mentions"
                  rightAxisUnit=""
                  series={[
                    // Overall visibility score (left axis - 0-100)
                    {
                      key: 'overall',
                      name: 'AI Visibility Score',
                      color: '#ffffff',
                      isOverall: true,
                      data: trendData.map(s => ({
                        date: s.recorded_at,
                        value: Number(s.visibility_score),
                      })),
                    },
                    // Per-platform mentions (right axis - absolute counts)
                    {
                      key: 'chatgpt',
                      name: 'ChatGPT',
                      color: '#ef4444',
                      data: trendData.map(s => ({
                        date: s.recorded_at,
                        value: Number(s.chatgpt_mentions ?? 0),
                      })),
                    },
                    {
                      key: 'perplexity',
                      name: 'Perplexity',
                      color: '#1FB8CD',
                      data: trendData.map(s => ({
                        date: s.recorded_at,
                        value: Number(s.perplexity_mentions ?? 0),
                      })),
                    },
                    {
                      key: 'gemini',
                      name: 'Gemini',
                      color: '#3b82f6',
                      data: trendData.map(s => ({
                        date: s.recorded_at,
                        value: Number(s.gemini_mentions ?? 0),
                      })),
                    },
                    {
                      key: 'claude',
                      name: 'Claude',
                      color: '#22c55e',
                      data: trendData.map(s => ({
                        date: s.recorded_at,
                        value: Number(s.claude_mentions ?? 0),
                      })),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          // Free user view: Mocked chart with frosted overlay
          <>
            <div
              className="relative"
              style={{ height: '260px', backgroundColor: 'var(--surface-elevated)', padding: '20px' }}
            >
              {/* Fake chart data visualization */}
              <svg
                viewBox="0 0 400 180"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--green)" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
                  </linearGradient>
                </defs>

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

                <text x="5" y="25" fontSize="10" fill="#666">100%</text>
                <text x="5" y="65" fontSize="10" fill="#666">75%</text>
                <text x="5" y="105" fontSize="10" fill="#666">50%</text>
                <text x="5" y="145" fontSize="10" fill="#666">25%</text>

                <polygon
                  points="40,130 90,110 140,118 190,95 240,100 290,80 340,65 390,55 390,160 40,160"
                  fill="url(#chartGradient)"
                />

                <polyline
                  points="40,130 90,110 140,118 190,95 240,100 290,80 340,65 390,55"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="390" cy="55" r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />

                <polyline
                  points="40,145 90,138 140,132 190,122 240,108 290,100 340,88 390,72"
                  fill="none"
                  stroke="#1FB8CD"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <polyline
                  points="40,152 90,148 140,142 190,138 240,130 290,122 340,108 390,100"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <polyline
                  points="40,158 90,154 140,155 190,148 240,142 290,138 340,130 390,118"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div
                className="absolute bottom-2 left-12 right-4 flex justify-between text-[var(--text-mid)] font-mono text-xs"
              >
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
                <span>Week 5</span>
              </div>

              {/* Frosted overlay */}
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
          </>
        )}

        {/* Legend - only show for free users */}
        {!isSubscriber && (
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
        )}
      </div>

      {/* Competitor Mentions Trend Chart - Subscribers only */}
      {isSubscriber && (
        <div className="card relative overflow-hidden" style={{ padding: '32px' }}>
          <h3
            className="text-[var(--green)] font-mono uppercase tracking-wider"
            style={{ fontSize: '11px', marginBottom: '8px', letterSpacing: '0.1em' }}
          >
            Mentions vs Competitors
          </h3>
          <p className="text-[var(--text-ghost)] text-xs" style={{ marginBottom: '24px' }}>
            Your domain compared to top 5 competitors by total mentions
          </p>

          {competitorLoading ? (
            <div
              className="flex items-center justify-center text-[var(--text-dim)]"
              style={{ height: '200px' }}
            >
              Loading competitor data...
            </div>
          ) : competitorSeries.length === 0 || competitorData.length === 0 ? (
            // No data yet
            <div
              className="flex flex-col items-center justify-center bg-[var(--surface-elevated)] border border-[var(--border)]"
              style={{ padding: '40px 20px' }}
            >
              <TrendingUp size={32} className="text-[var(--green)]" style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p className="text-[var(--text)] font-medium" style={{ marginBottom: '8px' }}>
                Competitor Tracking Coming Soon
              </p>
              <p className="text-[var(--text-dim)] text-sm text-center" style={{ maxWidth: '320px' }}>
                See how your brand mentions compare to competitors over time. Data will appear after your next scan.
              </p>
            </div>
          ) : (
            // Real competitor trend chart
            <div
              className="bg-[var(--surface-elevated)] border border-[var(--border)]"
              style={{ padding: '24px' }}
            >
              <CompetitorMentionsTrendChart
                domain={domain || 'Your Domain'}
                series={competitorSeries}
                height={280}
                title="Absolute Mentions Over Time"
              />
            </div>
          )}
        </div>
      )}

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
