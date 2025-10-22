import { useState, useMemo, useCallback, useEffect, type ChangeEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Service, SavedRequest, RequestTab, HistoryEntry, Workspace, VariableContext } from '../types/workspace'
import {
  saveWorkspace,
  addToHistory as addToHistoryV2,
  createSavedRequest,
  createCollection,
  addCollection,
} from '../lib/workspace'
import { resolveVariables, resolveMetadataVariables } from '../lib/variableResolver'

export interface UseRequestManagerReturn {
  // State
  services: Service[]
  tabs: RequestTab[]
  activeTabId: string | null
  activeTab: RequestTab | undefined
  isGenerating: boolean
  protoContent: string
  allSavedRequests: SavedRequest[]

  // Tab operations
  createNewTab: (service: string, method: string) => void
  closeTab: (tabId: string) => void
  setActiveTabId: (id: string | null) => void
  updateActiveTab: (updates: Partial<RequestTab>) => void
  syncFromEnvironment: (environmentId?: string | null) => void

  // Proto operations
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  setServices: React.Dispatch<React.SetStateAction<Service[]>>
  setProtoContent: React.Dispatch<React.SetStateAction<string>>

  // Request operations
  handleGrpcCall: () => Promise<void>
  handleSaveRequest: () => void
  handleLoadRequest: (request: SavedRequest | HistoryEntry) => void
  handleDeleteRequest: (requestId: string) => void
  handleMethodClick: (service: string, method: string) => void
  handleGenerateSample: () => Promise<void>

