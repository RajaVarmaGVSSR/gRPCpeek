import type { SavedRequest } from '../../types/workspace'
import { Card } from '../ui'

interface RequestHistoryProps {
  history: SavedRequest[]
  onRequestClick: (request: SavedRequest) => void
}

export function RequestHistory({ history, onRequestClick }: RequestHistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-2 text-center">
          <div className="text-2xl">🕒</div>
          <p className="text-sm text-muted-foreground">
            No request history yet. Execute a request to see it here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((request) => (
        <button
          key={request.id}
          onClick={() => onRequestClick(request)}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border/70 bg-surface p-3 text-left transition-colors hover:border-focus/60 hover:bg-surface-muted/40"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-sm font-medium text-foreground">{request.name}</div>
            <div className="text-xs text-muted-foreground/70">
              {new Date(request.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {request.service}.{request.method}
          </div>
        </button>
      ))}
    </div>
  )
}
