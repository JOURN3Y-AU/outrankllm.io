'use client'

import { useState } from 'react'
import { Brain, Filter, CheckCircle2, XCircle, AlertCircle, Lock, Eye, Target, Sparkles } from 'lucide-react'
import type { Analysis, BrandAwarenessResult } from '../shared'
import { platformColors, platformNames, formatResponseText, FilterButton, EnrichmentLoading } from '../shared'

type EnrichmentStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'not_applicable'

export function BrandAwarenessTab({
  brandAwareness,
  analysis,
  domain,
  platformFilter,
  onFilterChange,
  onUpgradeClick,
  isSubscriber = false,
  enrichmentStatus = 'not_applicable',
  runId,
  blurContent,
}: {
  brandAwareness?: BrandAwarenessResult[] | null
  analysis: Analysis | null
  domain: string
  platformFilter: string
  onFilterChange: (filter: string) => void
  onUpgradeClick: () => void
  isSubscriber?: boolean
  enrichmentStatus?: EnrichmentStatus
  runId?: string
  /** Whether to blur/hide content - defaults to !isSubscriber if not provided */
  blurContent?: boolean
}) {
  // Resolve blur state - use explicit prop or fall back to subscriber check
  const shouldBlur = blurContent ?? !isSubscriber

  // For free tier (or when blurred), show teaser instead of actual data
  if (shouldBlur) {
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

          <div className="grid sm:grid-cols-2" style={{ gap: '24px' }}>
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

  // Show loading state for enrichment in progress
  if (enrichmentStatus === 'processing' || enrichmentStatus === 'pending') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status={enrichmentStatus}
          title="Generating Brand Analysis"
          description="We're asking AI assistants what they know about your brand. This helps identify recognition gaps and competitive positioning."
          runId={runId}
        />
      </div>
    )
  }

  // Show error state if enrichment failed
  if (enrichmentStatus === 'failed') {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <EnrichmentLoading
          status="failed"
          title="Brand Analysis"
          description="We encountered an issue generating your brand analysis."
        />
      </div>
    )
  }

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
                className="text-[var(--text-mid)] text-sm"
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
