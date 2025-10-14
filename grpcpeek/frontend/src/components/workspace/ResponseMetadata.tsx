import { useState } from 'react'

interface ResponseMetadataProps {
  metadata: {
    status?: string
    grpc_status?: string
    grpc_message?: string
    method?: string
    service?: string
    endpoint?: string
    message_count?: number
    response_size?: number
    timestamp?: string
    note?: string
  }
}

export function ResponseMetadata({ metadata }: ResponseMetadataProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter out null/undefined values
  const entries = Object.entries(metadata).filter(([_, value]) => value !== undefined && value !== null)

  if (entries.length === 0) {
    return null
  }

  // Format display names
  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get status indicator
  const getStatusBadge = () => {
    if (metadata.status === 'success' || metadata.grpc_status === '0') {
      return <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">✓ Success</span>
    } else if (metadata.status === 'error') {
      return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">✗ Error</span>
    }
    return null
  }

  return (
    <div className="rounded-lg border border-border/50 bg-surface-muted/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-surface-muted/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Metadata</span>
          {getStatusBadge()}
          {metadata.message_count && (
            <span className="text-xs text-muted-foreground">
              • {metadata.message_count} {metadata.message_count === 1 ? 'message' : 'messages'}
            </span>
          )}
        </div>
        <span 
          className="text-xs text-muted-foreground transition-transform duration-200" 
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {isExpanded && (
        <div className="border-t border-border/30 bg-surface px-4 py-3">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">
                  {formatKey(key)}
                </dt>
                <dd className="font-mono text-xs text-foreground">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
