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
    <div className="flex w-full max-w-full items-center gap-0 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b-2 border-border bg-surface-muted/30 px-3 py-2 min-w-0 scrollbar-thin">
      {tabs.map((tab, index) => {
        const isActive = activeTabId === tab.id
        const isNotFirst = index > 0
        // Wrap divider + button in a keyed container to avoid duplicate key warnings
        return (
          <div key={tab.id} className="flex items-center">
            {/* Divider between tabs */}
            {isNotFirst && (
              <div className="h-6 w-px bg-border/40 flex-shrink-0 mx-1" />
            )}
            <button
              onClick={() => onTabClick(tab.id)}
              className={`group relative flex max-w-[260px] flex-shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium transition-all duration-200 slide-up ${
                isActive
                  ? 'bg-surface text-foreground shadow-sm border-x border-t-2 border-border border-t-primary/60 -mb-0.5'
                  : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground hover:border-x hover:border-t hover:border-border/30 hover:rounded-t-lg'
              }`}
              title={tab.name}
              style={{ animationDelay: `${index * 30}ms` }}
            >
            {/* Dirty state indicator */}
            {tab.isDirty && (
              <span
                className={`absolute -left-1 -top-1 h-2 w-2 rounded-full ${
                  isActive ? 'bg-blue-500' : 'bg-blue-400'
                }`}
                title="Unsaved changes"
              />
            )}
            
            <MethodTypeBadge methodType={tab.methodType} compact={true} />
            <span className="max-w-[150px] truncate font-medium">{tab.name}</span>
            
            {/* Loading indicator */}
            {tab.isLoading && (
              <span className="text-xs animate-pulse" title="Loading...">
                ⏳
              </span>
            )}
            
            {/* Close button */}
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
              className="ml-1 select-none rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-surface-muted hover:text-foreground"
              title="Close tab"
            >
              ✕
            </span>
          </button>
          </div>
        )
      })}
    </div>
  )
}
