import { useState, useMemo, useCallback, useEffect, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Service, SavedRequest, RequestTab, HistoryEntry, Workspace, VariableContext, StreamMessage } from '../types/workspace'
import {
  saveWorkspace,
  addToHistory as addToHistoryV2,
  createSavedRequest,
  createCollection,
  addCollection,
  saveServicesToWorkspace,
  saveTabsToWorkspace,
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

  // Client streaming operations
  handleSendStreamMessage: (messageId: string) => Promise<void>
  handleFinishStreaming: () => Promise<void>

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

  // Initialize state from workspace on mount and when workspace changes
  useEffect(() => {
    console.log('useRequestManager - Initializing from workspace:', workspace.id)
    setServices(workspace.services || [])
    setTabs(workspace.openTabs || [])
    setActiveTabId(workspace.activeTabId !== undefined ? workspace.activeTabId : null)
    setProtoContent('')
    setIsGenerating(false)
  }, [workspace.id])

  // Persist services to workspace whenever they change
  useEffect(() => {
    if (services.length > 0 || workspace.services?.length) {
      console.log('useRequestManager - Persisting services to workspace:', services.length)
      const updatedWorkspace = saveServicesToWorkspace(workspace, services)
      saveWorkspace(updatedWorkspace)
      setWorkspace(updatedWorkspace)
    }
  }, [services])

  // Persist tabs and activeTabId to workspace whenever they change
  useEffect(() => {
    if (tabs.length > 0 || workspace.openTabs?.length || activeTabId !== workspace.activeTabId) {
      console.log('useRequestManager - Persisting tabs to workspace:', tabs.length, 'activeTabId:', activeTabId)
      const updatedWorkspace = saveTabsToWorkspace(workspace, tabs, activeTabId)
      saveWorkspace(updatedWorkspace)
      setWorkspace(updatedWorkspace)
    }
  }, [tabs, activeTabId])

  // Listen for streaming messages from backend
  useEffect(() => {
    console.log('[STREAMING] Setting up event listener for grpc-stream-message')
    let unlistenFn: (() => void) | null = null
    let isMounted = true
    
    listen<{ tabId: string; index: number; data: any; timestamp: string }>(
      'grpc-stream-message',
      (event) => {
        if (!isMounted) return // Ignore events if component unmounted
        
        const { tabId, index, data, timestamp } = event.payload
        console.log(`[STREAMING] Received message ${index} for tab ${tabId}`, data)
        
        // Use flushSync to force immediate DOM update for real-time streaming
        flushSync(() => {
          setTabs((prevTabs) =>
            prevTabs.map((tab) => {
              if (tab.id === tabId) {
                const newMessage: StreamMessage = {
                  id: `${tabId}-${index}`,
                  timestamp,
                  data,
                  index,
                }
                console.log(`[STREAMING] Adding message to tab, total messages: ${tab.streamingMessages.length + 1}`)
                return {
                  ...tab,
                  streamingMessages: [...tab.streamingMessages, newMessage],
                }
              }
              return tab
            })
          )
        })
      }
    ).then((unlisten) => {
      if (isMounted) {
        unlistenFn = unlisten
        console.log('[STREAMING] Event listener registered successfully')
      } else {
        // Component unmounted before listener was registered, clean it up immediately
        unlisten()
        console.log('[STREAMING] Event listener registered but immediately cleaned up (component unmounted)')
      }
    }).catch((error) => {
      console.error('[STREAMING] Failed to register event listener:', error)
    })

    return () => {
      isMounted = false
      if (unlistenFn) {
        unlistenFn()
        console.log('[STREAMING] Event listener cleaned up')
      }
    }
  }, [])

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
      // Link to environment but don't copy its settings (inherit at runtime)
      selectedEnvironmentId: defaultEnv?.id,
      metadata: {},  // Start empty - environment metadata is inherited at runtime
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

    // Check if this is a streaming method
    const serviceObj = services.find((s) => s.name === activeTab.service)
    const methodObj = serviceObj?.methods.find((m) => m.name === activeTab.method)
    const isStreamingMethod = methodObj?.methodType === 'server_streaming' || methodObj?.methodType === 'bidirectional_streaming'
    const isClientStreamingMethod = methodObj?.methodType === 'client_streaming' || methodObj?.methodType === 'bidirectional_streaming'

    // For client streaming, initialize the stream
    if (isClientStreamingMethod) {
      const messages = activeTab.clientStreamingMessages || []
      if (messages.length === 0) {
        showToast('Please add at least one message before starting the stream', 'error')
        return
      }
      
      try {
        // Get environment and endpoint
        const selectedEnv = workspace.environments.find(env => env.id === activeTab.selectedEnvironmentId)
        const host = activeTab.requestHost || selectedEnv?.host || 'localhost'
        const port = activeTab.requestPort || selectedEnv?.port || 50051
        const endpoint = `http://${host}:${port}`
        
        // Merge metadata
        const mergedMetadata = {
          ...(selectedEnv?.metadata || {}),
          ...(activeTab.metadata || {}),
        }
        
        // Get effective auth and TLS
        const effectiveAuth = activeTab.auth.type !== 'none' ? activeTab.auth : (selectedEnv?.auth || { type: 'none' })
        const effectiveTls = activeTab.tls || selectedEnv?.tls || { enabled: false }
        
        // Prepare import paths if proto content is not available
        const importPaths = protoContent ? undefined : workspace.importPaths.filter(ip => ip.enabled)
        
        // Initialize the stream
        await invoke('start_client_stream', {
          tabId: activeTab.id,
          service: activeTab.service,
          method: activeTab.method,
          endpoint,
          protoContent: protoContent || undefined,
          importPaths,
          metadata: mergedMetadata,
          auth: effectiveAuth,
          tlsConfig: effectiveTls,
        })
        
        updateActiveTab({
          streamConnectionOpen: true,
          isLoading: false,
        })
        showToast('Stream started. Send messages individually, then click "Finish Streaming"', 'success')
      } catch (error) {
        showToast(`Failed to start stream: ${error}`, 'error')
      }
      return
    }

    updateActiveTab({ 
      isLoading: true, 
      response: '', 
      status: null,
      isStreaming: isStreamingMethod,
      streamingMessages: [] // Clear previous streaming messages
    })

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
      
      // Validate that resolved body is valid JSON
      try {
        JSON.parse(bodyResult.resolved)
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown error'
        showToast(`Invalid JSON after variable resolution: ${message}`, 'error')
        setTabs(prev =>
          prev.map(t =>
            t.id === activeTab.id
              ? {
                  ...t,
                  isLoading: false,
                  response: JSON.stringify({ error: `Invalid JSON: ${message}`, resolvedBody: bodyResult.resolved }, null, 2),
                  responseError: `Failed to parse resolved request body as JSON: ${message}`
                }
              : t
          )
        )
        return
      }
      
      // Merge environment metadata with request metadata (request takes precedence)
      // Skip environment metadata if disabled for this request
      const mergedMetadata = {
        ...(activeTab.disableEnvironmentMetadata ? {} : (selectedEnv?.metadata || {})),
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
          tabId: activeTab.id,
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

      // Check if this is an error response
      if (result.status === 'error') {
        // Structured error response from backend
        updateActiveTab({
          response: result.error || result.grpc_message || 'Unknown error',
          responseMetadata: { 
            error_category: result.error_category,
            troubleshooting_hints: result.troubleshooting_hints || []
          },
          status: { 
            code: result.grpc_status === 'UNAVAILABLE' ? 14 : 13, 
            message: result.error || result.grpc_message 
          },
          duration,
          responseSize,
          isLoading: false,
          isStreaming: false,
        })
        return
      }

      // For streaming, the messages are already in streamingMessages array via events
      // For unary, format the response for display
      const formattedResponse = JSON.stringify(result.response, null, 2)

      updateActiveTab({
        response: formattedResponse,
        responseMetadata: {}, // TODO: Extract metadata if needed
        status: { code: parseInt(result.grpc_status), message: result.grpc_message || 'OK' },
        duration,
        responseSize,
        isLoading: false,
        isStreaming: false, // Call is complete
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
      const responseSize = new Blob([errorMessage]).size

      // Try to parse error as JSON (backend returns structured errors)
      try {
        const errorJson = JSON.parse(errorMessage)
        if (errorJson.status === 'error') {
          // Structured error response
          updateActiveTab({
            response: errorJson.error || errorJson.grpc_message || 'Unknown error',
            responseMetadata: { 
              error_category: errorJson.error_category,
              troubleshooting_hints: errorJson.troubleshooting_hints || []
            },
            status: { 
              code: errorJson.grpc_status === 'UNAVAILABLE' ? 14 : 13, 
              message: errorJson.error || errorJson.grpc_message 
            },
            duration,
            responseSize,
            isLoading: false,
          })
          return
        }
      } catch {
        // Not JSON, treat as plain error
      }

      // Plain error message
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

  const handleSendStreamMessage = useCallback(async (messageId: string) => {
    if (!activeTab) return

    console.log('Sending stream message:', messageId)
    
    // Find the message
    const messages = activeTab.clientStreamingMessages || []
    const message = messages.find(m => m.id === messageId)
    
    if (!message || message.sent) {
      console.warn('Message not found or already sent:', messageId)
      return
    }

    try {
      // Call backend to send the message
      await invoke('send_stream_message', { 
        tabId: activeTab.id,
        messageId,
        body: message.body 
      })
      
      // Mark message as sent with timestamp
      const updatedMessages = messages.map(m =>
        m.id === messageId
          ? { ...m, sent: true, timestamp: new Date().toISOString() }
          : m
      )
      
      updateActiveTab({
        clientStreamingMessages: updatedMessages,
        streamConnectionOpen: true,
      })
      
      showToast('Message sent', 'success')
    } catch (error) {
      console.error('Error sending stream message:', error)
      showToast(`Error sending message: ${error}`, 'error')
    }
  }, [activeTab, updateActiveTab, showToast])

  const handleFinishStreaming = useCallback(async () => {
    if (!activeTab) return

    console.log('Finishing stream for tab:', activeTab.id)

    try {
      updateActiveTab({ isLoading: true })
      
      // Check if any messages were sent
      const messages = activeTab.clientStreamingMessages || []
      const sentMessages = messages.filter(m => m.sent)
      
      if (sentMessages.length === 0) {
        showToast('No messages sent yet. Send at least one message first.', 'error')
        updateActiveTab({ isLoading: false })
        return
      }
      
      // Call backend to finish stream and get response
      // (messages were already sent via send_stream_message)
      const resultString = await invoke<string>('finish_streaming', { 
        tabId: activeTab.id
      })
      
      const result = JSON.parse(resultString)
      const formattedResponse = JSON.stringify(result.response, null, 2)
      
      updateActiveTab({
        streamConnectionOpen: false,
        isLoading: false,
        response: formattedResponse,
        status: { code: parseInt(result.grpc_status), message: result.grpc_message || 'OK' },
      })
      
      showToast('Stream closed, response received', 'success')
    } catch (error) {
      console.error('Error finishing stream:', error)
      updateActiveTab({ isLoading: false })
      showToast(`Error closing stream: ${error}`, 'error')
    }
  }, [activeTab, updateActiveTab, showToast])

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

    // Client streaming operations
    handleSendStreamMessage,
    handleFinishStreaming,

    // Sample generation state
    setIsGenerating,
  }
}
