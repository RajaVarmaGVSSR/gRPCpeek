import { useState, useEffect } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { Card, Button } from '../ui'
import { ResponseMetadata } from './ResponseMetadata'
import { StreamingResponsePanel } from './StreamingResponsePanel'
import { useToast } from '../../contexts/ToastContext'
import type { RequestTab } from '../../types/workspace'

interface ResponseViewerProps {
  tab: RequestTab | null
  onClearStreaming?: () => void
}

export function ResponseViewer({ tab, onClearStreaming }: ResponseViewerProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [activeTab, setActiveTab] = useState<'body' | 'metadata'>('body')
  const { showToast } = useToast()

  // Auto-switch to body tab when response arrives
  useEffect(() => {
    if (tab?.response || (tab?.streamingMessages && tab.streamingMessages.length > 0)) {
      setActiveTab('body')
    }
  }, [tab?.response, tab?.streamingMessages?.length])

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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tab.response)
      showToast('Response copied to clipboard', 'success')
    } catch (error) {
      console.error('Failed to copy:', error)
      showToast('Failed to copy response', 'error')
    }
  }

  const downloadResponse = async () => {
    try {
      // Determine the content to save
      let content: string
      if (tab.streamingMessages.length > 0) {
        // For streaming responses, save in grpcurl format
        content = tab.streamingMessages
          .map(m => JSON.stringify(m.data, null, 2))
          .join('\n')
      } else {
        // For unary responses, save the raw response
        content = tab.response
      }

      // Open native save dialog
      const filePath = await save({
        defaultPath: `${tab.service}-${tab.method}-${Date.now()}.json`,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      })

      if (filePath) {
        // Write the file using Tauri's invoke command
        await invoke('plugin:fs|write_text_file', { 
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

  // Parse response
  // Note: The frontend stores result.response directly (not the full result object)
  // - For streaming: result.response is an array of messages
  // - For unary: result.response is a single response object
  let parsedResponse: any = null
  let parseError: string | null = null

  // Only parse if there's actually a response (not empty string)
  if (tab.response && tab.response.trim()) {
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
            title="Copy to clipboard"
          >
            📋 Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadResponse}
            title="Download as JSON"
          >
            💾 Download
          </Button>
          {activeTab === 'body' && (
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
                  <div className="flex-1 overflow-y-auto">
                    <StreamingResponsePanel
                      messages={tab.streamingMessages.map(m => m.data)}
                      onClear={onClearStreaming || (() => {})}
                    />
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
          <div className="flex-1 overflow-y-auto">
            <ResponseMetadata 
              metadata={{
                grpc_status: tab.status?.code?.toString() || '0',
                grpc_message: tab.status?.message || 'OK',
                request_started: new Date(tab.createdAt).toLocaleString(),
                request_completed: tab.duration ? new Date(new Date(tab.createdAt).getTime() + tab.duration).toLocaleString() : 'N/A',
                duration_ms: tab.duration?.toString() || 'N/A',
                response_count: (tab.streamingMessages.length > 0 ? tab.streamingMessages.length : (tab.response ? 1 : 0)).toString(),
                response_size_bytes: tab.responseSize?.toString() || 'N/A',
              }} 
            />
          </div>
        )}


      </div>
    </Card>
  )
}
