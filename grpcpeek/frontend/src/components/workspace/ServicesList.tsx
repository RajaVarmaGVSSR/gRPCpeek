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
      <Card className="p-8">
        <div className="space-y-4 text-center">
          <div className="text-4xl opacity-40">📦</div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              No Services Found
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure proto import paths in Workspace Settings to discover gRPC services
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                // This will be handled by the parent component
                // For now, show hint to user
                const settingsButton = document.querySelector('[title="Workspace settings"]') as HTMLElement
                if (settingsButton) {
                  settingsButton.click()
                }
              }}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              ⚙️ Open Workspace Settings
            </button>
          </div>
          <div className="pt-4 text-xs text-muted-foreground">
            💡 Tip: Add proto files or directories, then click "Re-parse Protos"
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {services.map((service, index) => {
        const isExpanded = expandedServices.has(service.name)
        // Use a stable unique key: service name + source proto path (if available) + index fallback
        const serviceKey = `${service.name}::${service.sourceProto ?? 'unknown'}::${index}`
        return (
          <Card key={serviceKey} className="overflow-hidden slide-up" style={{ animationDelay: `${index * 50}ms` }}>
            <button
              onClick={() => toggleService(service.name)}
              className="flex w-full items-center gap-2 border-b border-border/50 bg-surface-muted px-4 py-2.5 text-left transition-all duration-200 hover:bg-surface-muted/70"
            >
              <span className="text-sm text-muted-foreground transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
                <p className="text-xs text-muted-foreground">{service.methods.length} methods</p>
              </div>
            </button>
            {isExpanded && (
              <div className="divide-y divide-border/30 bg-surface animate-in slide-down">
                {service.methods.map((method, mi) => (
                  <button
                    key={`${serviceKey}::${method.name}::${mi}`}
                    onClick={() => onMethodClick(service.name, method.name)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 pl-10 text-left transition-all duration-150 hover:bg-surface-muted/40 hover:translate-x-1"
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
