import { useEffect, useRef } from 'react'
import type { RequestTab } from '../../types/workspace'
import { MethodTypeBadge } from '../ui'

interface RequestTabsProps {
  tabs: RequestTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
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

  // VS Code / Modern IDE style
  return (
    <div 
      ref={scrollContainerRef}
      className="flex w-full max-w-full items-end gap-0 overflow-x-auto overflow-y-hidden whitespace-nowrap bg-background/50 border-b border-border min-w-0 pt-2 px-2 scrollbar-hide"
      style={{ scrollbarWidth: 'none' /* Firefox horizontal scrollbar killswitch */ }}
    >
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id
        return (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`group flex items-center gap-2 px-4 py-2 text-sm flex-shrink-0 transition-all border-r border-border/40 max-w-[240px] select-none
              ${
                isActive
                  ? 'bg-surface text-foreground font-medium border-t border-t-primary border-l border-l-border/40 shadow-sm relative z-10'
                  : 'text-muted-foreground hover:bg-surface-muted/50 border-t border-t-transparent hover:text-foreground font-normal border-l border-l-transparent'
              }
              ${isActive ? 'rounded-t-md' : 'rounded-t-sm'}
            `}
            style={{ 
              marginBottom: isActive ? '-1px' : '0px',
              paddingBottom: isActive ? '9px' : '8px' // slight height delta to cover border
            }}
            title={tab.name}
          >
            {/* Dirty state indicator */}
            {tab.isDirty && (
              <span
                className={`flex-shrink-0 h-2 w-2 rounded-full ${
                  isActive ? 'bg-primary' : 'bg-primary/50'
                }`}
                title="Unsaved changes"
              />
            )}
            
            <MethodTypeBadge methodType={tab.methodType} compact={true} />
            <span className="truncate max-w-[140px]">{tab.name}</span>
            
            {/* Loading indicator */}
            {tab.isLoading && (
              <span className="text-xs animate-pulse mx-1" title="Loading...">
                ⏳
              </span>
            )}
            
            {/* Close button */}
            <div
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
              className={`ml-1 flex h-5 w-5 items-center justify-center rounded transition-colors ${
                isActive 
                  ? 'text-muted-foreground hover:bg-surface-muted hover:text-foreground opacity-100' 
                  : 'text-transparent group-hover:text-muted-foreground group-hover:hover:bg-background group-hover:hover:text-foreground opacity-0 group-hover:opacity-100'
              }`}
              title="Close tab"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.707L8 8.707z" />
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}
