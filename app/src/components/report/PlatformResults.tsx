'use client'

import { CheckCircle, XCircle } from 'lucide-react'

interface PlatformScore {
  platform: 'chatgpt' | 'claude' | 'gemini'
  score: number
}

interface PlatformResultsProps {
  scores: Record<string, number>
}

const platformConfig = {
  chatgpt: {
    name: 'ChatGPT',
    color: 'var(--red)',
    description: 'OpenAI GPT-4',
  },
  claude: {
    name: 'Claude',
    color: 'var(--green)',
    description: 'Anthropic Claude',
  },
  gemini: {
    name: 'Gemini',
    color: 'var(--blue)',
    description: 'Google Gemini',
  },
}

export function PlatformResults({ scores }: PlatformResultsProps) {
  const platforms: PlatformScore[] = [
    { platform: 'chatgpt', score: scores.chatgpt || 0 },
    { platform: 'claude', score: scores.claude || 0 },
    { platform: 'gemini', score: scores.gemini || 0 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {platforms.map(({ platform, score }) => {
        const config = platformConfig[platform]
        const isMentioned = score > 0

        return (
          <div key={platform} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-mono text-sm">{config.name}</span>
              </div>
              {isMentioned ? (
                <CheckCircle className="w-5 h-5 text-[var(--green)]" />
              ) : (
                <XCircle className="w-5 h-5 text-[var(--red)]" />
              )}
            </div>

            <div className="text-2xl font-mono font-medium mb-1">
              {score}%
            </div>

            <p className="text-[var(--text-dim)] text-xs font-mono">
              {isMentioned
                ? `Mentioned in ${score}% of queries`
                : 'Not mentioned in any queries'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
