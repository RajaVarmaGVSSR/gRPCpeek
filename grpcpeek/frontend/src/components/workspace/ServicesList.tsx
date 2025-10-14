import { useState } from 'react'
import type { Service } from '../../types/workspace'
import { Card, MethodTypeBadge } from '../ui'

interface ServicesListProps {
  services: Service[]
  onMethodClick: (service: string, method: string) => void
}

export function ServicesList({ services, onMethodClick }: ServicesListProps) {
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

  const toggleService = (serviceName: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev)
      if (next.has(serviceName)) {
        next.delete(serviceName)
      } else {
        next.add(serviceName)
      }
      return next
    })
  }

  if (services.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-2 text-center">
          <div className="text-2xl">📦</div>
          <p className="text-sm text-muted-foreground">
            No services discovered yet. Import a proto file to get started.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {services.map((service) => {
        const isExpanded = expandedServices.has(service.name)
        return (
          <Card key={service.name} className="overflow-hidden">
            <button
              onClick={() => toggleService(service.name)}
              className="flex w-full items-center gap-2 border-b border-border/50 bg-surface-muted px-4 py-2.5 text-left transition-colors hover:bg-surface-muted/70"
            >
              <span className="text-sm text-muted-foreground transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
                <p className="text-xs text-muted-foreground">{service.methods.length} methods</p>
              </div>
            </button>
            {isExpanded && (
              <div className="divide-y divide-border/30 bg-surface">
                {service.methods.map((method) => (
                  <button
                    key={method.name}
                    onClick={() => onMethodClick(service.name, method.name)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 pl-10 text-left transition-colors hover:bg-surface-muted/40"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {method.name}
                        </span>
                        <MethodTypeBadge methodType={method.methodType} compact={true} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {method.inputType} → {method.outputType}
                      </div>
                    </div>
                    <div className="pt-1 text-muted-foreground/40">›</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
