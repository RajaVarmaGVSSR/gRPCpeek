import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from './components/ui'
import { ServicesList } from './components/workspace/ServicesList'
import { SavedRequestsList } from './components/workspace/SavedRequestsList'
import { RequestHistory } from './components/workspace/RequestHistory'
import { EnvironmentSelector } from './components/workspace/EnvironmentSelector'
import { StreamingResponsePanel } from './components/workspace/StreamingResponsePanel'
import { ResponseMetadata } from './components/workspace/ResponseMetadata'
import { RequestTabs } from './components/workspace/RequestTabs'
import type { Service, Method, SavedRequest, RequestTab } from './types/workspace'
import {
  loadWorkspace,
  saveWorkspace,
  addToHistory,
  saveRequest as saveRequestToWorkspace,
  deleteRequest,
  setActiveEnvironment,
  getActiveEnvironment,
} from './lib/workspace'

// Check if running in Tauri context
function checkTauriAvailable(): boolean {
  try {
    // In Tauri v2, the window protocol is tauri://
    const isTauriProtocol = window.location.protocol === 'tauri:' || 
                           window.location.hostname === 'tauri.localhost'
    
    // Check multiple ways Tauri might be available
    const hasTauriGlobal = typeof window !== 'undefined' && 
                          typeof (window as any).__TAURI__ !== 'undefined' &&
                          (window as any).__TAURI__ !== null
    
    const hasTauriIpc = typeof window !== 'undefined' &&
                       typeof (window as any).__TAURI_IPC__ !== 'undefined'
    
    return isTauriProtocol || hasTauriGlobal || hasTauriIpc
  } catch {
    return false
  }
}

