import { useState, useEffect } from 'react'
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
  const [activeTab, setActiveTab] = useState<'body' | 'metadata' | 'stream'>('body')
  const { showToast } = useToast()

  // Auto-switch to stream tab when streaming starts
  useEffect(() => {
    if (tab?.isStreaming && tab.streamingMessages.length > 0) {
      setActiveTab('stream')
    } else if (tab?.response) {
      // Default to body tab for normal responses
      setActiveTab('body')
    }
  }, [tab?.isStreaming, tab?.streamingMessages.length, tab?.response])

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

  if (!tab.response) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <div className="space-y-2 text-center">
          <div className="text-3xl opacity-40">⏸️</div>
          <p className="text-sm text-muted-foreground">
            No response yet. Click "Send Request" to execute.
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

  const downloadResponse = () => {
    try {
      const blob = new Blob([tab.response], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tab.service}-${tab.method}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Response downloaded successfully', 'success')
    } catch (error) {
      console.error('Failed to download:', error)
      showToast('Failed to download response', 'error')
    }
  }

  // Parse response
  let parsedResponse: any = null
  let responseData: any = null
  let parseError: string | null = null

  try {
    parsedResponse = JSON.parse(tab.response)
    
    // Extract response data (excluding metadata fields)
    const metadataFields = [
      'status',
      'grpc_status',
      'grpc_message',
      'method',
      'service',
      'endpoint',
      'message_count',
      'response_size',
      'timestamp',
      'note',
      'is_streaming',
      'request',
    ]
    
    responseData = Object.entries(parsedResponse).reduce((acc, [key, value]) => {
      if (!metadataFields.includes(key)) {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, any>)
  } catch (error) {
    parseError = error instanceof Error ? error.message : 'Failed to parse response'
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
          {!tab.isStreaming && activeTab === 'body' && (
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
        {tab.isStreaming && (
          <button
            onClick={() => setActiveTab('stream')}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'stream'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stream ({tab.streamingMessages.length})
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {/* Body Tab */}
        {activeTab === 'body' && (
          <>
            {parseError ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-red-500/30 bg-red-500/5">
                <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2">
                  <h3 className="text-xs font-semibold text-red-600 dark:text-red-400">
                    Parse Error
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
                  <pre className="mt-4 font-mono text-xs text-muted-foreground">
                    {tab.response}
                  </pre>
                </div>
              </div>
            ) : responseData && Object.keys(responseData).length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-surface">
                <div className="border-b border-border/40 bg-surface-muted/30 px-4 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Response Body
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <pre className="font-mono text-xs text-foreground">
                    {showRaw
                      ? JSON.stringify(responseData)
                      : JSON.stringify(responseData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Response contains only metadata, no body data.
                </p>
              </div>
            )}
          </>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="flex-1 overflow-y-auto">
            {parsedResponse ? (
              <ResponseMetadata metadata={parsedResponse} />
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No metadata available.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stream Tab */}
        {activeTab === 'stream' && tab.isStreaming && (
          <div className="flex-1 overflow-y-auto">
            {tab.streamingMessages.length > 0 ? (
              <StreamingResponsePanel
                messages={tab.streamingMessages}
                onClear={onClearStreaming || (() => {})}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No streaming messages yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
