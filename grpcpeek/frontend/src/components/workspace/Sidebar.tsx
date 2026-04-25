import { useState } from 'react'
import { Card, Input } from '../ui'
import { ServicesList } from './ServicesList'
import { CollectionsTree } from './CollectionsTree'
import { RequestHistory } from './RequestHistory'
import type { Service, SavedRequest, HistoryEntry, Collection } from '../../types/workspace'

export type SidebarView = 'services' | 'collections' | 'history'

interface SidebarProps {
  view: SidebarView
  onViewChange: (view: SidebarView) => void
  services: Service[]
  collections: Collection[]
  history: HistoryEntry[]
  onMethodClick: (service: string, method: string, forceNew?: boolean) => void
  onOpenWorkspaceSettings?: () => void
  onSavedRequestClick: (request: SavedRequest) => void
  onSavedRequestDelete: (requestId: string) => void
  onSavedRequestRename?: (requestId: string, newName: string) => void
  onHistoryClick: (entry: HistoryEntry) => void
  onClearHistory?: () => void
  // Collection management
  onCreateCollection?: (name: string) => void
  onRenameCollection?: (collectionId: string, newName: string) => void
  onDeleteCollection?: (collectionId: string) => void
  // Folder management
  onCreateFolder?: (collectionId: string, name: string, parentFolderId?: string) => void
  onRenameFolder?: (collectionId: string, folderId: string, newName: string) => void
  onDeleteFolder?: (collectionId: string, folderId: string) => void
  // Request creation
  onCreateRequestInCollection?: (collectionId: string, folderId: string | undefined, service: string, method: string) => void
}

export function Sidebar({
  view,
  onViewChange,
  services,
  collections,
  history,
  onMethodClick,
  onOpenWorkspaceSettings,
  onSavedRequestClick,
  onSavedRequestDelete,
  onSavedRequestRename,
  onHistoryClick,
  onClearHistory,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateRequestInCollection,
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

  // Filter collections based on search (filters requests within collections)
  const filteredCollections = collections.map((collection) => {
    const query = searchQuery.toLowerCase()
    
    // Helper to filter requests recursively in folders
    const filterFolder = (folder: any): any => {
      const filteredRequests = folder.requests.filter((req: SavedRequest) =>
        req.name.toLowerCase().includes(query) ||
        req.service.toLowerCase().includes(query) ||
        req.method.toLowerCase().includes(query)
      )
      const filteredSubFolders = folder.folders
        .map(filterFolder)
        .filter((f: any) => f.requests.length > 0 || f.folders.length > 0)
      
      return {
        ...folder,
        requests: filteredRequests,
        folders: filteredSubFolders,
      }
    }

    const filteredRootRequests = collection.requests.filter((req) =>
      req.name.toLowerCase().includes(query) ||
      req.service.toLowerCase().includes(query) ||
      req.method.toLowerCase().includes(query)
    )
    const filteredFolders = collection.folders
      .map(filterFolder)
      .filter((f) => f.requests.length > 0 || f.folders.length > 0)

    return {
      ...collection,
      requests: filteredRootRequests,
      folders: filteredFolders,
    }
  }).filter((c) => c.requests.length > 0 || c.folders.length > 0)

  // Filter history based on search
  const filteredHistory = history.filter((entry) => {
    const query = searchQuery.toLowerCase()
    return (
      entry.service.toLowerCase().includes(query) ||
      entry.method.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex h-full border-r border-border bg-surface lg:border-r-0 lg:border lg:border-border/70">
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[10px] font-medium">History</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header with Search */}
        <div className="border-b border-border p-3 lg:p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {view === 'services' && 'Services'}
                {view === 'collections' && 'Collections'}
                {view === 'history' && 'History'}
              </h3>
              {view === 'history' && history.length > 0 && onClearHistory && (
                <button
                  onClick={onClearHistory}
                  className="rounded p-1 text-xs text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Clear history"
                >
                  Clear All
                </button>
              )}
            </div>
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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mx-auto"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <p className="text-sm text-muted-foreground">
                    No services found matching "{searchQuery}"
                  </p>
                </div>
              </Card>
            ) : (
              <ServicesList
                services={filteredServices}
                onMethodClick={onMethodClick}
                onOpenWorkspaceSettings={onOpenWorkspaceSettings}
              />
            )}
          </div>
        )}

        {view === 'collections' && (
          <div>
            {searchQuery && filteredCollections.length === 0 ? (
              <Card className="p-6">
                <div className="space-y-2 text-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mx-auto"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <p className="text-sm text-muted-foreground">
                    No saved requests found matching "{searchQuery}"
                  </p>
                </div>
              </Card>
            ) : (
              <CollectionsTree
                collections={searchQuery ? filteredCollections : collections}
                services={services}
                onRequestClick={onSavedRequestClick}
                onRequestDelete={onSavedRequestDelete}
                onRequestRename={onSavedRequestRename}
                onCreateRequest={onCreateRequestInCollection}
                onCreateCollection={onCreateCollection}
                onRenameCollection={onRenameCollection}
                onDeleteCollection={onDeleteCollection}
                onCreateFolder={onCreateFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            )}
          </div>
        )}

        {view === 'history' && (
          <div>
            {searchQuery && filteredHistory.length === 0 ? (
              <Card className="p-6">
                <div className="space-y-2 text-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mx-auto"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
