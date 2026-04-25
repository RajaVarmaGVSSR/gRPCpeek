import type { GrpcMethodType } from '../../types/workspace'

interface MethodTypeBadgeProps {
  methodType: GrpcMethodType
  compact?: boolean
}

const METHOD_TYPE_CONFIG: Record<GrpcMethodType, { icon: string; label: string; description: string }> = {
  unary: {
    icon: '->',
    label: 'Unary',
    description: 'Single request → Single response',
  },
  server_streaming: {
    icon: '->>',
    label: 'Server Stream',
    description: 'Single request → Stream of responses',
  },
  client_streaming: {
    icon: '>>-',
    label: 'Client Stream',
    description: 'Stream of requests → Single response',
  },
  bidirectional_streaming: {
    icon: '<>',
    label: 'Bidirectional',
    description: 'Stream of requests ↔ Stream of responses',
  },
}

export function MethodTypeBadge({ methodType, compact = false }: MethodTypeBadgeProps) {
  const config = METHOD_TYPE_CONFIG[methodType]
  return (
    <span className="font-mono text-[11px] text-muted-foreground" title={config.description}>
      {compact ? config.icon : `${config.icon} ${config.label}`}
    </span>
  )
}
