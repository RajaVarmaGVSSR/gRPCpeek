import type { Workspace, SavedRequest, Environment } from '../types/workspace'

const WORKSPACE_STORAGE_KEY = 'grpcpeek_workspace'
const HISTORY_MAX_SIZE = 20

function getDefaultWorkspace(): Workspace {
  return {
    id: crypto.randomUUID(),
    name: 'Default Workspace',
    protoImportPaths: [],
    defaultMetadata: {},
    variables: {},
    environments: [
      {
        id: crypto.randomUUID(),
        name: 'Local',
        host: 'localhost',
        port: 50051,
        metadata: {},
        variables: {},
      },
    ],
    activeEnvironmentId: null,
    savedRequests: [],
    requestHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function loadWorkspace(): Workspace {
  try {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (stored) {
      const workspace = JSON.parse(stored) as Workspace
      // Set first environment as active if none selected
      if (!workspace.activeEnvironmentId && workspace.environments.length > 0) {
        workspace.activeEnvironmentId = workspace.environments[0].id
      }
      return workspace
    }
  } catch (error) {
    console.error('Failed to load workspace:', error)
  }
  return getDefaultWorkspace()
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    workspace.updatedAt = Date.now()
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
  } catch (error) {
    console.error('Failed to save workspace:', error)
  }
}

export function addToHistory(
  workspace: Workspace,
  request: Omit<SavedRequest, 'id' | 'timestamp'>
): Workspace {
  const historyItem: SavedRequest = {
    ...request,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }

  const newHistory = [historyItem, ...workspace.requestHistory].slice(0, HISTORY_MAX_SIZE)

  return {
    ...workspace,
    requestHistory: newHistory,
  }
}

export function saveRequest(
  workspace: Workspace,
  request: Omit<SavedRequest, 'id' | 'timestamp'>
): Workspace {
  const savedRequest: SavedRequest = {
    ...request,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }

  return {
    ...workspace,
    savedRequests: [...workspace.savedRequests, savedRequest],
  }
}

export function deleteRequest(workspace: Workspace, requestId: string): Workspace {
  return {
    ...workspace,
    savedRequests: workspace.savedRequests.filter((req) => req.id !== requestId),
  }
}

export function updateRequest(
  workspace: Workspace,
  requestId: string,
  updates: Partial<SavedRequest>
): Workspace {
  return {
    ...workspace,
    savedRequests: workspace.savedRequests.map((req) =>
      req.id === requestId ? { ...req, ...updates, timestamp: Date.now() } : req
    ),
  }
}

export function addEnvironment(workspace: Workspace, env: Omit<Environment, 'id'>): Workspace {
  const newEnv: Environment = {
    ...env,
    id: crypto.randomUUID(),
  }

  return {
    ...workspace,
    environments: [...workspace.environments, newEnv],
    activeEnvironmentId: workspace.activeEnvironmentId || newEnv.id,
  }
}

export function updateEnvironment(
  workspace: Workspace,
  envId: string,
  updates: Partial<Environment>
): Workspace {
  return {
    ...workspace,
    environments: workspace.environments.map((env) =>
      env.id === envId ? { ...env, ...updates } : env
    ),
  }
}

export function deleteEnvironment(workspace: Workspace, envId: string): Workspace {
  const newEnvironments = workspace.environments.filter((env) => env.id !== envId)
  let newActiveId = workspace.activeEnvironmentId

  if (workspace.activeEnvironmentId === envId && newEnvironments.length > 0) {
    newActiveId = newEnvironments[0].id
  }

  return {
    ...workspace,
    environments: newEnvironments,
    activeEnvironmentId: newActiveId,
  }
}

export function setActiveEnvironment(workspace: Workspace, envId: string): Workspace {
  return {
    ...workspace,
    activeEnvironmentId: envId,
  }
}

export function getActiveEnvironment(workspace: Workspace): Environment | null {
  if (!workspace.activeEnvironmentId) return null
  return workspace.environments.find((env) => env.id === workspace.activeEnvironmentId) || null
}

export function updateWorkspaceSettings(
  workspace: Workspace,
  settings: Partial<Workspace>
): Workspace {
  return {
    ...workspace,
    ...settings,
  }
}
