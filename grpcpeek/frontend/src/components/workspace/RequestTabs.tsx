import type { RequestTab } from '../../types/workspace'
import { MethodTypeBadge } from '../ui'

interface RequestTabsProps {
  tabs: RequestTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
}

export function RequestTabs({ tabs, activeTabId, onTabClick, onTabClose }: RequestTabsProps) {
  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-y border-border/50 bg-surface-muted/50 px-3 py-2 min-w-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={`group flex max-w-[260px] flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            activeTabId === tab.id
              ? 'bg-surface text-foreground shadow-md border border-border/60'
              : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground hover:shadow-sm'
          }`}
        >
          <MethodTypeBadge methodType={tab.methodType} compact={true} />
          <span className="max-w-[150px] truncate font-medium">{tab.name}</span>
          {tab.isLoading && <span className="text-xs">⏳</span>}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onTabClose(tab.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onTabClose(tab.id)
              }
            }}
            className="ml-1 select-none rounded p-0.5 text-muted-foreground/50 hover:bg-surface-muted hover:text-foreground"
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  )
}
