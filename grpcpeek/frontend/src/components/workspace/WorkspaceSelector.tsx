/**
 * WorkspaceSelector - Dropdown to manage workspaces
 * 
 * Features:
 * - List all workspaces
 * - Switch active workspace
 * - Create new workspace
 * - Rename workspace
 * - Delete workspace
 * - Show active indicator
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '../ui'
import type { Workspace } from '../../types/workspace'

interface WorkspaceSelectorProps {
  workspaces: Workspace[]
  activeWorkspaceId: string
  onSwitch: (workspaceId: string) => void
  onCreate: () => void
  onRename: (workspaceId: string) => void
  onDelete: (workspaceId: string) => void
  onSettings: (workspaceId: string) => void
}

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onSettings,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleWorkspaceAction = (action: () => void) => {
    action()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Workspace Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-border hover:bg-surface-muted"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="max-w-[150px] truncate">
          {activeWorkspace?.name || 'No Workspace'}
        </span>
        <svg
          className={`h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-surface shadow-xl animate-fade-in">
          {/* Header */}
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleWorkspaceAction(onCreate)}
                title="Create new workspace"
                className="h-6 px-2 text-xs"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="ml-1">New</span>
              </Button>
            </div>
          </div>

          {/* Workspace List */}
          <div className="max-h-80 overflow-y-auto">
            {workspaces.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No workspaces found
              </div>
            ) : (
              <div className="py-2">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`group flex items-center justify-between px-3 py-2 transition hover:bg-surface-muted ${
                      workspace.id === activeWorkspaceId ? 'bg-surface-muted/50' : ''
                    }`}
                  >
                    {/* Workspace Name */}
                    <button
                      onClick={() => handleWorkspaceAction(() => onSwitch(workspace.id))}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {/* Active Indicator */}
                      {workspace.id === activeWorkspaceId && (
                        <svg
                          className="h-4 w-4 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      
                      <div className="flex-1">
                        <div className="text-sm font-medium">{workspace.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {workspace.collections?.length || 0} collections • {workspace.environments?.length || 0} envs
                        </div>
                      </div>
                    </button>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {/* Settings */}
                      <button
                        onClick={() => handleWorkspaceAction(() => onSettings(workspace.id))}
                        className="rounded p-1 text-muted-foreground transition hover:bg-surface-emphasis/10 hover:text-foreground"
                        title="Workspace settings"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>

                      {/* Rename */}
                      <button
                        onClick={() => handleWorkspaceAction(() => onRename(workspace.id))}
                        className="rounded p-1 text-muted-foreground transition hover:bg-surface-emphasis/10 hover:text-foreground"
                        title="Rename workspace"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      {/* Delete - Only show if not the last workspace */}
                      {workspaces.length > 1 && (
                        <button
                          onClick={() => handleWorkspaceAction(() => onDelete(workspace.id))}
                          className="rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                          title="Delete workspace"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
