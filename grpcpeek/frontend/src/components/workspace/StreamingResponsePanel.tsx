import { useState, useEffect } from 'react'

interface StreamingResponsePanelProps {
  messages: any[]
  onClear?: () => void  // Optional now, kept for backwards compatibility
}

export function StreamingResponsePanel({ messages }: StreamingResponsePanelProps) {
  // Initialize with all messages expanded by default
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    new Set(messages.map((_, i) => i))
  )

  // Auto-expand new messages as they arrive
  useEffect(() => {
    setExpandedIndices(prev => {
      const next = new Set(prev)
      messages.forEach((_, i) => next.add(i))
      return next
    })
  }, [messages.length])

  if (messages.length === 0) {
    return null
  }

  const toggleMessage = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedIndices(new Set(messages.map((_, i) => i)))
  }

  const collapseAll = () => {
    setExpandedIndices(new Set())
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Stream Messages
          </span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {messages.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={expandAll}
            className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
        {messages.map((message, index) => {
          const isExpanded = expandedIndices.has(index)
          return (
            <div
              key={index}
              className="group overflow-hidden rounded-md border border-border/50 bg-surface transition-colors hover:border-border"
            >
              <button
                onClick={() => toggleMessage(index)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-muted/30"
              >
                <span className="text-sm font-medium text-foreground">
                  Response {index + 1}
                </span>
                {!isExpanded && (
                  <span className="flex-1 truncate text-xs text-muted-foreground/60">
                    {JSON.stringify(message).slice(0, 80)}...
                  </span>
                )}
                {isExpanded && <div className="flex-1" />}
                <span 
                  className="shrink-0 text-[10px] text-muted-foreground transition-transform duration-150" 
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▼
                </span>
              </button>
              {isExpanded && (
                <div className="border-t border-border/30 bg-surface-muted/20 px-3 py-2.5">
                  <pre className="overflow-x-auto rounded-md bg-surface/50 p-2.5 font-mono text-[10px] leading-relaxed text-foreground">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
