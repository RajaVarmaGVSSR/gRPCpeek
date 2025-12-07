import { useState, useEffect, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Label, Card } from '../ui'
import { ImportPathManager } from './ImportPathManager'
import { EnvironmentEditorModal } from './EnvironmentEditorModal'
import type { Workspace, Environment, Variable, AuthConfig } from '../../types/workspace'

interface WorkspaceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: Workspace
  onSave: (updates: Partial<Workspace>) => void
  onImportPathAdd: (path: string, type: 'file' | 'directory') => void
  onImportPathRemove: (id: string) => void
  onImportPathToggle: (id: string) => void
  onReparse?: () => Promise<void>
  onEnvironmentCreate: (config: {
    name: string
    host: string
    port: number
    variables?: Variable[]
    metadata?: Record<string, string>
    auth?: AuthConfig
  }) => string
  onEnvironmentUpdate: (environmentId: string, updates: Partial<Environment>) => void
  onEnvironmentDelete: (environmentId: string) => void
  initialTab?: 'general' | 'imports' | 'globals' | 'environments'
}

/**
 * Modal for managing workspace-level settings:
 * - Workspace name
 * - Import paths for proto files
 * - Global variables
 * - Other workspace configuration
 */
export function WorkspaceSettingsModal({
  isOpen,
  onClose,
  workspace,
  onSave,
  onImportPathAdd,
  onImportPathRemove,
  onImportPathToggle,
  onReparse,
  onEnvironmentCreate,
  onEnvironmentUpdate,
  onEnvironmentDelete,
  initialTab = 'general',
}: WorkspaceSettingsModalProps) {
  const [workspaceName, setWorkspaceName] = useState(workspace.name)
  const [activeTab, setActiveTab] = useState<'general' | 'imports' | 'globals' | 'environments'>(initialTab)
  const [environmentModalEnv, setEnvironmentModalEnv] = useState<Environment | null>(null)
  const [isCreatingNewEnvironment, setIsCreatingNewEnvironment] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  // Update internal state when workspace prop changes (e.g., after creating/editing environments)
  useEffect(() => {
    if (isOpen) {
      setWorkspaceName(workspace.name)
      setActiveTab(initialTab)
      setEnvironmentModalEnv(null)
      setIsCreatingNewEnvironment(false)
    }
  }, [isOpen, initialTab])

  // Sync workspace name when workspace prop changes while modal is open
  useEffect(() => {
    if (isOpen) {
      setWorkspaceName(workspace.name)
    }
  }, [isOpen, workspace.name])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({ name: workspaceName })
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const startCreateEnvironment = () => {
    setIsCreatingNewEnvironment(true)
  }

  const handleEnvironmentRemoval = (environmentId: string, environmentName: string): boolean => {
    setDeleteConfirm({ id: environmentId, name: environmentName })
    return false // Return false to prevent immediate deletion; will be handled via modal confirm
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Workspace Settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure workspace-level options
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            ✕
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 px-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('imports')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'imports'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Import Paths
          </button>
          <button
            onClick={() => setActiveTab('globals')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'globals'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Global Variables
          </button>
          <button
            onClick={() => setActiveTab('environments')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'environments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Environments
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                  className="mt-2"
                  autoFocus
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  A descriptive name for this workspace
                </p>
              </div>

              <Card className="p-4 bg-surface-muted/50">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Workspace Info</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>ID:</span>
                      <span className="font-mono">{workspace.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Collections:</span>
                      <span>{workspace.collections.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Environments:</span>
                      <span>{workspace.environments.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Global Variables:</span>
                      <span>{workspace.globals.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Import Paths:</span>
                      <span>{workspace.importPaths.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span>{new Date(workspace.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span>{new Date(workspace.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Import Paths Tab */}
          {activeTab === 'imports' && (
            <ImportPathManager
              importPaths={workspace.importPaths}
              onAdd={onImportPathAdd}
              onRemove={onImportPathRemove}
              onToggle={onImportPathToggle}
              onReparse={onReparse}
            />
          )}

          {/* Global Variables Tab */}
          {activeTab === 'globals' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Global Variables</h3>
                <Button size="sm" onClick={() => {
                  const newVariable: Variable = {
                    id: `var-${Date.now()}`,
                    key: '',
                    value: '',
                    enabled: true,
                    secret: false,
                  }
                  onSave({
                    globals: [...workspace.globals, newVariable],
                  })
                }}>
                  + Add Variable
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Define variables that can be referenced in requests using <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{global.varName}}'}</code>
              </p>

              {workspace.globals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">No global variables yet. Click "Add Variable" to create one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workspace.globals.map((variable) => (
                    <div key={variable?.id || Math.random()} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface p-3">
                      <input
                        type="checkbox"
                        checked={variable?.enabled ?? true}
                        onChange={(e) => {
                          onSave({
                            globals: workspace.globals.map((v) =>
                              v.id === variable.id ? { ...v, enabled: e.target.checked } : v
                            ),
                          })
                        }}
                        className="h-4 w-4 rounded border-border text-focus"
                        title="Enable/disable variable"
                      />
                      
                      <Input
                        value={variable?.key || ''}
                        onChange={(e) => {
                          onSave({
                            globals: workspace.globals.map((v) =>
                              v.id === variable.id ? { ...v, key: e.target.value } : v
                            ),
                          })
                        }}
                        placeholder="KEY"
                        className="flex-1"
                      />
                      
                      <Input
                        type={variable?.secret ? 'password' : 'text'}
                        value={variable?.value || ''}
                        onChange={(e) => {
                          onSave({
                            globals: workspace.globals.map((v) =>
                              v.id === variable.id ? { ...v, value: e.target.value } : v
                            ),
                          })
                        }}
                        placeholder="value"
                        className="flex-1"
                      />
                      
                      <button
                        onClick={() => {
                          onSave({
                            globals: workspace.globals.map((v) =>
                              v.id === variable.id ? { ...v, secret: !v.secret } : v
                            ),
                          })
                        }}
                        className="rounded p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                        title={variable?.secret ? 'Show value' : 'Hide value'}
                      >
                        {variable?.secret ? '👁️' : '🔒'}
                      </button>
                      
                      <button
                        onClick={() => {
                          onSave({
                            globals: workspace.globals.filter((v) => v.id !== variable.id),
                          })
                        }}
                        className="rounded p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Delete variable"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Global variables are shared across all environments.
                  Use them for values that don't change between dev/staging/prod (like API endpoints, region names, etc.)
                </p>
              </div>
            </section>
          )}

          {activeTab === 'environments' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Environments</h3>
                  <p className="text-xs text-muted-foreground">
                    Manage per-workspace connection targets, metadata, and variables.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={startCreateEnvironment}>
                  + New Environment
                </Button>
              </div>

              {workspace.environments.length === 0 && !isCreatingNewEnvironment ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No environments yet. Create one to start sending requests.
                  </p>
                  <Button className="mt-4" size="sm" onClick={startCreateEnvironment}>
                    Create your first environment
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {workspace.environments.map((environment) => (
                    <Card key={environment.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{environment.name}</span>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">{environment.host}:{environment.port}</div>
                          <div className="text-xs text-muted-foreground">
                            {(environment.variables?.length ?? 0)} vars • {Object.keys(environment.metadata || {}).length} metadata • {((environment.auth?.type ?? 'none') === 'none') ? 'No auth' : `Auth: ${environment.auth?.type ?? 'none'}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            onClick={() => {
                              setEnvironmentModalEnv({
                                ...environment,
                                variables: environment.variables ? environment.variables.map((variable) => ({ ...variable })) : [],
                                metadata: { ...(environment.metadata || {}) },
                                auth: environment.auth ? { ...environment.auth } : { type: 'none' },
                              })
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-2 text-xs text-danger hover:text-danger"
                            variant="ghost"
                            onClick={() => handleEnvironmentRemoval(environment.id, environment.name)}
                            disabled={workspace.environments.length === 1}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-border/50 bg-surface-muted/30 p-3 text-xs text-muted-foreground">
                💡 Tip: Environments live within the current workspace. Switch workspaces from the header to manage their respective environments.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/50 p-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      {environmentModalEnv && (
        <EnvironmentEditorModal
          mode="edit"
          environment={environmentModalEnv}
          onClose={() => setEnvironmentModalEnv(null)}
          onSave={(updates) => {
            onEnvironmentUpdate(environmentModalEnv.id, updates)
            setEnvironmentModalEnv(null)
          }}
          onDelete={() => {
            if (handleEnvironmentRemoval(environmentModalEnv.id, environmentModalEnv.name)) {
              setEnvironmentModalEnv(null)
            }
          }}
        />
      )}

      {isCreatingNewEnvironment && (
        <EnvironmentEditorModal
          mode="create"
          onClose={() => setIsCreatingNewEnvironment(false)}
          onSave={(config) => {
            console.log('WorkspaceSettingsModal - Creating environment with config:', config)
            onEnvironmentCreate({
              name: config.name || 'New Environment',
              host: config.host || 'localhost',
              port: config.port || 50051,
              variables: config.variables || [],
              metadata: config.metadata || {},
              auth: config.auth || { type: 'none' },
            })
            // Note: createEnvironmentEntry already sets the new environment as active
            setIsCreatingNewEnvironment(false)
          }}
        />
      )}

      {/* Delete Environment Confirm Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-surface p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-foreground">Delete Environment</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteConfirm.name}"?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setDeleteConfirm(null)} size="sm">
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={() => {
                  onEnvironmentDelete(deleteConfirm.id)
                  setDeleteConfirm(null)
                }} 
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
