import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Collection, Folder, SavedRequest } from '../../types/workspace'
import { Card, MethodTypeBadge, Input, Button } from '../ui'

// Portal-based dropdown menu that positions itself intelligently
function PortalMenu({
  isOpen,
  anchorRef,
  onClose,
  children,
}: {
  isOpen: boolean
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
  children: React.ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return

    const anchor = anchorRef.current
    const rect = anchor.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // Get actual menu dimensions after render
    const menuRect = menuRef.current?.getBoundingClientRect()
    const menuHeight = menuRect?.height || 150
    const menuWidth = menuRect?.width || 160

    // Calculate if we should show above or below
    const spaceBelow = viewportHeight - rect.bottom
    const showAbove = spaceBelow < menuHeight + 20

    // Calculate position
    let top = showAbove ? rect.top - menuHeight - 4 : rect.bottom + 4
    let left = rect.right - menuWidth

    // Keep within viewport horizontally
    if (left < 8) left = 8
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8

    // Keep within viewport vertically
    if (top < 8) top = 8
    if (top + menuHeight > viewportHeight - 8) top = viewportHeight - menuHeight - 8

    setPosition({ top, left })
  }, [isOpen, anchorRef])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Use timeout to avoid immediate close on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[140px] rounded-lg border border-border bg-surface shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  )
}

