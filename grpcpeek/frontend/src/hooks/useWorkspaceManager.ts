import { useState, useCallback } from 'react'
import type { Workspace, Variable, Environment, AuthConfig } from '../types/workspace'
import {
  getActiveWorkspace,
  getAllWorkspaces,
  getWorkspaceById,
  saveWorkspace,
  createWorkspace as createWorkspaceStorage,
  renameWorkspace as renameWorkspaceStorage,
  deleteWorkspace as deleteWorkspaceStorage,
  setActiveWorkspace as setActiveWorkspaceId,
  createEnvironment as createEnvironmentEntity,
  addEnvironment,
  updateEnvironment,
  deleteEnvironment,
  addGlobalVariable,
  deleteGlobalVariable,
  addImportPath,
  removeImportPath,
  toggleImportPath,
} from '../lib/workspace'

export interface UseWorkspaceManagerReturn {
  // State
  workspace: Workspace
  workspaces: Workspace[]

  // Workspace operations
  switchWorkspace: (workspaceId: string) => void
  createWorkspace: (name: string) => Workspace
  renameWorkspace: (workspaceId: string, newName: string) => void
  deleteWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => void
  updateWorkspace: (updates: Partial<Workspace>) => void

  // Environment operations
  createEnvironmentEntry: (config: {
    name: string
    host: string
    port: number
    variables?: Variable[]
    metadata?: Record<string, string>
    auth?: AuthConfig
  }) => string
  updateEnvironmentEntry: (environmentId: string, updates: Partial<Environment>) => void
  deleteEnvironmentEntry: (environmentId: string) => void

  // Global variables operations
  handleGlobalVariablesSave: (variables: Variable[]) => void

  // Import path operations
  handleImportPathAdd: (path: string, type: 'file' | 'directory') => void
  handleImportPathRemove: (id: string) => void
  handleImportPathToggle: (id: string) => void

  // Low-level setters (for special cases)
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>
}

/**
 * Custom hook to manage workspace state and operations
 */
