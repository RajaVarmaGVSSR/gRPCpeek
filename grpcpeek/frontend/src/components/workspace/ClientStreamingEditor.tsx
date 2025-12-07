import { useState } from 'react'
import { Button, Label } from '../ui'
import { VariableHighlightedTextarea } from './VariableHighlightedTextarea'
import { VariableIndicator } from './VariableIndicator'
import type { ClientStreamMessage, VariableContext } from '../../types/workspace'

interface ClientStreamingEditorProps {
  messages: ClientStreamMessage[]
  onUpdate: (messages: ClientStreamMessage[]) => void
  onSendMessage: (messageId: string) => void
  onFinishStreaming: () => void
  streamConnectionOpen: boolean
  isLoading: boolean
  variableContext: VariableContext
  sampleRequest: string
}

export function ClientStreamingEditor({
  messages,
  onUpdate,
  onSendMessage,
  onFinishStreaming: _onFinishStreaming,
  streamConnectionOpen,
  isLoading,
  variableContext,
  sampleRequest,
}: ClientStreamingEditorProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    new Set(messages.map((_, i) => i))
  )

  const toggleMessage = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const addMessage = () => {
    const newMessage: ClientStreamMessage = {
      id: `msg-${Date.now()}`,
      body: sampleRequest || '{\n  \n}',
      sent: false,
    }
    const updatedMessages = [...messages, newMessage]
    onUpdate(updatedMessages)
    // Auto-expand the new message
    setExpandedIndices((prev) => new Set([...prev, messages.length]))
  }

  const updateMessageBody = (index: number, body: string) => {
    const updatedMessages = [...messages]
    updatedMessages[index] = { ...updatedMessages[index], body }
    onUpdate(updatedMessages)
  }

  const deleteMessage = (index: number) => {
    const updatedMessages = messages.filter((_, i) => i !== index)
    onUpdate(updatedMessages)
    // Adjust expanded indices
    setExpandedIndices((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
      })
      return next
    })
  }

  const formatJSON = (index: number) => {
    try {
      const parsed = JSON.parse(messages[index].body)
      updateMessageBody(index, JSON.stringify(parsed, null, 2))
    } catch {
      // Invalid JSON, do nothing
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>Client Stream Messages</Label>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {messages.length}
          </span>
          {streamConnectionOpen && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              ● Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={addMessage}
            disabled={isLoading}
            className="h-7 px-3 text-xs"
          >
            + Add Message
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Click "Add Message" to start streaming.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isExpanded = expandedIndices.has(index)
            return (
              <div
                key={message.id}
                className="overflow-hidden rounded-md border border-border/50 bg-surface"
              >
                {/* Message Header */}
                <button
                  onClick={() => toggleMessage(index)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Message {index + 1}
                    </span>
                    {message.sent && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✓ Sent
                      </span>
                    )}
                    <VariableIndicator text={message.body} context={variableContext} />
                  </div>
                  <div className="flex items-center gap-2">
                    {!message.sent && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSendMessage(message.id)
                          }}
                          disabled={isLoading}
                          className="h-6 px-3 text-xs"
                        >
                          Send →
                        </Button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteMessage(index)
                          }}
                          disabled={isLoading}
                          className="h-6 w-6 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 hover:text-red-700 dark:text-red-400 transition-colors disabled:opacity-50"
                        >
                          ×
                        </button>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </button>

                {/* Message Body */}
                {isExpanded && (
                  <div className="border-t border-border/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">Message Body (JSON)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatJSON(index)}
                        disabled={message.sent}
                        className="h-5 px-2 text-xs"
                      >
                        Format JSON
                      </Button>
                    </div>
                    {message.sent ? (
                      <pre className="rounded border border-border bg-surface-muted p-3 font-mono text-xs text-muted-foreground overflow-auto h-[300px]">
                        {message.body}
                      </pre>
                    ) : (
                      <VariableHighlightedTextarea
                        value={message.body}
                        onChange={(value) => updateMessageBody(index, value)}
                        context={variableContext}
                        placeholder='{"field": "value"}'
                        className="h-[300px]"
                      />
                    )}
                    {message.timestamp && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sent at: {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Helper Text */}
      {messages.length > 0 && !streamConnectionOpen && (
        <p className="flex-shrink-0 text-xs text-muted-foreground">
          💡 Use <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{env.varName}}'}</code> or <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{global.varName}}'}</code> for dynamic values. Click "Send Request" to start the stream.
        </p>
      )}
      {streamConnectionOpen && (
        <p className="flex-shrink-0 text-xs text-muted-foreground">
          ✓ Stream connected. Send messages individually using "Send →" buttons. Click "Finish Streaming" when done.
        </p>
      )}
    </div>
  )
}
