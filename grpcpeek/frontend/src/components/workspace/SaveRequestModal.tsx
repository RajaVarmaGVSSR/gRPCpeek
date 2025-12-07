import { useState, useEffect } from 'react'
import { Button, Input, Label, Card } from '../ui'
import type { Workspace, Folder, RequestTab } from '../../types/workspace'

interface SaveRequestModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: Workspace
  tab: RequestTab
  onSave: (params: {
    name: string
    collectionId: string
    collectionName?: string  // For creating new collection
    folderId?: string
    folderName?: string  // For creating new folder
  }) => void
}

export function SaveRequestModal({
  isOpen,
  onClose,
  workspace,
  tab,
  onSave,
}: SaveRequestModalProps) {
  const [requestName, setRequestName] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Initialize with tab name
  useEffect(() => {
    if (isOpen) {
      setRequestName(tab.savedRequestId ? tab.name : `${tab.service}.${tab.method}`)
      
      // Default to first collection or "My Requests" if it exists
      const myRequests = workspace.collections.find(c => c.name === 'My Requests')
      const defaultCollection = myRequests || workspace.collections[0]
      setSelectedCollectionId(defaultCollection?.id || '')
      setSelectedFolderId(undefined)
      setNewCollectionName('')
      setNewFolderName('')
      setIsCreatingCollection(false)
      setIsCreatingFolder(false)
    }
  }, [isOpen, tab, workspace.collections])

  if (!isOpen) return null

  const selectedCollection = workspace.collections.find(c => c.id === selectedCollectionId)
  
  // Get all folders in selected collection (flat list for now, can be nested later)
  const getAllFolders = (folders: Folder[], prefix = ''): Array<{ id: string; name: string }> => {
    const result: Array<{ id: string; name: string }> = []
    folders.forEach(folder => {
      result.push({ id: folder.id, name: `${prefix}${folder.name}` })
      result.push(...getAllFolders(folder.folders, `${prefix}${folder.name}/`))
    })
    return result
  }

  const availableFolders = selectedCollection ? getAllFolders(selectedCollection.folders) : []

  const handleSave = () => {
    setValidationError(null)
    
    if (!requestName.trim()) {
      setValidationError('Please enter a request name')
      return
    }

    if (isCreatingCollection) {
      if (!newCollectionName.trim()) {
        setValidationError('Please enter a collection name')
        return
      }
      onSave({
        name: requestName.trim(),
        collectionId: '__NEW__',
        collectionName: newCollectionName.trim(),
        folderId: undefined,
      })
    } else {
      if (!selectedCollectionId) {
        setValidationError('Please select a collection')
        return
      }
      
      if (isCreatingFolder) {
        if (!newFolderName.trim()) {
          setValidationError('Please enter a folder name')
          return
        }
        onSave({
          name: requestName.trim(),
          collectionId: selectedCollectionId,
          folderId: '__NEW__',
          folderName: newFolderName.trim(),
        })
      } else {
        onSave({
          name: requestName.trim(),
          collectionId: selectedCollectionId,
          folderId: selectedFolderId,
        })
      }
    }
    
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 p-6">
          <div>
            <h2 className="text-xl font-semibold">
              {tab.savedRequestId ? 'Update Request' : 'Save Request'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Save to a collection for later use
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-6">
          {/* Validation Error */}
          {validationError && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-700 dark:bg-red-950/50 dark:text-red-400">
              {validationError}
            </div>
          )}

          {/* Request Name */}
          <div className="space-y-2">
            <Label htmlFor="request-name">Request Name</Label>
            <Input
              id="request-name"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="e.g., Create User"
              autoFocus
            />
          </div>

          {/* Collection Selection */}
          <div className="space-y-2">
            <Label htmlFor="collection">Collection</Label>
            {isCreatingCollection ? (
              <div className="space-y-2">
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingCollection(false)}
                  className="text-xs"
                >
                  ← Choose existing collection
                </Button>
              </div>
            ) : (
              <>
                {workspace.collections.length > 0 ? (
                  <select
                    id="collection"
                    value={selectedCollectionId}
                    onChange={(e) => {
                      setSelectedCollectionId(e.target.value)
                      setSelectedFolderId(undefined)
                    }}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                  >
                    {workspace.collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">No collections yet</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingCollection(true)}
                  className="text-xs"
                >
                  + Create new collection
                </Button>
              </>
            )}
          </div>

          {/* Folder Selection (optional) */}
          {!isCreatingCollection && selectedCollection && (
            <div className="space-y-2">
              <Label htmlFor="folder">Folder (optional)</Label>
              {isCreatingFolder ? (
                <div className="space-y-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreatingFolder(false)
                      setNewFolderName('')
                    }}
                    className="text-xs"
                  >
                    ← Choose existing folder
                  </Button>
                </div>
              ) : (
                <>
                  <select
                    id="folder"
                    value={selectedFolderId || ''}
                    onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                  >
                    <option value="">Root (no folder)</option>
                    {availableFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-xs"
                  >
                    📁 Create new folder
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg border border-border/50 bg-surface-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Saved requests can be reopened later from the Collections sidebar.
              {tab.savedRequestId && ' Saving will update the existing saved request.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/50 p-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {tab.savedRequestId ? 'Update' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
