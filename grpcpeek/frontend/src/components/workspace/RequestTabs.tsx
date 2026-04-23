import { useEffect, useRef } from 'react'
import type { RequestTab } from '../../types/workspace'

interface RequestTabsProps {
  tabs: RequestTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
}

const METHOD_TYPE_ICON: Record<RequestTab['methodType'], string> = {
  unary: '->',
  server_streaming: '->>',
  client_streaming: '>>-',
  bidirectional_streaming: '<>'
}

export function RequestTabs({ tabs, activeTabId, onTabClick, onTabClose }: RequestTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Gently smooth-scroll the active tab directly into view.
  useEffect(() => {
    if (activeTabId && scrollContainerRef.current) {
      const activeElement = scrollContainerRef.current.querySelector(
        `[data-tab-id="${activeTabId}"]`
      ) as HTMLElement
      
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      }
    }
  }, [activeTabId])

  if (tabs.length === 0) {
    return null
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="flex w-full max-w-full items-end gap-0 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-border bg-background/40 px-2 pt-2 min-w-0 scrollbar-hide"
      style={{ scrollbarWidth: 'none' /* Firefox horizontal scrollbar killswitch */ }}
    >
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id
        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            className={`group -mr-px flex h-9 max-w-[240px] flex-shrink-0 items-center gap-1.5 rounded-t-md border px-2 text-sm transition-colors
              ${
                isActive
                  ? 'relative z-10 border-border border-b-surface bg-surface text-foreground shadow-sm'
                  : 'border-border/70 bg-surface-muted/35 text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground'
              }
            `}
            style={{ marginBottom: isActive ? '-1px' : '0px' }}
            title={tab.name}
          >
            {tab.isDirty && (
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  isActive ? 'bg-primary' : 'bg-primary/50'
                }`}
                title="Unsaved changes"
              />
            )}

            <button
              type="button"
              onClick={() => onTabClick(tab.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left"
            >
              <span className={`font-mono text-[11px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {METHOD_TYPE_ICON[tab.methodType]}
              </span>
              <span className="truncate max-w-[150px]">{tab.name}</span>
            </button>

            {tab.isLoading && (
              <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-primary/70" title="Loading">
                <span className="sr-only">Loading</span>
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-sm leading-none transition-colors ${
                isActive 
                  ? 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                  : 'text-transparent group-hover:text-muted-foreground hover:bg-background hover:text-foreground'
              }`}
              title="Close tab"
              aria-label={`Close ${tab.name}`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.707L8 8.707z" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