function App() {
  const [workspace, setWorkspace] = useState(() => loadWorkspace())
  const [services, setServices] = useState<Service[]>([])
  const [tabs, setTabs] = useState<RequestTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isTauriMode, setIsTauriMode] = useState<boolean>(false)
  const [protoContent, setProtoContent] = useState<string>('')
  const [sidebarView, setSidebarView] = useState<'services' | 'saved' | 'history'>('services')

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId]
  )

  const activeEnv = getActiveEnvironment(workspace)
  const endpoint = activeEnv ? `http://${activeEnv.host}:${activeEnv.port}` : 'http://localhost:50051'

  // Save workspace to localStorage whenever it changes
  useEffect(() => {
    saveWorkspace(workspace)
  }, [workspace])

  // Check Tauri availability on mount
  useEffect(() => {
    const checkMode = () => {
      setIsTauriMode(checkTauriAvailable())
    }
    
    // Check immediately
    checkMode()
    
    // Also check after delays in case Tauri loads asynchronously
    const timer1 = setTimeout(checkMode, 100)
    const timer2 = setTimeout(checkMode, 500)
    const timer3 = setTimeout(checkMode, 1000)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  // Tab management functions
  const createNewTab = (service: string, method: string) => {
    const serviceObj = services.find((s) => s.name === service)
    const methodObj = serviceObj?.methods.find((m) => m.name === method)
    
    if (!methodObj) return

    const tabId = `${service}.${method}-${Date.now()}`
    const newTab: RequestTab = {
      id: tabId,
      name: `${service}.${method}`,
      service,
      method,
      methodType: methodObj.methodType,
      requestData: '',
      response: '',
      streamingMessages: [],
      isStreaming: false,
      isLoading: false,
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(tabId)
  }

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveTabId(null)
      }
      return filtered
    })
  }

  const updateActiveTab = (updates: Partial<RequestTab>) => {
    if (!activeTabId) return
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, ...updates } : tab
      )
    )
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const content = await file.text()

      // If running inside Tauri, use the backend parser, otherwise use a lightweight
      // browser fallback parser so the dev server can load proto files without Tauri.
      if (isTauriMode) {
        try {
          const parsedServices = await invoke<Service[]>('parse_proto_file', { protoContent: content })
          setServices(parsedServices)
          setProtoContent(content) // Store proto content for gRPC calls
          setTabs([])
          setActiveTabId(null)
        } catch (error) {
          if (activeTab) {
            updateActiveTab({ response: `Error parsing proto file (tauri): ${error}` })
          }
        }
      } else {
        try {
          const parsedServices = parseProtoLocal(content)
          setServices(parsedServices)
          setProtoContent(content) // Store proto content for gRPC calls
          setTabs([])
          setActiveTabId(null)
        } catch (error) {
          if (activeTab) {
            updateActiveTab({ response: `Error parsing proto file: ${error}` })
          }
        }
      }
    }
  }

  // Lightweight proto parser used only in the browser for dev (NOT a full proto parser).
  // It extracts service names and rpc method signatures (method name, input, output).
  function parseProtoLocal(protoText: string): Service[] {
    const services: Service[] = []
    const serviceRegex = /service\s+(\w+)\s*{([\s\S]*?)}/g
    const rpcRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)/g

    let svcMatch: RegExpExecArray | null
    while ((svcMatch = serviceRegex.exec(protoText)) !== null) {
      const svcName = svcMatch[1]
      const svcBody = svcMatch[2]
      const methods: Method[] = []

      let rpcMatch: RegExpExecArray | null
      while ((rpcMatch = rpcRegex.exec(svcBody)) !== null) {
        const methodName = rpcMatch[1]
        const isClientStreaming = !!rpcMatch[2]
        const inputType = rpcMatch[3]
        const isServerStreaming = !!rpcMatch[4]
        const outputType = rpcMatch[5]
        
        const methodType = 
          !isClientStreaming && !isServerStreaming ? 'unary' :
          !isClientStreaming && isServerStreaming ? 'server_streaming' :
          isClientStreaming && !isServerStreaming ? 'client_streaming' :
          'bidirectional_streaming'
        
        methods.push({ 
          name: methodName, 
          inputType, 
          outputType,
          isClientStreaming,
          isServerStreaming,
          methodType
        })
      }

      services.push({ name: svcName, methods })
    }

    return services
  }

  const handleGrpcCall = async () => {
    if (!activeTab) return

    updateActiveTab({ isLoading: true, streamingMessages: [], isStreaming: false })
    
    try {
      if (isTauriMode) {
        const result = await invoke<string>('call_grpc_method', {
          service: activeTab.service,
          method: activeTab.method,
          requestData: activeTab.requestData,
          endpoint: endpoint,
          protoContent: protoContent
        })
        
        // Parse the result to check if it's streaming
        const parsedResult = JSON.parse(result)
        
        if (parsedResult.is_streaming && Array.isArray(parsedResult.response)) {
          // Server streaming: show messages in streaming panel
          const summary = {
            status: parsedResult.status,
            grpc_status: parsedResult.grpc_status,
            method: parsedResult.method,
            message_count: parsedResult.message_count,
            note: parsedResult.note,
            timestamp: parsedResult.timestamp
          }
          updateActiveTab({
            isStreaming: true,
            streamingMessages: parsedResult.response,
            response: JSON.stringify(summary, null, 2)
          })
        } else {
          // Unary: show single response
          updateActiveTab({
            isStreaming: false,
            response: result
          })
        }
      } else {
        // Browser mode: Show a helpful message
        const mockResponse = {
          note: 'Browser mode detected - gRPC calls require the desktop app',
          reason: 'gRPC uses HTTP/2 which requires native support',
          solution: 'Run with: cargo tauri dev (from grpcpeek folder)',
          mock_data: {
            service: activeTab.service,
            method: activeTab.method,
            endpoint: endpoint,
            request: activeTab.requestData,
            status: 'Not sent - run in Tauri desktop app for real gRPC calls'
          }
        }
        updateActiveTab({ response: JSON.stringify(mockResponse, null, 2) })
      }

      // Add to history
      const historyEntry = {
        name: `${activeTab.service}.${activeTab.method}`,
        service: activeTab.service,
        method: activeTab.method,
        payload: activeTab.requestData,
        metadata: {},
      }
      setWorkspace((prev) => addToHistory(prev, historyEntry))
    } catch (error) {
      updateActiveTab({ response: `Error: ${error}`, isStreaming: false })
    } finally {
      updateActiveTab({ isLoading: false })
    }
  }

  const handleSaveRequest = () => {
    if (!activeTab) return

    const request = {
      name: activeTab.name,
      service: activeTab.service,
      method: activeTab.method,
      payload: activeTab.requestData,
      metadata: {},
    }

    setWorkspace((prev) => saveRequestToWorkspace(prev, request))
  }

  const handleLoadRequest = (request: SavedRequest) => {
    // Create a new tab from saved request
    const serviceObj = services.find((s) => s.name === request.service)
    const methodObj = serviceObj?.methods.find((m) => m.name === request.method)
    
    if (!methodObj) return

    const tabId = `${request.service}.${request.method}-${Date.now()}`
    const newTab: RequestTab = {
      id: tabId,
      name: request.name,
      service: request.service,
      method: request.method,
      methodType: methodObj.methodType,
      requestData: request.payload,
      response: '',
      streamingMessages: [],
      isStreaming: false,
      isLoading: false,
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(tabId)
  }

  const handleDeleteRequest = (requestId: string) => {
    setWorkspace((prev) => deleteRequest(prev, requestId))
  }

  const handleMethodClick = (service: string, method: string) => {
    createNewTab(service, method)
    setSidebarView('services') // Stay on services view
  }

  const handleGenerateSample = async () => {
    if (!activeTab || !protoContent) return
    
    try {
      // Find the method's input type
      const serviceObj = services.find((s) => s.name === activeTab.service)
      const methodObj = serviceObj?.methods.find((m) => m.name === activeTab.method)
      
      if (!methodObj) return
      
      setIsGenerating(true)
      
      if (isTauriMode) {
        // Use Rust backend to generate accurate sample from proto schema
        const sampleJson = await invoke<string>('generate_sample_request', {
          messageType: methodObj.inputType,
          protoContent: protoContent,
        })
        updateActiveTab({ requestData: sampleJson })
      } else {
        // Browser mode: show helpful message
        updateActiveTab({ response: 'Sample generation requires the desktop app. Run with: cargo tauri dev' })
      }
    } catch (error) {
      console.error('Failed to generate sample:', error)
      updateActiveTab({ response: `Error generating sample: ${error}` })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEnvironmentChange = (envId: string) => {
    setWorkspace((prev) => setActiveEnvironment(prev, envId))
  }

  return (
    <div className="h-dvh min-h-[640px] bg-background">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-hidden px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">gRPCpeek</h1>
              <Badge variant={isTauriMode ? 'positive' : 'warning'}>
                {isTauriMode ? 'Desktop Mode' : 'Browser Preview'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Workspace: {workspace.name}
            </p>
          </div>
          <EnvironmentSelector
            environments={workspace.environments}
            activeEnvironmentId={workspace.activeEnvironmentId}
            onEnvironmentChange={handleEnvironmentChange}
          />
        </header>

        <main className="flex flex-1 flex-col gap-6 overflow-hidden">
          <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-[280px_1fr]">
            {/* Sidebar */}
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="flex gap-1 rounded-xl border border-border/70 bg-surface p-1">
                <button
                  onClick={() => setSidebarView('services')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sidebarView === 'services'
                      ? 'bg-surface-emphasis text-surface-contrast'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Services
                </button>
                <button
                  onClick={() => setSidebarView('saved')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sidebarView === 'saved'
                      ? 'bg-surface-emphasis text-surface-contrast'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Saved ({workspace.savedRequests.length})
                </button>
                <button
                  onClick={() => setSidebarView('history')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sidebarView === 'history'
                      ? 'bg-surface-emphasis text-surface-contrast'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  History
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {sidebarView === 'services' && (
                  <ServicesList services={services} onMethodClick={handleMethodClick} />
                )}
                {sidebarView === 'saved' && (
                  <SavedRequestsList
                    requests={workspace.savedRequests}
                    onRequestClick={handleLoadRequest}
                    onRequestDelete={handleDeleteRequest}
                  />
                )}
                {sidebarView === 'history' && (
                  <RequestHistory
                    history={workspace.requestHistory}
                    onRequestClick={handleLoadRequest}
                  />
                )}
              </div>
            </div>

            {/* Main content area: Tabs + Request/Response Grid */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              {/* Tabs Bar - Full Width */}
              <RequestTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabClick={setActiveTabId}
                onTabClose={closeTab}
              />

              {/* Request and Response Grid */}
              <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Left column: Request */}
              <Card className="flex min-h-0 min-w-0 flex-col gap-5 p-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Request</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure and send gRPC requests
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-4 overflow-auto pr-1">
                  <div className="space-y-2">
                    <Label htmlFor="proto">Proto file</Label>
                    <input
                      id="proto"
                      type="file"
                      accept=".proto"
                      onChange={handleFileUpload}
                      className="block w-full cursor-pointer rounded-xl border border-dashed border-border/70 bg-surface-muted px-4 py-3 text-sm text-muted-foreground transition hover:border-focus/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={endpoint}
                      readOnly
                      className="bg-surface-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure in environment settings
                    </p>
                  </div>

                  {tabs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-8 text-center">
                      <div className="mb-2 text-3xl opacity-40">👈</div>
                      <p className="text-sm text-muted-foreground">
                        Click a method in the service list to create a new request tab
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="service">Service</Label>
                        <Input
                          id="service"
                          value={activeTab?.service || ''}
                          readOnly
                          className="bg-surface-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="method">Method</Label>
                        <Input
                          id="method"
                          value={activeTab?.method || ''}
                          readOnly
                          className="bg-surface-muted"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="payload">Request data (JSON)</Label>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleGenerateSample}
                            disabled={isGenerating || !protoContent || !isTauriMode}
                            className="h-6 px-2 text-xs"
                          >
                            {isGenerating ? '...' : '✨ Generate Sample'}
                          </Button>
                        </div>
                        <Textarea
                          id="payload"
                          value={activeTab.requestData}
                          onChange={(event) => updateActiveTab({ requestData: event.target.value })}
                          placeholder='{"field": "value"}'
                          className="min-h-[120px] resize-y"
                        />
                      </div>
                    </>
                  )}
                </div>

                {activeTab && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGrpcCall}
                        disabled={activeTab.isLoading}
                        className="flex-1"
                      >
                        {activeTab.isLoading ? 'Calling...' : 'Send Request'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleSaveRequest}
                      >
                        💾
                      </Button>
                    </div>
                    {!isTauriMode && (
                      <p className="text-xs text-muted-foreground">
                        Run "cargo tauri dev" for real gRPC calls
                      </p>
                    )}
                  </div>
                )}
              </Card>

              {/* Right column: Response */}
              <Card className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
                <div className="mb-4 space-y-1">
                  <h2 className="text-lg font-semibold">Response</h2>
                  <p className="text-sm text-muted-foreground">
                    {activeTab?.isStreaming ? 'Stream results and metadata' : 'Response data and metadata'}
                  </p>
                </div>

                {activeTab?.response ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                    {activeTab.isStreaming && activeTab.streamingMessages.length > 0 ? (
                      <>
                        {(() => {
                          try {
                            const parsed = JSON.parse(activeTab.response)
                            return <ResponseMetadata metadata={parsed} />
                          } catch {
                            return null
                          }
                        })()}
                        <div className="flex-1 overflow-y-auto">
                          <StreamingResponsePanel 
                            messages={activeTab.streamingMessages}
                            onClear={() => {
                              updateActiveTab({
                                streamingMessages: [],
                                isStreaming: false
                              })
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {(() => {
                          try {
                            const parsed = JSON.parse(activeTab.response)
                            if (typeof parsed === 'object' && parsed !== null) {
                              // Extract response data (excluding metadata fields)
                              const metadataFields = ['status', 'grpc_status', 'grpc_message', 'method', 'service', 'endpoint', 'message_count', 'response_size', 'timestamp', 'note', 'is_streaming', 'request']
                              const responseData = Object.entries(parsed).reduce((acc, [key, value]) => {
                                if (!metadataFields.includes(key)) {
                                  acc[key] = value
                                }
                                return acc
                              }, {} as Record<string, any>)

                              return (
                                <>
                                  <ResponseMetadata metadata={parsed} />
                                  {Object.keys(responseData).length > 0 && (
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-surface">
                                      <div className="border-b border-border/40 bg-surface-muted/30 px-4 py-2">
                                        <h3 className="text-xs font-semibold text-muted-foreground">Response Body</h3>
                                      </div>
                                      <div className="flex-1 overflow-y-auto p-4">
                                        <pre className="font-mono text-xs text-foreground">
                                          {JSON.stringify(responseData, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )
                            }
                          } catch {
                            // Not JSON, show as-is
                          }
                          return (
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-surface">
                              <div className="border-b border-border/40 bg-surface-muted/30 px-4 py-2">
                                <h3 className="text-xs font-semibold text-muted-foreground">Response Body</h3>
                              </div>
                              <div className="flex-1 overflow-y-auto p-4">
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                                  {activeTab.response}
                                </pre>
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>
                ) : activeTab ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/20">
                    <div className="text-center">
                      <div className="mb-2 text-2xl opacity-40">📭</div>
                      <p className="text-sm text-muted-foreground">
                        Response will appear here once a call completes
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/20">
                    <div className="text-center">
                      <div className="mb-2 text-3xl opacity-40">👈</div>
                      <p className="text-sm text-muted-foreground">
                        Select a method from the service list to begin
                      </p>
                    </div>
                  </div>
                )}
              </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
