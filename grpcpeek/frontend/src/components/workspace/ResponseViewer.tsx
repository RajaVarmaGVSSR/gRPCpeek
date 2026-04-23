import { useState, useEffect } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { Card, Button } from '../ui'
import { ResponseMetadata } from './ResponseMetadata'
import { StreamingResponsePanel } from './StreamingResponsePanel'
import { useToast } from '../../contexts/ToastContext'
import type { RequestTab } from '../../types/workspace'

const LARGE_RESPONSE_THRESHOLD = 500000
const LARGE_RESPONSE_PREVIEW_LIMIT = 12000

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

interface ResponseViewerProps {
  tab: RequestTab | null
  onClearStreaming?: () => void
}

export function ResponseViewer({ tab, onClearStreaming }: ResponseViewerProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [activeTab, setActiveTab] = useState<'body' | 'metadata'>('body')
  const [allowLargeResponseRender, setAllowLargeResponseRender] = useState(false)
  const [confirmUnsafeRender, setConfirmUnsafeRender] = useState(false)
  const { showToast } = useToast()

  // Auto-switch to body tab when response arrives
  useEffect(() => {
    if (tab?.response || (tab?.streamingMessages && tab.streamingMessages.length > 0)) {
      setActiveTab('body')
    }
  }, [tab?.response, tab?.streamingMessages?.length])

  useEffect(() => {
    setAllowLargeResponseRender(false)
    setConfirmUnsafeRender(false)
  }, [tab?.id, tab?.response])

  if (!tab) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <div className="space-y-2 text-center">
          <div className="text-3xl opacity-40">📭</div>
          <p className="text-sm text-muted-foreground">
            No active request. Select a method to get started.
          </p>
        </div>
      </Card>
    )
  }

  // Show "no response" only if there's no response AND no streaming messages
  if (!tab.response && tab.streamingMessages.length === 0) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <div className="space-y-2 text-center">
          <div className="text-3xl opacity-40">⏸️</div>
          <p className="text-sm text-muted-foreground">
            {tab.isStreaming ? 'Waiting for streaming response...' : 'No response yet. Click "Send Request" to execute.'}
          </p>
        </div>
      </Card>
    )
  }

  const copyText = async (content: string, successMessage: string, errorMessage: string) => {
    try {
      await navigator.clipboard.writeText(content)
      showToast(successMessage, 'success')
    } catch (error) {
      console.error('Failed to copy:', error)
      showToast(errorMessage, 'error')
    }
  }

  const responseContent = tab.streamingMessages.length > 0
    ? tab.streamingMessages.map(m => JSON.stringify(m.data, null, 2)).join('\n')
    : tab.response
  const responseSize = tab.responseSize || new Blob([responseContent]).size
  const isLargeResponse = Boolean(tab.response && tab.response.length > LARGE_RESPONSE_THRESHOLD)
  const shouldBlockLargeRender = isLargeResponse && !allowLargeResponseRender
  const responsePreview = isLargeResponse
    ? `${tab.response.slice(0, LARGE_RESPONSE_PREVIEW_LIMIT)}${tab.response.length > LARGE_RESPONSE_PREVIEW_LIMIT ? '\n\n… Preview truncated. Download the full response for the complete payload.' : ''}`
    : tab.response
  const metadataPayload = {
    grpc_status: tab.status?.code?.toString() || '0',
    grpc_message: tab.status?.message || 'OK',
    request_started: new Date(tab.createdAt).toLocaleString(),
    request_completed: tab.duration ? new Date(new Date(tab.createdAt).getTime() + tab.duration).toLocaleString() : 'N/A',
    duration_ms: tab.duration?.toString() || 'N/A',
    response_count: (tab.streamingMessages.length > 0 ? tab.streamingMessages.length : (tab.response ? 1 : 0)).toString(),
    response_size_bytes: responseSize.toString(),
    ...tab.responseMetadata,
  }

  const copyToClipboard = async () => {
    const contentToCopy = shouldBlockLargeRender ? responsePreview : responseContent
    const successMessage = shouldBlockLargeRender ? 'Response preview copied to clipboard' : 'Response copied to clipboard'
    const errorMessage = shouldBlockLargeRender ? 'Failed to copy response preview' : 'Failed to copy response'
    await copyText(contentToCopy, successMessage, errorMessage)
  }

  const copyMetadata = async () => {
    await copyText(JSON.stringify(metadataPayload, null, 2), 'Metadata copied to clipboard', 'Failed to copy metadata')
  }

  const downloadResponse = async () => {
    try {
      // Determine the content to save
      const content = responseContent

      // Open native save dialog
      const filePath = await save({
        defaultPath: `${tab.service}-${tab.method}-${Date.now()}.json`,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      })

      if (filePath) {
        await invoke('save_response_to_file', {
          path: filePath, 
          contents: content 
        })
        showToast('Response saved successfully', 'success')
      }
    } catch (error) {
      console.error('Failed to save response:', error)
      showToast('Failed to save response', 'error')
    }
  }

  const openResponseExternally = async () => {
    try {
      const tempPath = await invoke<string>('open_response_in_temp_file', {
        fileName: `${tab.service}-${tab.method}-${Date.now()}.json`,
        contents: responseContent,
      })
      showToast(`Opened response externally (${tempPath.split('/').pop()})`, 'success')
    } catch (error) {
      console.error('Failed to open response externally:', error)
      showToast('Failed to open response externally', 'error')
    }
  }

  const enableUnsafeRender = () => {
    if (!confirmUnsafeRender) {
      setConfirmUnsafeRender(true)
      return
    }

    setAllowLargeResponseRender(true)
    setConfirmUnsafeRender(false)
    showToast('Rendering the full response in-app. This may use significant memory.', 'info')
  }

  // Parse response
  // Note: The frontend stores result.response directly (not the full result object)
  // - For streaming: result.response is an array of messages
  // - For unary: result.response is a single response object
  let parsedResponse: any = null
  let parseError: string | null = null

  // Only parse if there's actually a response (not empty string) and it's not too large
  if (tab.response && tab.response.trim() && (!isLargeResponse || allowLargeResponseRender)) {
    try {
      parsedResponse = JSON.parse(tab.response)
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'Failed to parse response'
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Response</h2>
          <p className="text-sm text-muted-foreground">
            {tab.isStreaming ? 'Stream results and metadata' : 'Response data and metadata'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            title={shouldBlockLargeRender ? 'Copy safe preview to clipboard' : 'Copy to clipboard'}
          >
            {shouldBlockLargeRender ? '📋 Preview' : '📋 Copy'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadResponse}
            title="Download as JSON"
          >
            💾 Download
          </Button>
          {activeTab === 'body' && !shouldBlockLargeRender && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
              title={showRaw ? 'Show formatted' : 'Show raw JSON'}
            >
              {showRaw ? '📄 Formatted' : '🔧 Raw'}
            </Button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1">
        <button
          onClick={() => setActiveTab('body')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'body'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('metadata')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'metadata'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Metadata
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {/* Body Tab */}
        {activeTab === 'body' && (
          <>
            {(() => {
              // Priority 1: Check if tab has streaming messages (real-time streaming from events)
              if (tab.streamingMessages.length > 0) {
                // Show raw JSON if showRaw is true
                if (showRaw) {
                  const rawOutput = tab.streamingMessages
                    .map(m => JSON.stringify(m.data, null, 2))
                    .join('\n')
                  return (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
                      <div className="border-b border-border bg-surface-muted px-4 py-2">
                        <h3 className="text-xs font-semibold text-foreground">
                          Raw Response (grpcurl format)
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <pre className="font-mono text-xs text-foreground whitespace-pre">
                          {rawOutput}
                        </pre>
                      </div>
                    </div>
                  )
                }
                
                // Show formatted accordion view
                return (
                  <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                    <StreamingResponsePanel
                      messages={tab.streamingMessages.map(m => m.data)}
                      onClear={onClearStreaming || (() => {})}
                    />
                  </div>
                )
              }
              
              // Priority 1.5: Protect against massive responses rendering and causing WebKit OOM
              if (shouldBlockLargeRender) {
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-surface">
                    <div className="border-b border-border/40 bg-surface-muted/30 px-5 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-muted text-2xl">
                              📦
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">Large response protected</h3>
                              <p className="text-sm text-muted-foreground">
                                The full body is available, but rendering it inside the app is blocked by default to protect the webview.
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/50 bg-surface px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payload size</div>
                              <div className="mt-1 text-sm font-semibold text-foreground">{formatBytes(responseSize)}</div>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-surface px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">UI threshold</div>
                              <div className="mt-1 text-sm font-semibold text-foreground">{formatBytes(LARGE_RESPONSE_THRESHOLD)}</div>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-surface px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Available now</div>
                              <div className="mt-1 text-sm font-semibold text-foreground">Preview + download</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                          <Button variant="secondary" size="sm" onClick={downloadResponse}>
                            💾 Download Full Response
                          </Button>
                          <Button variant="secondary" size="sm" onClick={openResponseExternally}>
                            ↗ Open Externally
                          </Button>
                          <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                            📋 Copy Preview
                          </Button>
                          <Button variant="ghost" size="sm" onClick={copyMetadata}>
                            🧾 Copy Metadata
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                        <div className="font-medium">Why this is blocked</div>
                        <div className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                          Large JSON payloads can freeze or crash the embedded webview. Use the preview below to verify the response, then download or open the full payload outside the app if you need full inspection.
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/50 bg-surface-muted/20">
                        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Safe preview</h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Showing the first {formatBytes(new Blob([responsePreview]).size)} of the response body.
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                            Copy Preview
                          </Button>
                        </div>
                        <div className="max-h-[26rem] overflow-y-auto p-4">
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                            {responsePreview}
                          </pre>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">Advanced option</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Rendering the full payload in-app may consume significant memory and can still lock up the window on some machines.
                            </p>
                            {confirmUnsafeRender && (
                              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                                Click again to confirm you want to render the complete response inside the app.
                              </p>
                            )}
                          </div>
                          <Button variant={confirmUnsafeRender ? 'danger' : 'secondary'} size="sm" onClick={enableUnsafeRender}>
                            {confirmUnsafeRender ? 'Render Full Response Anyway' : 'Try Rendering Anyway'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              
              // Priority 2: Error handling (plain text errors or parse errors)
              if (parseError || (tab.response && (tab.status?.code || 0) > 0)) {
                // Check if we have error metadata (structured error response)
                const errorCategory = tab.responseMetadata?.error_category
                const troubleshootingHints = Array.isArray(tab.responseMetadata?.troubleshooting_hints) 
                  ? tab.responseMetadata.troubleshooting_hints as string[]
                  : undefined
                
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-red-500/30 bg-red-500/5">
                    <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
                          {errorCategory || 'Error'}
                        </h3>
                      </div>
                      {tab.status && (
                        <div className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
                          gRPC Status: {tab.status.code}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Raw error message - most important */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-2">
                          Error Details
                        </h4>
                        <div className="rounded border border-red-500/20 bg-red-950/5 dark:bg-red-500/5 p-3">
                          <pre className="font-mono text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap break-words">
                            {tab.response}
                          </pre>
                        </div>
                      </div>
                      
                      {/* Troubleshooting hints - optional, helpful suggestions */}
                      {troubleshootingHints && troubleshootingHints.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            💡 Possible Causes
                          </h4>
                          <ul className="space-y-2">
                            {troubleshootingHints.map((hint, index) => (
                              <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                                <span className="text-yellow-600 dark:text-yellow-500">•</span>
                                <span>{hint}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              // Priority 3: Legacy streaming format (parsedResponse is an array)
              if (Array.isArray(parsedResponse)) {
                return (
                  <div className="flex-1 overflow-y-auto">
                    <StreamingResponsePanel
                      messages={parsedResponse}
                      onClear={onClearStreaming || (() => {})}
                    />
                  </div>
                )
              }
              
              // Unary response: parsedResponse is an object
              if (parsedResponse && typeof parsedResponse === 'object' && Object.keys(parsedResponse).length > 0) {
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-surface">
                    <div className="border-b border-border/40 bg-surface-muted/30 px-4 py-2">
                      <h3 className="text-xs font-semibold text-muted-foreground">
                        Response Body
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <pre className="font-mono text-xs text-foreground">
                        {showRaw
                          ? JSON.stringify(parsedResponse)
                          : JSON.stringify(parsedResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                )
              }
              
              // Empty response
              return (
                <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Response contains only metadata, no body data.
                  </p>
                </div>
              )
            })()}
          </>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={copyMetadata}>
                🧾 Copy Metadata
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ResponseMetadata metadata={metadataPayload} />
            </div>
          </div>
        )}


      </div>
    </Card>
  )
}
