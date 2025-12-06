import { Badge } from './Badge'
import type { GrpcMethodType } from '../../types/workspace'

interface MethodTypeBadgeProps {
  methodType: GrpcMethodType
  compact?: boolean
}

const METHOD_TYPE_CONFIG = {
  unary: {
    label: 'Unary',
    icon: '→',
    color: 'blue' as const,
    description: 'Single request → Single response'
  },
  server_streaming: {
    label: 'Server Stream',
    icon: '→⇉',
    color: 'green' as const,
    description: 'Single request → Stream of responses'
  },
  client_streaming: {
    label: 'Client Stream',
    icon: '⇉→',
    color: 'orange' as const,
    description: 'Stream of requests → Single response'
  },
  bidirectional_streaming: {
    label: 'Bidirectional',
    icon: '⇄',
    color: 'purple' as const,
    description: 'Stream of requests ⇄ Stream of responses'
  }
}

export function MethodTypeBadge({ methodType, compact = false }: MethodTypeBadgeProps) {
  const config = METHOD_TYPE_CONFIG[methodType]
  
  return (
    <Badge 
      variant={config.color}
      title={config.description}
      className="font-mono text-xs"
    >
      {compact ? config.icon : `${config.icon} ${config.label}`}
    </Badge>
  )
}