// Styled Input Modal Component (rendered via portal)
function InputModal({
  isOpen,
  title,
  placeholder,
  initialValue = '',
  submitLabel = 'Save',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  placeholder?: string
  initialValue?: string
  submitLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, initialValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onConfirm(value.trim())
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()} size="sm">
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// Styled Confirm Modal Component (rendered via portal)
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'destructive' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (isOpen) {
      // Focus trap - you can add more sophisticated focus management if needed
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel()
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onCancel} size="sm">
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={onConfirm} 
            size="sm"
            className={confirmVariant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface CollectionsTreeProps {
  collections: Collection[]
  services: any[]
  onRequestClick: (request: SavedRequest) => void
  onRequestDelete: (requestId: string) => void
  onRequestRename?: (requestId: string, newName: string) => void
  onCreateRequest?: (collectionId: string, folderId: string | undefined, service: string, method: string) => void
  onMoveRequest?: (requestId: string, targetCollectionId: string, targetFolderId?: string) => void
  onCreateCollection?: (name: string) => void
  onCreateFolder?: (collectionId: string, name: string, parentFolderId?: string) => void
  onDeleteCollection?: (collectionId: string) => void
  onDeleteFolder?: (collectionId: string, folderId: string) => void
  onRenameCollection?: (collectionId: string, newName: string) => void
  onRenameFolder?: (collectionId: string, folderId: string, newName: string) => void
}

export function CollectionsTree({
  collections,
  services: _services, // kept for interface compatibility
  onRequestClick,
  onRequestDelete,
  onRequestRename,
  onCreateRequest,
  onCreateCollection,
  onCreateFolder,
  onDeleteCollection,
  onDeleteFolder,
  onRenameCollection,
  onRenameFolder,
}: CollectionsTreeProps) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<{
    type: 'collection' | 'folder' | 'request'
    id: string
    collectionId?: string
  } | null>(null)
  
  // Modal state for renaming (collections, folders, or requests)
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean
    type: 'collection' | 'folder' | 'request'
    id: string
    collectionId?: string
    currentName: string
  }>({ isOpen: false, type: 'collection', id: '', currentName: '' })

  // Modal state for creating collections
  const [createCollectionModal, setCreateCollectionModal] = useState(false)

  // Modal state for creating folders
  const [createFolderModal, setCreateFolderModal] = useState<{
    isOpen: boolean
    collectionId: string
    parentFolderId?: string
  }>({ isOpen: false, collectionId: '' })

  // Modal state for delete confirmations
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    type: 'collection' | 'folder' | 'request'
    id: string
    collectionId?: string
    name: string
  }>({ isOpen: false, type: 'collection', id: '', name: '' })

  useEffect(() => {
    if (!openMenu) return
    const handleClick = () => setOpenMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenu])

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  if (collections.length === 0) {
    return (
      <Card className="p-8">
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              No Collections Yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Save your requests to organize them into collections
            </p>
          </div>
          {onCreateCollection && (
            <div className="pt-2">
              <button
                onClick={() => setCreateCollectionModal(true)}
                className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                + Create Collection
              </button>
            </div>
          )}
          <div className="pt-4 text-xs text-muted-foreground">
            Tip: Use Ctrl+S to save the current request
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {collections.map((collection, index) => (
          <CollectionItem
            key={collection.id}
            collection={collection}
            index={index}
            isExpanded={expandedCollections.has(collection.id)}
            onToggle={() => toggleCollection(collection.id)}
            onRequestClick={onRequestClick}
            onRequestDelete={onRequestDelete}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onCreateFolder={onCreateFolder ? (collectionId, parentFolderId) => {
              setCreateFolderModal({ isOpen: true, collectionId, parentFolderId })
            } : undefined}
            onCreateRequest={onCreateRequest}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            openMenu={openMenu}
            onMenuOpen={setOpenMenu}
            onCreateNewRequest={(collectionId, folderId) => {
              // Create directly with default name
              if (onCreateRequest) {
                onCreateRequest(collectionId, folderId, 'New Request', '')
              }
            }}
            onShowRenameModal={(type, id, currentName, collectionId) => {
              setRenameModal({ isOpen: true, type, id, currentName, collectionId })
            }}
            onShowDeleteConfirm={(type, id, name, collectionId) => {
              setDeleteConfirmModal({ isOpen: true, type, id, name, collectionId })
            }}
          />
        ))}
      </div>

      {onCreateCollection && (
        <button
          onClick={() => setCreateCollectionModal(true)}
          className="mt-4 w-full rounded border border-dashed border-border/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          + New Collection
        </button>
      )}

      {/* Rename Modal (for collections, folders, and requests) */}
      <InputModal
        isOpen={renameModal.isOpen}
        title={
          renameModal.type === 'collection' ? 'Rename Collection' : 
          renameModal.type === 'folder' ? 'Rename Folder' : 'Rename Request'
        }
        placeholder="Enter name..."
        initialValue={renameModal.currentName}
        submitLabel="Rename"
        onConfirm={(name) => {
          if (renameModal.type === 'collection' && onRenameCollection) {
            onRenameCollection(renameModal.id, name)
          } else if (renameModal.type === 'folder' && onRenameFolder && renameModal.collectionId) {
            onRenameFolder(renameModal.collectionId, renameModal.id, name)
          } else if (renameModal.type === 'request' && onRequestRename) {
            onRequestRename(renameModal.id, name)
          }
          setRenameModal({ isOpen: false, type: 'collection', id: '', currentName: '' })
        }}
        onCancel={() => setRenameModal({ isOpen: false, type: 'collection', id: '', currentName: '' })}
      />

      {/* Create Collection Modal */}
      <InputModal
        isOpen={createCollectionModal}
        title="New Collection"
        placeholder="Enter collection name..."
        initialValue=""
        submitLabel="Create"
        onConfirm={(name) => {
          if (onCreateCollection) {
            onCreateCollection(name)
          }
          setCreateCollectionModal(false)
        }}
        onCancel={() => setCreateCollectionModal(false)}
      />

      {/* Create Folder Modal */}
      <InputModal
        isOpen={createFolderModal.isOpen}
        title="New Folder"
        placeholder="Enter folder name..."
        initialValue=""
        submitLabel="Create"
        onConfirm={(name) => {
          if (onCreateFolder) {
            onCreateFolder(createFolderModal.collectionId, name, createFolderModal.parentFolderId)
          }
          setCreateFolderModal({ isOpen: false, collectionId: '' })
        }}
        onCancel={() => setCreateFolderModal({ isOpen: false, collectionId: '' })}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title={
          deleteConfirmModal.type === 'collection' ? 'Delete Collection' :
          deleteConfirmModal.type === 'folder' ? 'Delete Folder' : 'Delete Request'
        }
        message={
          deleteConfirmModal.type === 'collection' 
            ? `Are you sure you want to delete "${deleteConfirmModal.name}"? This will also delete all its contents.`
            : deleteConfirmModal.type === 'folder'
            ? `Are you sure you want to delete "${deleteConfirmModal.name}"? This will also delete all its contents.`
            : `Are you sure you want to delete "${deleteConfirmModal.name}"?`
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteConfirmModal.type === 'collection' && onDeleteCollection) {
            onDeleteCollection(deleteConfirmModal.id)
          } else if (deleteConfirmModal.type === 'folder' && onDeleteFolder && deleteConfirmModal.collectionId) {
            onDeleteFolder(deleteConfirmModal.collectionId, deleteConfirmModal.id)
          } else if (deleteConfirmModal.type === 'request' && onRequestDelete) {
            onRequestDelete(deleteConfirmModal.id)
          }
          setDeleteConfirmModal({ isOpen: false, type: 'collection', id: '', name: '' })
        }}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, type: 'collection', id: '', name: '' })}
      />
    </>
  )
}