  // Sample generation state
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Custom hook to manage request tabs, gRPC calls, and saved requests
 */
export function useRequestManager(
  workspace: Workspace,
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>,
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
): UseRequestManagerReturn {
  const [services, setServices] = useState<Service[]>([])
  const [tabs, setTabs] = useState<RequestTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [protoContent, setProtoContent] = useState('')

  useEffect(() => {
    setServices([])
    setTabs([])
    setActiveTabId(null)
    setProtoContent('')
    setIsGenerating(false)
  }, [workspace.id])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId]
  )

  const getAllSavedRequests = useCallback((): SavedRequest[] => {
    const requests: SavedRequest[] = []
    const collectRequests = (folders: any[]): void => {
      folders.forEach((folder) => {
        requests.push(...folder.requests)
        if (folder.folders) {
          collectRequests(folder.folders)
        }
      })
    }
    
    workspace.collections.forEach((collection) => {
      requests.push(...collection.requests)
      collectRequests(collection.folders)
    })
    
    return requests
  }, [workspace.collections])

  const allSavedRequests = getAllSavedRequests()

  const createNewTab = useCallback((service: string, method: string) => {
    const serviceObj = services.find((s) => s.name === service)
    const methodObj = serviceObj?.methods.find((m) => m.name === method)
    
    if (!methodObj) return

    // Use first environment as default, or undefined if no environments exist
    const defaultEnv = workspace.environments.length > 0 ? workspace.environments[0] : undefined

    const tabId = `${service}.${method}-${Date.now()}`
    const newTab: RequestTab = {
      id: tabId,
      name: `${service}.${method}`,
      service,
      method,
      methodType: methodObj.methodType,
      requestBody: methodObj.sampleRequest || '',  // Auto-populate with pre-computed sample
      // Use environment's default metadata, auth, and TLS (with fallbacks for legacy data)
      selectedEnvironmentId: defaultEnv?.id,
      metadata: defaultEnv?.metadata ? { ...defaultEnv.metadata } : {},
      auth: defaultEnv?.auth ? { ...defaultEnv.auth } : { type: 'none' },
      tls: defaultEnv?.tls ? { ...defaultEnv.tls } : { enabled: false },
      response: '',
      responseMetadata: {},
      streamingMessages: [],
      status: null,
      duration: null,
      responseSize: null,
      isStreaming: false,
      isLoading: false,
      isDirty: false,
      createdAt: new Date().toISOString(),
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(tabId)
  }, [services, workspace.environments])

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveTabId(null)
      }
      return filtered
    })
  }, [activeTabId])

  const updateActiveTab = useCallback((updates: Partial<RequestTab>) => {
    if (!activeTabId) return
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, ...updates } : tab
      )
    )
  }, [activeTabId])

  const syncFromEnvironment = useCallback((environmentId?: string | null) => {
    // Use provided environmentId or fall back to activeTab's selectedEnvironmentId
    const envIdToUse = environmentId ?? activeTab?.selectedEnvironmentId
    
    if (!activeTabId || !envIdToUse) return
    
    const selectedEnv = workspace.environments.find(env => env.id === envIdToUse)
    if (!selectedEnv) return

    // Deep copy metadata, auth, and TLS from environment
    const envMetadata = selectedEnv.metadata ? { ...selectedEnv.metadata } : {}
    const envAuth = selectedEnv.auth ? { ...selectedEnv.auth } : { type: 'none' as const }
    const envTls = selectedEnv.tls ? { ...selectedEnv.tls } : { enabled: false }

    updateActiveTab({
      metadata: envMetadata,
      auth: envAuth,
      tls: envTls,
      isDirty: true,
    })
  }, [activeTabId, activeTab, workspace.environments, updateActiveTab])

  const handleFileUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      const content = await file.text()

      try {
        const parsedServices = await invoke<Service[]>('parse_proto_file', { protoContent: content })
        setServices(parsedServices)
        setProtoContent(content)
        setTabs([])
        setActiveTabId(null)
      } catch (error) {
        if (activeTab) {
          updateActiveTab({ response: `Error parsing proto file: ${error}` })
        }
      }
    }
  }, [activeTab, updateActiveTab])

  const handleGrpcCall = useCallback(async () => {
    if (!activeTab) return

    updateActiveTab({ isLoading: true, response: '', status: null })

    const startTime = Date.now()

    try {
      // Get the environment for this tab
      const selectedEnv = workspace.environments.find(env => env.id === activeTab.selectedEnvironmentId)
      
      // Determine endpoint (use request overrides if present, otherwise use environment)
      const host = activeTab.requestHost || selectedEnv?.host || 'localhost'
      const port = activeTab.requestPort || selectedEnv?.port || 50051
      const endpoint = `http://${host}:${port}`
      
      // Build variable context for resolution
      const variableContext: VariableContext = {
        environmentVariables: selectedEnv?.variables || [],
        globalVariables: workspace.globals || [],
      }

      // Resolve variables in request body
      const bodyResult = resolveVariables(activeTab.requestBody, variableContext)
      
      // Merge environment metadata with request metadata (request takes precedence)
      const mergedMetadata = {
        ...(selectedEnv?.metadata || {}),
        ...(activeTab.metadata || {}),
      }
      
      // Resolve variables in merged metadata
      const metadataResult = resolveMetadataVariables(mergedMetadata, variableContext)

      // Use request auth if not 'none', otherwise fall back to environment auth
      const effectiveAuth = activeTab.auth.type !== 'none' ? activeTab.auth : (selectedEnv?.auth || { type: 'none' })

      // Get effective TLS config (request overrides environment)
      const effectiveTls = activeTab.tls || selectedEnv?.tls || { enabled: false }

      // Warn about unresolved variables
      const allUnresolved = [...bodyResult.unresolvedVars, ...metadataResult.unresolved]
      if (allUnresolved.length > 0) {
        const unresolvedList = allUnresolved.map(v => v.placeholder).join(', ')
        showToast(`Warning: Unresolved variables: ${unresolvedList}`, 'info')
      }

      // Prepare import paths if proto content is not available
      const importPaths = protoContent ? undefined : workspace.importPaths.filter(ip => ip.enabled)

      const resultString = await invoke<string>(
        'call_grpc_method',
        {
          protoContent: protoContent || undefined,
          importPaths: importPaths,
          endpoint,
          service: activeTab.service,
          method: activeTab.method,
          requestData: bodyResult.resolved,
          metadata: metadataResult.resolved,
          auth: effectiveAuth,
          tlsConfig: effectiveTls,
        }
      )

      // Parse the result string into an object
      const result = JSON.parse(resultString)

      const duration = Date.now() - startTime
      const responseSize = new Blob([resultString]).size

      // Format the response for display
      const formattedResponse = JSON.stringify(result.response, null, 2)

      updateActiveTab({
        response: formattedResponse,
        responseMetadata: {}, // TODO: Extract metadata if needed
        status: { code: parseInt(result.grpc_status), message: result.grpc_message || 'OK' },
        duration,
        responseSize,
        isLoading: false,
      })

      // Add to history
      addToHistoryV2(workspace, {
        service: activeTab.service,
        method: activeTab.method,
        methodType: activeTab.methodType,
        endpoint: endpoint,
        requestBody: activeTab.requestBody,
        metadata: activeTab.metadata,
        status: { code: 0, message: 'OK' },
        duration,
        responseSize,
        timestamp: new Date().toISOString(),
        environmentId: activeTab.selectedEnvironmentId || null,
      })

      saveWorkspace(workspace)
      setWorkspace({ ...workspace })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      updateActiveTab({
        response: `Error: ${errorMessage}`,
        status: { code: 13, message: errorMessage },
        duration,
        isLoading: false,
      })
    }
  }, [activeTab, protoContent, workspace, setWorkspace, updateActiveTab, showToast])

  const handleSaveRequest = useCallback(() => {
    if (!activeTab) return

    const requestName = prompt('Enter a name for this request:', `${activeTab.service}.${activeTab.method}`)
    if (!requestName) return

    const savedRequest = createSavedRequest(
      requestName,
      activeTab.service,
      activeTab.method,
      activeTab
    )

    // Find or create "My Requests" collection
    let myRequestsCollection = workspace.collections.find((c) => c.name === 'My Requests')
    
    if (!myRequestsCollection) {
      myRequestsCollection = createCollection('My Requests')
      addCollection(workspace, myRequestsCollection)
    }

    // Add request to collection
    myRequestsCollection.requests.push(savedRequest)

    saveWorkspace(workspace)
    setWorkspace({ ...workspace })
    showToast(`Saved request: ${requestName}`, 'success')
  }, [activeTab, workspace, setWorkspace, showToast])

  const handleLoadRequest = useCallback((request: SavedRequest | HistoryEntry) => {
    const isHistory = 'timestamp' in request
    const tabId = `${request.service}.${request.method}-${Date.now()}`
    
    const newTab: RequestTab = {
      id: tabId,
      name: isHistory ? `[History] ${request.service}.${request.method}` : request.name,
      service: request.service,
      method: request.method,
      methodType: request.methodType,
      requestBody: request.requestBody,
      metadata: request.metadata,
      auth: isHistory ? { type: 'none' } : request.auth,
      response: '',
      responseMetadata: {},
      streamingMessages: [],
      status: isHistory ? request.status : null,
      duration: isHistory ? request.duration : null,
      responseSize: isHistory ? request.responseSize : null,
      isStreaming: false,
      isLoading: false,
      isDirty: false,
      createdAt: new Date().toISOString(),
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(tabId)
  }, [])

  const removeSavedRequestFromFolders = useCallback((folders: any[], requestId: string): any[] => {
    return folders
      .map((folder) => {
        if (folder.requests) {
          return {
            ...folder,
            requests: folder.requests.filter((r: any) => r.id !== requestId),
            folders: removeSavedRequestFromFolders(folder.folders || [], requestId),
          }
        }
        return folder
      })
      .filter(Boolean) as any[]
  }, [])

  const handleDeleteRequest = useCallback((requestId: string) => {
    workspace.collections = workspace.collections.map((collection) => ({
      ...collection,
      requests: collection.requests.filter(r => r.id !== requestId),
      folders: removeSavedRequestFromFolders(collection.folders, requestId),
    }))

    saveWorkspace(workspace)
    setWorkspace({ ...workspace })
    showToast('Request deleted', 'info')
  }, [workspace, setWorkspace, showToast, removeSavedRequestFromFolders])

  const handleMethodClick = useCallback((service: string, method: string) => {
    const existingTab = tabs.find((t) => t.service === service && t.method === method)
    if (existingTab) {
      setActiveTabId(existingTab.id)
    } else {
      createNewTab(service, method)
    }
  }, [tabs, createNewTab])

  const handleGenerateSample = useCallback(async () => {
    if (!activeTab) return

    setIsGenerating(true)
    try {
      const service = services.find(s => s.name === activeTab.service)
      const method = service?.methods.find(m => m.name === activeTab.method)
    
      if (!method) {
        throw new Error('Method not found')
      }

      // Use pre-computed sample from parsing (should always be available)
      if (method.sampleRequest) {
        updateActiveTab({ requestBody: method.sampleRequest, isDirty: true })
      } else {
        // If no pre-computed sample available, show error with helpful message
        updateActiveTab({ 
          response: 'No sample available. Try re-parsing proto files from Workspace Settings.' 
        })
      }
    } catch (error) {
      updateActiveTab({ response: `Error loading sample: ${error}` })
    } finally {
      setIsGenerating(false)
    }
  }, [activeTab, services, updateActiveTab])

  return {
    // State
    services,
    tabs,
    activeTabId,
    activeTab,
    isGenerating,
    protoContent,
    allSavedRequests,

    // Tab operations
    createNewTab,
    closeTab,
    setActiveTabId,
    updateActiveTab,
    syncFromEnvironment,

    // Proto operations
    handleFileUpload,
    setServices,
    setProtoContent,

    // Request operations
    handleGrpcCall,
    handleSaveRequest,
    handleLoadRequest,
    handleDeleteRequest,
    handleMethodClick,
    handleGenerateSample,

    // Sample generation state
    setIsGenerating,
  }
}
