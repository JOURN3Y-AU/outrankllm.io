interface Competitor {
  name: string
  count: number
}

interface CompetitorsListProps {
  competitors: Competitor[]
}

export function CompetitorsList({ competitors }: CompetitorsListProps) {
  if (competitors.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Competitors Mentioned</h3>
        <p className="text-[var(--text-dim)] font-mono text-sm">
          No competitors were mentioned in AI responses.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4">Competitors Mentioned</h3>
      <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
        These brands are being recommended by AI instead of you:
      </p>

      <div className="space-y-2">
        {competitors.map((competitor, index) => (
          <div
            key={competitor.name}
            className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-[var(--text-dim)] font-mono text-xs w-5">
                {index + 1}.
              </span>
              <span className="font-mono text-sm">{competitor.name}</span>
            </div>
            <span className="text-[var(--text-dim)] font-mono text-xs">
              {competitor.count} mention{competitor.count !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