interface CollectionItemProps {
  collection: Collection
  index: number
  isExpanded: boolean
  onToggle: () => void
  onRequestClick: (request: SavedRequest) => void
  onRequestDelete: (requestId: string) => void
  expandedFolders: Set<string>
  onToggleFolder: (folderId: string) => void
  onCreateFolder?: (collectionId: string, parentFolderId?: string) => void
  onCreateRequest?: (collectionId: string, folderId: string | undefined, service: string, method: string) => void
  onRenameCollection?: (collectionId: string, newName: string) => void
  onDeleteCollection?: (collectionId: string) => void
  onRenameFolder?: (collectionId: string, folderId: string, newName: string) => void
  onDeleteFolder?: (collectionId: string, folderId: string) => void
  openMenu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null
  onMenuOpen: (menu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null) => void
  onCreateNewRequest: (collectionId: string, folderId?: string) => void
  onShowRenameModal: (type: 'collection' | 'folder' | 'request', id: string, currentName: string, collectionId?: string) => void
  onShowDeleteConfirm: (type: 'collection' | 'folder' | 'request', id: string, name: string, collectionId?: string) => void
}

function CollectionItem({
  collection,
  index,
  isExpanded,
  onToggle,
  onRequestClick,
  onRequestDelete,
  expandedFolders,
  onToggleFolder,
  onCreateFolder,
  onCreateRequest,
  onRenameFolder,
  onDeleteFolder,
  openMenu,
  onMenuOpen,
  onCreateNewRequest,
  onShowRenameModal,
  onShowDeleteConfirm,
}: CollectionItemProps) {
  const totalRequests = countTotalRequests(collection)
  const hasContent = totalRequests > 0
  const isMenuOpen = openMenu?.type === 'collection' && openMenu?.id === collection.id
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <Card className="overflow-hidden slide-up" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex w-full items-center gap-2 border-b border-border/50 bg-surface-muted px-4 py-2.5">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left transition-all duration-200 hover:opacity-70"
        >
          <span
            className="text-sm text-muted-foreground transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▸
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{collection.name}</h3>
            <p className="text-xs text-muted-foreground">
              {totalRequests} {totalRequests === 1 ? 'request' : 'requests'}
            </p>
          </div>
        </button>
        
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation()
              onMenuOpen(isMenuOpen ? null : { type: 'collection', id: collection.id })
            }}
            className="rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            •••
          </button>
          
          <PortalMenu
            isOpen={isMenuOpen}
            anchorRef={buttonRef}
            onClose={() => onMenuOpen(null)}
          >
            <div className="py-1">
              {onCreateRequest && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateNewRequest(collection.id, undefined)
                      onMenuOpen(null)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
                  >
                    <span>+ New Request</span>
                  </button>
                  <div className="my-1 border-t border-border/50" />
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowRenameModal('collection', collection.id, collection.name)
                  onMenuOpen(null)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
              >
                <span>Rename</span>
              </button>
              {onCreateFolder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateFolder(collection.id)
                    onMenuOpen(null)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
                >
                  <span>New Folder</span>
                </button>
              )}
              <div className="my-1 border-t border-border/50" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowDeleteConfirm('collection', collection.id, collection.name)
                  onMenuOpen(null)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10 whitespace-nowrap"
              >
                <span>Delete</span>
              </button>
            </div>
          </PortalMenu>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-surface animate-in slide-down">
          {hasContent ? (
            <div className="divide-y divide-border/30">
              {collection.folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  collectionId={collection.id}
                  depth={0}
                  onRequestClick={onRequestClick}
                  onRequestDelete={onRequestDelete}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  onCreateFolder={onCreateFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  openMenu={openMenu}
                  onMenuOpen={onMenuOpen}
                  onCreateNewRequest={onCreateNewRequest}
                  onShowRenameModal={onShowRenameModal}
                  onShowDeleteConfirm={onShowDeleteConfirm}
                />
              ))}

              {collection.requests.map((request) => (
                <RequestItem
                  key={request.id}
                  request={request}
                  depth={0}
                  onRequestClick={onRequestClick}
                  onRequestDelete={onRequestDelete}
                  openMenu={openMenu}
                  onMenuOpen={onMenuOpen}
                  onShowRenameModal={onShowRenameModal}
                  onShowDeleteConfirm={onShowDeleteConfirm}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No requests yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Save a request to add it here
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

interface FolderItemProps {
  folder: Folder
  collectionId: string
  depth: number
  onRequestClick: (request: SavedRequest) => void
  onRequestDelete: (requestId: string) => void
  expandedFolders: Set<string>
  onToggleFolder: (folderId: string) => void
  onCreateFolder?: (collectionId: string, parentFolderId?: string) => void
  onRenameFolder?: (collectionId: string, folderId: string, newName: string) => void
  onDeleteFolder?: (collectionId: string, folderId: string) => void
  openMenu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null
  onMenuOpen: (menu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null) => void
  onCreateNewRequest: (collectionId: string, folderId?: string) => void
  onShowRenameModal: (type: 'collection' | 'folder' | 'request', id: string, currentName: string, collectionId?: string) => void
  onShowDeleteConfirm: (type: 'collection' | 'folder' | 'request', id: string, name: string, collectionId?: string) => void
}

function FolderItem({
  folder,
  collectionId,
  depth,
  onRequestClick,
  onRequestDelete,
  expandedFolders,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  openMenu,
  onMenuOpen,
  onCreateNewRequest,
  onShowRenameModal,
  onShowDeleteConfirm,
}: FolderItemProps) {
  const isExpanded = expandedFolders.has(folder.id)
  const totalRequests = folder.requests.length + folder.folders.reduce((sum, f) => sum + countFolderRequests(f), 0)
  const paddingLeft = 16 + depth * 16
  const isMenuOpen = openMenu?.type === 'folder' && openMenu?.id === folder.id
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <div className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-muted/40" style={{ paddingLeft }}>
        <button
          onClick={() => onToggleFolder(folder.id)}
          className="flex flex-1 items-center gap-2 text-left transition-all duration-150"
        >
          <span
            className="text-xs text-muted-foreground transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▸
          </span>
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">{folder.name}</span>
            {totalRequests > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({totalRequests})
              </span>
            )}
          </div>
        </button>
        
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation()
              onMenuOpen(isMenuOpen ? null : { type: 'folder', id: folder.id, collectionId })
            }}
            className="rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            •••
          </button>
          
          <PortalMenu
            isOpen={isMenuOpen}
            anchorRef={buttonRef}
            onClose={() => onMenuOpen(null)}
          >
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateNewRequest(collectionId, folder.id)
                  onMenuOpen(null)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
              >
                <span>+ New Request</span>
              </button>
              <div className="my-1 border-t border-border/50" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowRenameModal('folder', folder.id, folder.name, collectionId)
                  onMenuOpen(null)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
              >
                <span>Rename</span>
              </button>
              <div className="my-1 border-t border-border/50" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowDeleteConfirm('folder', folder.id, folder.name, collectionId)
                  onMenuOpen(null)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10 whitespace-nowrap"
              >
                <span>Delete</span>
              </button>
            </div>
          </PortalMenu>
        </div>
      </div>

      {isExpanded && (
        <div>
          {folder.folders.map((nestedFolder) => (
            <FolderItem
              key={nestedFolder.id}
              folder={nestedFolder}
              collectionId={collectionId}
              depth={depth + 1}
              onRequestClick={onRequestClick}
              onRequestDelete={onRequestDelete}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              openMenu={openMenu}
              onMenuOpen={onMenuOpen}
              onCreateNewRequest={onCreateNewRequest}
              onShowRenameModal={onShowRenameModal}
              onShowDeleteConfirm={onShowDeleteConfirm}
            />
          ))}

          {folder.requests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              depth={depth + 1}
              onRequestClick={onRequestClick}
              onRequestDelete={onRequestDelete}
              openMenu={openMenu}
              onMenuOpen={onMenuOpen}
              onShowRenameModal={onShowRenameModal}
              onShowDeleteConfirm={onShowDeleteConfirm}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface RequestItemProps {
  request: SavedRequest
  depth: number
  onRequestClick: (request: SavedRequest) => void
  onRequestDelete: (requestId: string) => void
  openMenu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null
  onMenuOpen: (menu: { type: 'collection' | 'folder' | 'request'; id: string; collectionId?: string } | null) => void
  onShowRenameModal: (type: 'collection' | 'folder' | 'request', id: string, currentName: string, collectionId?: string) => void
  onShowDeleteConfirm: (type: 'collection' | 'folder' | 'request', id: string, name: string, collectionId?: string) => void
}

function RequestItem({ request, depth, onRequestClick, openMenu, onMenuOpen, onShowRenameModal, onShowDeleteConfirm }: RequestItemProps) {
  const paddingLeft = 32 + depth * 16
  const isMenuOpen = openMenu?.type === 'request' && openMenu?.id === request.id
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="group relative flex w-full items-start gap-2 px-4 py-2.5 hover:bg-surface-muted/40" style={{ paddingLeft }}>
      <button
        onClick={() => onRequestClick(request)}
        className="flex flex-1 min-w-0 items-start gap-2 text-left transition-all duration-150 hover:translate-x-1"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              <MethodTypeBadge methodType={request.methodType} compact={true} />
            </div>
            <span className="text-sm font-medium text-foreground truncate" title={request.name}>{request.name}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate" title={`${request.service}.${request.method}`}>
            {request.service}.{request.method}
          </div>
        </div>
        <div className="pt-1 text-muted-foreground/40 flex-shrink-0">›</div>
      </button>

      <div className="relative pt-1 flex-shrink-0">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation()
            onMenuOpen(isMenuOpen ? null : { type: 'request', id: request.id })
          }}
          className="rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          •••
        </button>
        
        <PortalMenu
          isOpen={isMenuOpen}
          anchorRef={buttonRef}
          onClose={() => onMenuOpen(null)}
        >
          <div className="py-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onShowRenameModal('request', request.id, request.name)
                onMenuOpen(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted whitespace-nowrap"
            >
              <span>Rename</span>
            </button>
            <div className="my-1 border-t border-border/50" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onShowDeleteConfirm('request', request.id, request.name)
                onMenuOpen(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10 whitespace-nowrap"
            >
              <span>Delete</span>
            </button>
          </div>
        </PortalMenu>
      </div>
    </div>
  )
}

function countTotalRequests(collection: Collection): number {
  return collection.requests.length + collection.folders.reduce((sum, folder) => sum + countFolderRequests(folder), 0)
}

function countFolderRequests(folder: Folder): number {
  return folder.requests.length + folder.folders.reduce((sum, f) => sum + countFolderRequests(f), 0)
}
