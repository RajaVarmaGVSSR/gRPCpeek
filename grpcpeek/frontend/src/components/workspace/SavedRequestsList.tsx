import type { SavedRequest } from '../../types/workspace'
import { Card, IconButton } from '../ui'

interface SavedRequestsListProps {
  requests: SavedRequest[]
  onRequestClick: (request: SavedRequest) => void
  onRequestDelete: (requestId: string) => void
}

export function SavedRequestsList({
  requests,
  onRequestClick,
  onRequestDelete,
}: SavedRequestsListProps) {
  if (requests.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-3 text-center">
          <div className="text-3xl">💾</div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              No saved requests yet
            </p>
            <p className="text-xs text-muted-foreground">
              Execute a request and click "Save" to add it to your collections.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <Card
          key={request.id}
          className="group flex items-start gap-3 p-4 transition-colors hover:border-focus/60"
        >
          <button
            onClick={() => onRequestClick(request)}
            className="flex flex-1 flex-col items-start gap-1 text-left"
          >
            <div className="font-medium text-foreground">{request.name}</div>
            <div className="text-xs text-muted-foreground">
              {request.service}.{request.method}
            </div>
            <div className="text-xs text-muted-foreground/70">
              {new Date(request.createdAt).toLocaleString()}
            </div>
          </button>
          <IconButton
            variant="danger"
            size="sm"
            onClick={() => onRequestDelete(request.id)}
            className="opacity-0 group-hover:opacity-100"
            aria-label="Delete request"
          >
            🗑
          </IconButton>
        </Card>
      ))}
    </div>
  )
}
