interface ResponseMetadataProps {
  metadata: Record<string, string | number | undefined>
}

export function ResponseMetadata({ metadata }: ResponseMetadataProps) {
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
    const status = String(metadata.grpc_status || metadata.status || '')
    if (status === '0' || status === 'success') {
      return <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">✓ Success</span>
    } else if (status && status !== '0') {
      return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">✗ Error</span>
    }
    return null
  }

  return (
    <div className="rounded-lg border border-border/50 bg-surface-muted/30 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-surface-muted/50">
        <span className="text-sm font-medium text-muted-foreground">Metadata</span>
        {getStatusBadge()}
        {metadata.response_count && Number(metadata.response_count) > 0 && (
          <span className="text-xs text-muted-foreground">
            • {metadata.response_count} {Number(metadata.response_count) === 1 ? 'response' : 'responses'}
          </span>
        )}
      </div>
      <div className="bg-surface px-4 py-3">
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
    </div>
  )
}
