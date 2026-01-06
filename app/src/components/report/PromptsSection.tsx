'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Edit3, Lock, CheckCircle } from 'lucide-react'

interface Prompt {
  id: string
  prompt_text: string
  category: string
}

interface PromptsSectionProps {
  prompts: Prompt[]
  canEdit?: boolean // If true, allow editing (paid tier)
  sitemapUsed?: boolean
  onUpgradeClick?: () => void
}

// Category display names and colors
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'var(--text-mid)' },
  location: { label: 'Location', color: 'var(--blue)' },
  service: { label: 'Service', color: 'var(--green)' },
  comparison: { label: 'Comparison', color: 'var(--amber)' },
  recommendation: { label: 'Recommendation', color: 'var(--red)' },
}

export function PromptsSection({
  prompts,
  canEdit = false,
  sitemapUsed = false,
  onUpgradeClick
}: PromptsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (prompts.length === 0) {
    return null
  }

  // Group prompts by category
  const groupedPrompts = prompts.reduce((acc, prompt) => {
    const category = prompt.category || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(prompt)
    return acc
  }, {} as Record<string, Prompt[]>)

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-[var(--green)]" />
          <h3 className="text-lg font-medium">Questions Used</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Sitemap indicator */}
          {sitemapUsed && (
            <div
              className="flex items-center gap-1 px-2 py-1 bg-[var(--green)]/10 rounded text-xs text-[var(--green)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <CheckCircle size={12} />
              Sitemap found
            </div>
          )}

          {/* Question count */}
          <span className="font-mono text-sm text-[var(--text-dim)]">
            {prompts.length} questions
          </span>
        </div>
      </div>

      <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
        These questions were generated based on your website content to test how AI assistants perceive your business.
      </p>

      {/* Collapsed preview */}
      {!isExpanded && (
        <div className="space-y-2 mb-4">
          {prompts.slice(0, 3).map((prompt) => {
            const categoryConfig = CATEGORY_CONFIG[prompt.category || 'general'] || CATEGORY_CONFIG.general
            return (
              <div
                key={prompt.id}
                className="flex items-start gap-2 py-2 border-b border-[var(--border)]"
              >
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: `${categoryConfig.color}15`,
                    color: categoryConfig.color
                  }}
                >
                  {categoryConfig.label}
                </span>
                <span className="font-mono text-sm text-[var(--text-mid)] truncate">
                  {prompt.prompt_text}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <div className="space-y-4 mb-4">
          {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => {
            const categoryConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general
            return (
              <div key={category}>
                <div
                  className="font-mono text-xs uppercase tracking-wider mb-2"
                  style={{ color: categoryConfig.color }}
                >
                  {categoryConfig.label} Questions
                </div>
                <div className="space-y-2">
                  {categoryPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex items-start gap-2 py-2 border-b border-[var(--border)] last:border-0"
                    >
                      <span className="font-mono text-sm text-[var(--text-mid)]">
                        &ldquo;{prompt.prompt_text}&rdquo;
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors font-mono text-sm"
      >
        {isExpanded ? (
          <>
            <ChevronUp size={16} />
            Show less
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            Show all {prompts.length} questions
          </>
        )}
      </button>

      {/* Edit CTA for free users */}
      {!canEdit && (
        <div
          className="mt-4 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <Lock size={14} className="text-[var(--amber)]" />
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              Customize questions to match your business
            </span>
          </div>
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1 px-3 py-1 text-xs text-[var(--green)] hover:bg-[var(--green)]/10 rounded transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <Edit3 size={12} />
            Upgrade to edit
          </button>
        </div>
      )}

      {/* Edit mode for paid users */}
      {canEdit && (
        <div
          className="mt-4 p-3 bg-[var(--green)]/5 border border-[var(--green)]/20 rounded flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-mid)]">
            <Edit3 size={14} className="text-[var(--green)]" />
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              You can edit these questions and re-run the analysis
            </span>
          </div>
          <button
            className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--green)] text-[var(--bg)] rounded hover:opacity-90 transition-opacity"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <Edit3 size={12} />
            Edit questions
          </button>
        </div>
      )}
    </div>
  )
}
