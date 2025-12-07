// Workspace Storage & Management
// Clean API for managing workspaces, collections, environments, etc.

import type {
  Workspace,
  Environment,
  Collection,
  Folder,
  SavedRequest,
  Variable,
  ImportPath,
  HistoryEntry,
  RequestTab,
} from '../types/workspace'

const STORAGE_KEY = 'grpcpeek_workspaces_v2'
const ACTIVE_WORKSPACE_KEY = 'grpcpeek_active_workspace_v2'

// ============================================================================
// Workspace Management
// ============================================================================

export function createWorkspace(name: string): Workspace {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name,
    importPaths: [],
    globals: [],
    environments: [createDefaultEnvironment()],
    collections: [],
    requestHistory: [],
    services: [],  // Initialize empty services array
    openTabs: [],  // Initialize empty tabs array
    activeTabId: null,  // No active tab initially
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Migrates a workspace object to ensure it has all required properties
 */
function migrateWorkspace(workspace: any): Workspace {
  // Migrate environments to ensure they have auth and tls properties
  const migratedEnvironments = (workspace.environments || [createDefaultEnvironment()]).map((env: any) => ({
    ...env,
    auth: env.auth || { type: 'none' }, // Add default auth if missing
    tls: env.tls || { enabled: false }, // Add default TLS config if missing
  }))

  return {
    ...workspace,
    collections: workspace.collections || [],
    environments: migratedEnvironments,
    globals: workspace.globals || [],
    importPaths: workspace.importPaths || [],
    // Add session state fields if missing
    services: workspace.services || [],
    openTabs: workspace.openTabs || [],
    activeTabId: workspace.activeTabId !== undefined ? workspace.activeTabId : null,
  }
}

export function getAllWorkspaces(): Workspace[] {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    // Migrate workspaces to ensure they have all required properties
    return parsed.map(migrateWorkspace)
  } catch {
    return []
  }
}

export function getWorkspaceById(id: string): Workspace | null {
  const workspaces = getAllWorkspaces()
  return workspaces.find((w) => w.id === id) || null
}

export function getActiveWorkspace(): Workspace | null {
  const activeId = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  if (!activeId) {
    // Auto-create default workspace
    const workspace = createWorkspace('Default Workspace')
    saveWorkspace(workspace)
    setActiveWorkspace(workspace.id)
    return workspace
  }
  return getWorkspaceById(activeId)
}

export function saveWorkspace(workspace: Workspace): void {
  workspace.updatedAt = new Date().toISOString()
  const workspaces = getAllWorkspaces()
  const index = workspaces.findIndex((w) => w.id === workspace.id)
  
  if (index >= 0) {
    workspaces[index] = workspace
  } else {
    workspaces.push(workspace)
  }
  
  console.log('workspace.ts - saveWorkspace - Saving to localStorage:', workspace)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces))
  console.log('workspace.ts - saveWorkspace - Saved successfully')
}

export function deleteWorkspace(id: string): void {
  const workspaces = getAllWorkspaces()
  const filtered = workspaces.filter((w) => w.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  
  // If deleting active workspace, clear active
  if (localStorage.getItem(ACTIVE_WORKSPACE_KEY) === id) {
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
  }
}

export function renameWorkspace(id: string, newName: string): Workspace | null {
  const workspace = getWorkspaceById(id)
  if (!workspace) return null
  
  workspace.name = newName
  workspace.updatedAt = new Date().toISOString()
  saveWorkspace(workspace)
  return workspace
}

export function setActiveWorkspace(id: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
}

// ============================================================================
// Environment Management
// ============================================================================

function createDefaultEnvironment(): Environment {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: 'Local',
    host: 'localhost',
    port: 50051,
    variables: [],
    auth: { type: 'none' },
    metadata: {},
    tls: { enabled: false },
    createdAt: now,
    updatedAt: now,
  }
}

export function createEnvironment(
  name: string,
  host: string,
  port: number
): Environment {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name,
    host,
    port,
    variables: [],
    auth: { type: 'none' },
    metadata: {},
    tls: { enabled: false },
    createdAt: now,
    updatedAt: now,
  }
}

