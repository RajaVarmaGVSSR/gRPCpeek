/**
 * CreateWorkspaceModal - Modal to create or rename a workspace
 * 
 * Features:
 * - Create new workspace with name
 * - Rename existing workspace
 * - Validation for empty names and duplicates
 */

import { useState, useEffect } from 'react'
import { Button, Input, Label } from '../ui'

interface CreateWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => void
  existingNames: string[]
  mode: 'create' | 'rename'
  currentName?: string
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSave,
  existingNames,
  mode,
  currentName = '',
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setError('')
    }
  }, [isOpen, currentName])

  if (!isOpen) return null

  const handleSave = () => {
    // Validation
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      setError('Workspace name cannot be empty')
      return
    }

    if (trimmedName.length < 2) {
      setError('Workspace name must be at least 2 characters')
      return
    }

    if (trimmedName.length > 50) {
      setError('Workspace name must be less than 50 characters')
      return
    }

    // Check for duplicates (case-insensitive, excluding current name for rename)
    const isDuplicate = existingNames.some(
      existingName => 
        existingName.toLowerCase() === trimmedName.toLowerCase() &&
        existingName !== currentName
    )

    if (isDuplicate) {
      setError('A workspace with this name already exists')
      return
    }

    onSave(trimmedName)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === 'create' ? 'Create Workspace' : 'Rename Workspace'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'create' 
                ? 'Create a new workspace to organize your gRPC requests'
                : 'Enter a new name for this workspace'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              type="text"
              placeholder="e.g., Production APIs, Development, Testing"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className={error ? 'border-danger' : ''}
            />
            {error && (
              <p className="text-xs text-danger flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Give your workspace a descriptive name to help organize your work
            </p>
          </div>

          {mode === 'create' && (
            <div className="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">What's included:</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <svg className="h-3 w-3 mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Separate collections and saved requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-3 w-3 mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Independent environments and variables</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-3 w-3 mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Request history and proto import paths</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border p-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Workspace' : 'Rename'}
          </Button>
        </div>
      </div>
    </div>
  )
}
