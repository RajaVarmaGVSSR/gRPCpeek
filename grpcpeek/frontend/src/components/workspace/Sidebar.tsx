import { useState } from 'react'
import { Card, Input } from '../ui'
import { ServicesList } from './ServicesList'
import { SavedRequestsList } from './SavedRequestsList'
import { RequestHistory } from './RequestHistory'
import type { Service, SavedRequest, HistoryEntry } from '../../types/workspace'

export type SidebarView = 'services' | 'collections' | 'history'

interface SidebarProps {
  view: SidebarView
  onViewChange: (view: SidebarView) => void
  services: Service[]
  savedRequests: SavedRequest[]
  history: HistoryEntry[]
  onMethodClick: (service: string, method: string) => void
  onSavedRequestClick: (request: SavedRequest) => void
  onSavedRequestDelete: (requestId: string) => void
  onHistoryClick: (entry: HistoryEntry) => void
}

export function Sidebar({
  view,
  onViewChange,
  services,
  savedRequests,
  history,
  onMethodClick,
  onSavedRequestClick,
  onSavedRequestDelete,
  onHistoryClick,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter services based on search
  const filteredServices = services.filter((service) => {
    const query = searchQuery.toLowerCase()
    return (
      service.name.toLowerCase().includes(query) ||
      service.methods.some((method) => method.name.toLowerCase().includes(query))
    )
  })

  // Filter saved requests based on search
  const filteredSaved = savedRequests.filter((req) => {
    const query = searchQuery.toLowerCase()
    return (
      req.name.toLowerCase().includes(query) ||
      req.service.toLowerCase().includes(query) ||
      req.method.toLowerCase().includes(query)
    )
  })

  // Filter history based on search
  const filteredHistory = history.filter((entry) => {
    const query = searchQuery.toLowerCase()
    return (
      entry.service.toLowerCase().includes(query) ||
      entry.method.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex h-full border-r border-border bg-surface lg:border-r-0 lg:rounded-xl lg:border lg:border-border/70">
      {/* Vertical Tabs */}
      <div className="flex flex-col w-16 border-r border-border bg-surface-muted/30">
        <button
          onClick={() => onViewChange('services')}
          className={`flex flex-col items-center justify-center gap-1 py-4 px-2 border-b border-border/50 transition-all ${
            view === 'services'
              ? 'bg-surface text-primary border-l-2 border-l-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
          }`}
          title="Services"
        >
          <span className="text-xl">🗂️</span>
          <span className="text-[10px] font-medium">Services</span>
        </button>
        <button
          onClick={() => onViewChange('collections')}
          className={`flex flex-col items-center justify-center gap-1 py-4 px-2 border-b border-border/50 transition-all ${
            view === 'collections'
              ? 'bg-surface text-primary border-l-2 border-l-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
          }`}
          title="Collections"
        >
          <span className="text-xl">💾</span>
          <span className="text-[10px] font-medium">Collections</span>
        </button>
        <button
          onClick={() => onViewChange('history')}
          className={`flex flex-col items-center justify-center gap-1 py-4 px-2 border-b border-border/50 transition-all ${
            view === 'history'
              ? 'bg-surface text-primary border-l-2 border-l-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
          }`}
          title="History"
        >
          <span className="text-xl">🕐</span>
          <span className="text-[10px] font-medium">History</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header with Search */}
        <div className="border-b border-border p-3 lg:p-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {view === 'services' && '🗂️ Services'}
              {view === 'collections' && '💾 Collections'}
              {view === 'history' && '🕐 History'}
            </h3>
            <div className="relative">
              <Input
                type="text"
                placeholder={`Search ${view}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-4">
        {view === 'services' && (
          <div>
            {searchQuery && filteredServices.length === 0 ? (
              <Card className="p-6">
                <div className="space-y-2 text-center">
                  <div className="text-2xl">🔍</div>
                  <p className="text-sm text-muted-foreground">
                    No services found matching "{searchQuery}"
                  </p>
                </div>
              </Card>
            ) : (
              <ServicesList
                services={filteredServices}
                onMethodClick={onMethodClick}
              />
            )}
          </div>
        )}

        {view === 'collections' && (
          <div>
            {searchQuery && filteredSaved.length === 0 ? (
              <Card className="p-6">
                <div className="space-y-2 text-center">
                  <div className="text-2xl">🔍</div>
                  <p className="text-sm text-muted-foreground">
                    No saved requests found matching "{searchQuery}"
                  </p>
                </div>
              </Card>
            ) : (
              <SavedRequestsList
                requests={filteredSaved}
                onRequestClick={onSavedRequestClick}
                onRequestDelete={onSavedRequestDelete}
              />
            )}
          </div>
        )}

        {view === 'history' && (
          <div>
            {searchQuery && filteredHistory.length === 0 ? (
              <Card className="p-6">
                <div className="space-y-2 text-center">
                  <div className="text-2xl">🔍</div>
                  <p className="text-sm text-muted-foreground">
                    No history found matching "{searchQuery}"
                  </p>
                </div>
              </Card>
            ) : (
              <RequestHistory
                history={filteredHistory}
                onRequestClick={onHistoryClick}
              />
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
