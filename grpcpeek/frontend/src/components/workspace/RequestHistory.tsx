import type { HistoryEntry } from '../../types/workspace'
import { Card } from '../ui'

interface RequestHistoryProps {
  history: HistoryEntry[]
  onRequestClick: (request: HistoryEntry) => void
}

export function RequestHistory({ history, onRequestClick }: RequestHistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-2 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mx-auto"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p className="text-sm text-muted-foreground">
            No request history yet. Execute a request to see it here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => {
        const displayName = `${entry.service}.${entry.method}`
        return (
          <button
            key={entry.id}
            onClick={() => onRequestClick(entry)}
            className="flex w-full flex-col items-start gap-1 rounded border border-border/70 bg-surface p-3 text-left transition-colors hover:border-focus/60 hover:bg-surface-muted/40"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground">{displayName}</div>
              <div className="text-xs text-muted-foreground/70">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.endpoint} • {entry.duration}ms
            </div>
          </button>
        )
      })}
    </div>
  )
}