export function addEnvironment(
  workspace: Workspace,
  environment: Environment
): Workspace {
  return {
    ...workspace,
    environments: [...workspace.environments, environment],
    updatedAt: new Date().toISOString(),
  }
}

export function updateEnvironment(
  workspace: Workspace,
  environmentId: string,
  updates: Partial<Environment>
): Workspace {
  console.log('workspace.ts - updateEnvironment called:', { environmentId, updates })
  const result = {
    ...workspace,
    environments: workspace.environments.map((env) =>
      env.id === environmentId
        ? {
            ...env,
            // Spread non-nested properties from updates first
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.host !== undefined && { host: updates.host }),
            ...(updates.port !== undefined && { port: updates.port }),
            // Ensure nested objects are properly cloned AFTER
            variables: updates.variables !== undefined ? updates.variables.map(v => ({ ...v })) : env.variables,
            metadata: updates.metadata !== undefined ? { ...updates.metadata } : env.metadata,
            auth: updates.auth !== undefined ? { ...updates.auth } : env.auth,
            updatedAt: new Date().toISOString(),
          }
        : env
    ),
    updatedAt: new Date().toISOString(),
  }
  console.log('workspace.ts - updateEnvironment result:', result)
  return result
}

export function deleteEnvironment(
  workspace: Workspace,
  environmentId: string
): Workspace {
  return {
    ...workspace,
    environments: workspace.environments.filter((env) => env.id !== environmentId),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Import Path Management
// ============================================================================

export function addImportPath(
  workspace: Workspace,
  path: string,
  type: 'file' | 'directory'
): Workspace {
  const importPath: ImportPath = {
    id: generateId(),
    path,
    type,
    enabled: true,
  }
  
  return {
    ...workspace,
    importPaths: [...workspace.importPaths, importPath],
    updatedAt: new Date().toISOString(),
  }
}

export function removeImportPath(
  workspace: Workspace,
  importPathId: string
): Workspace {
  return {
    ...workspace,
    importPaths: workspace.importPaths.filter((ip) => ip.id !== importPathId),
    updatedAt: new Date().toISOString(),
  }
}

export function toggleImportPath(
  workspace: Workspace,
  importPathId: string
): Workspace {
  return {
    ...workspace,
    importPaths: workspace.importPaths.map((ip) =>
      ip.id === importPathId ? { ...ip, enabled: !ip.enabled } : ip
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function updateImportPathTimestamp(
  workspace: Workspace,
  importPathId: string
): Workspace {
  return {
    ...workspace,
    importPaths: workspace.importPaths.map((ip) =>
      ip.id === importPathId
        ? { ...ip, lastParsed: new Date().toISOString() }
        : ip
    ),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Global Variables Management
// ============================================================================

export function addGlobalVariable(
  workspace: Workspace,
  key: string,
  value: string,
  secret = false
): Workspace {
  const variable: Variable = {
    id: generateId(),
    key,
    value,
    enabled: true,
    secret,
  }
  
  return {
    ...workspace,
    globals: [...workspace.globals, variable],
    updatedAt: new Date().toISOString(),
  }
}

export function updateGlobalVariable(
  workspace: Workspace,
  variableId: string,
  updates: Partial<Variable>
): Workspace {
  return {
    ...workspace,
    globals: workspace.globals.map((v) =>
      v.id === variableId ? { ...v, ...updates } : v
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function deleteGlobalVariable(
  workspace: Workspace,
  variableId: string
): Workspace {
  return {
    ...workspace,
    globals: workspace.globals.filter((v) => v.id !== variableId),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Collection Management
// ============================================================================

export function createCollection(name: string): Collection {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function addCollection(
  workspace: Workspace,
  collection: Collection
): Workspace {
  return {
    ...workspace,
    collections: [...workspace.collections, collection],
    updatedAt: new Date().toISOString(),
  }
}

export function updateCollection(
  workspace: Workspace,
  collectionId: string,
  updates: Partial<Collection>
): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.map((col) =>
      col.id === collectionId
        ? { ...col, ...updates, updatedAt: new Date().toISOString() }
        : col
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function deleteCollection(
  workspace: Workspace,
  collectionId: string
): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.filter((col) => col.id !== collectionId),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Folder Management (Nested)
// ============================================================================

export function createFolder(name: string): Folder {
  return {
    id: generateId(),
    name,
    folders: [],
    requests: [],
    collapsed: false,
  }
}

// Helper to find and update a folder recursively
function updateFolderRecursive(
  folders: Folder[],
  folderId: string,
  updateFn: (folder: Folder) => Folder
): Folder[] {
  return folders.map((folder) => {
    if (folder.id === folderId) {
      return updateFn(folder)
    }
    return {
      ...folder,
      folders: updateFolderRecursive(folder.folders, folderId, updateFn),
    }
  })
}

export function addFolderToCollection(
  workspace: Workspace,
  collectionId: string,
  folder: Folder,
  parentFolderId?: string
): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.map((col) => {
      if (col.id !== collectionId) return col
      
      if (!parentFolderId) {
        // Add to top level
        return {
          ...col,
          folders: [...col.folders, folder],
          updatedAt: new Date().toISOString(),
        }
      }
      
      // Add to nested folder
      return {
        ...col,
        folders: updateFolderRecursive(col.folders, parentFolderId, (parent) => ({
          ...parent,
          folders: [...parent.folders, folder],
        })),
        updatedAt: new Date().toISOString(),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

// Helper to delete a folder recursively
function deleteFolderRecursive(
  folders: Folder[],
  folderId: string
): Folder[] {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      folders: deleteFolderRecursive(folder.folders, folderId),
    }))
}

export function deleteFolderFromCollection(
  workspace: Workspace,
  collectionId: string,
  folderId: string
): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.map((col) => {
      if (col.id !== collectionId) return col
      
      return {
        ...col,
        folders: deleteFolderRecursive(col.folders, folderId),
        updatedAt: new Date().toISOString(),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function renameFolderInCollection(
  workspace: Workspace,
  collectionId: string,
  folderId: string,
  newName: string
): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.map((col) => {
      if (col.id !== collectionId) return col
      
      return {
        ...col,
        folders: updateFolderRecursive(col.folders, folderId, (folder) => ({
          ...folder,
          name: newName,
        })),
        updatedAt: new Date().toISOString(),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Saved Request Management
// ============================================================================

export function createSavedRequest(
  name: string,
  service: string,
  method: string,
  tab: RequestTab
): SavedRequest {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name,
    service,
    method,
    methodType: tab.methodType,
    requestBody: tab.requestBody,
    metadata: tab.metadata,
    auth: tab.auth,
    createdAt: now,
    updatedAt: now,
  }
}

// ============================================================================
// History Management
// ============================================================================

export function addToHistory(
  workspace: Workspace,
  entry: Omit<HistoryEntry, 'id'>
): Workspace {
  const historyEntry: HistoryEntry = {
    ...entry,
    id: generateId(),
  }
  
  return {
    ...workspace,
    requestHistory: [historyEntry, ...workspace.requestHistory].slice(0, 30), // Keep last 30
    updatedAt: new Date().toISOString(),
  }
}

export function clearHistory(workspace: Workspace): Workspace {
  return {
    ...workspace,
    requestHistory: [],
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function getEndpoint(environment: Environment | null): string {
  if (!environment) return 'http://localhost:50051'
  return `http://${environment.host}:${environment.port}`
}

// ============================================================================
// Session State Management (Services & Tabs)
// ============================================================================

export function saveServicesToWorkspace(
  workspace: Workspace,
  services: any[]
): Workspace {
  return {
    ...workspace,
    services: services,
    updatedAt: new Date().toISOString(),
  }
}

export function saveTabsToWorkspace(
  workspace: Workspace,
  tabs: RequestTab[],
  activeTabId: string | null
): Workspace {
  return {
    ...workspace,
    openTabs: tabs,
    activeTabId: activeTabId,
    updatedAt: new Date().toISOString(),
  }
}

export function clearWorkspaceSession(workspace: Workspace): Workspace {
  return {
    ...workspace,
    services: [],
    openTabs: [],
    activeTabId: null,
    updatedAt: new Date().toISOString(),
  }
}