export function useWorkspaceManager(): UseWorkspaceManagerReturn {
  const [workspace, setWorkspace] = useState(() => {
    const ws = getActiveWorkspace()
    if (!ws) {
      throw new Error('Failed to initialize workspace')
    }
    return ws
  })

  const [workspaces, setWorkspaces] = useState(() => getAllWorkspaces())

  const syncWorkspaceState = useCallback((updatedWorkspace: Workspace) => {
    saveWorkspace(updatedWorkspace)
    setWorkspace(updatedWorkspace)
    setWorkspaces(getAllWorkspaces())
  }, [])

  const refreshWorkspaces = useCallback(() => {
    setWorkspaces(getAllWorkspaces())
  }, [])

  const switchWorkspace = useCallback((workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId)
    if (ws) {
      setActiveWorkspaceId(workspaceId)
      setWorkspace(ws)
    }
  }, [workspaces])

  const createWorkspace = useCallback((name: string) => {
    const newWorkspace = createWorkspaceStorage(name)

    saveWorkspace(newWorkspace)
    setActiveWorkspaceId(newWorkspace.id)
    setWorkspace(newWorkspace)
    setWorkspaces(getAllWorkspaces())
    return newWorkspace
  }, [])

  const renameWorkspace = useCallback((workspaceId: string, newName: string) => {
    renameWorkspaceStorage(workspaceId, newName)
    const updatedWorkspaces = getAllWorkspaces()
    setWorkspaces(updatedWorkspaces)
    
    // Update current workspace if it's the one being renamed
    if (workspace.id === workspaceId) {
      const updated = updatedWorkspaces.find(w => w.id === workspaceId)
      if (updated) {
        setWorkspace(updated)
      }
    }
  }, [workspace.id])

  const deleteWorkspace = useCallback((workspaceId: string) => {
    deleteWorkspaceStorage(workspaceId)
    const updatedWorkspaces = getAllWorkspaces()
    setWorkspaces(updatedWorkspaces)
    
    // If we deleted the active workspace, switch to the first available one
    if (workspace.id === workspaceId && updatedWorkspaces.length > 0) {
      const firstWorkspace = updatedWorkspaces[0]
      setActiveWorkspaceId(firstWorkspace.id)
      setWorkspace(firstWorkspace)
    }
  }, [workspace.id])

  const createEnvironmentEntry = useCallback((config: {
    name: string
    host: string
    port: number
    variables?: Variable[]
    metadata?: Record<string, string>
    auth?: AuthConfig
  }) => {
    console.log('useWorkspaceManager - createEnvironmentEntry called with:', config)
    const environment = createEnvironmentEntity(config.name, config.host, config.port)
    environment.variables = config.variables ? config.variables.map((variable) => ({ ...variable })) : []
    environment.metadata = { ...(config.metadata || {}) }
    environment.auth = config.auth ? { ...config.auth } : { type: 'none' }
    console.log('useWorkspaceManager - Created environment entity:', environment)

    const updated = addEnvironment(workspace, environment)
    console.log('useWorkspaceManager - After addEnvironment:', updated)
    syncWorkspaceState(updated)
    console.log('useWorkspaceManager - After syncWorkspaceState, returning ID:', environment.id)
    return environment.id
  }, [workspace, syncWorkspaceState])

  const updateEnvironmentEntry = useCallback((environmentId: string, updates: Partial<Environment>) => {
    console.log('useWorkspaceManager - updateEnvironmentEntry called with:', { environmentId, updates })
    const updated = updateEnvironment(workspace, environmentId, updates)
    console.log('useWorkspaceManager - Updated workspace:', updated)
    syncWorkspaceState(updated)
  }, [workspace, syncWorkspaceState])

  const deleteEnvironmentEntry = useCallback((environmentId: string) => {
    const updated = deleteEnvironment(workspace, environmentId)
    syncWorkspaceState(updated)
  }, [workspace, syncWorkspaceState])

  const handleGlobalVariablesSave = useCallback((variables: Variable[]) => {
    // Start with current workspace and chain updates
    let updatedWorkspace = { ...workspace }
    
    // Clear existing globals
    workspace.globals.forEach(v => {
      updatedWorkspace = deleteGlobalVariable(updatedWorkspace, v.id)
    })
    
    // Add new globals
    variables.forEach(v => {
      updatedWorkspace = addGlobalVariable(updatedWorkspace, v.key, v.value, v.secret || false)
    })
    
    saveWorkspace(updatedWorkspace)
    setWorkspace(updatedWorkspace)
  }, [workspace])

  const updateWorkspace = useCallback((updates: Partial<Workspace>) => {
    // Get the latest workspace from storage to avoid overwriting recent changes
    const latestWorkspace = getWorkspaceById(workspace.id) || workspace
    const updatedWorkspace = { ...latestWorkspace, ...updates, updatedAt: new Date().toISOString() }
    console.log('useWorkspaceManager - updateWorkspace:', { latestWorkspace, updates, updatedWorkspace })
    saveWorkspace(updatedWorkspace)
    setWorkspace(updatedWorkspace)
    
    // Also update in the workspaces list
    const updatedWorkspaces = getAllWorkspaces()
    setWorkspaces(updatedWorkspaces)
  }, [workspace])

  const handleImportPathAdd = useCallback((path: string, type: 'file' | 'directory') => {
    const updated = addImportPath(workspace, path, type)
    saveWorkspace(updated)
    setWorkspace(updated)
  }, [workspace])

  const handleImportPathRemove = useCallback((id: string) => {
    const updated = removeImportPath(workspace, id)
    saveWorkspace(updated)
    setWorkspace(updated)
  }, [workspace])

  const handleImportPathToggle = useCallback((id: string) => {
    const updated = toggleImportPath(workspace, id)
    saveWorkspace(updated)
    setWorkspace(updated)
  }, [workspace])

  return {
    // State
    workspace,
    workspaces,

    // Workspace operations
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
    updateWorkspace,

    // Environment operations
    createEnvironmentEntry,
    updateEnvironmentEntry,
    deleteEnvironmentEntry,

    // Global variables operations
    handleGlobalVariablesSave,

    // Import path operations
    handleImportPathAdd,
    handleImportPathRemove,
    handleImportPathToggle,

    // Low-level setters
    setWorkspace,
    setWorkspaces,
  }
}
