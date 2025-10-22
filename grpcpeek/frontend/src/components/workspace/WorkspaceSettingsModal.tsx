import { useState, useEffect, type KeyboardEvent } from 'react'
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
    if (!window.confirm(`Delete environment "${environmentName}"?`)) {
      return false
    }

    onEnvironmentDelete(environmentId)
    return true
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Global Variables</h3>
                  <p className="text-xs text-muted-foreground">
                    Variables available across all environments in this workspace
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // This will be handled by the existing GlobalVariablesModal
                    // For now, show a message
                    alert('Use the Global Variables button in the header bar to edit variables')
                  }}
                >
                  ✏️ Edit Variables
                </Button>
              </div>

              {workspace.globals.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No global variables defined. Click "Edit Variables" to add some.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {workspace.globals.map((variable) => (
                    <Card key={variable.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium font-mono text-foreground">
                              {variable.key}
                            </span>
                            {variable.secret && (
                              <span className="text-xs text-warning" title="Secret value (hidden)">
                                🔒
                              </span>
                            )}
                            {!variable.enabled && (
                              <span className="text-xs text-muted-foreground" title="Disabled">
                                (disabled)
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs font-mono text-muted-foreground truncate">
                            {variable.secret ? '••••••••' : variable.value}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Global variables are shared across all environments.
                  Use them for values that don't change between dev/staging/prod (like API endpoints, region names, etc.)
                </p>
              </div>
            </div>
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
    </div>
  )
}
