import { useState, useRef, useEffect, type ChangeEvent, type MouseEvent } from 'react'
import type { VariableContext } from '../../types/workspace'
import { resolveVariables } from '../../lib/variableResolver'

interface VariableHighlightedTextareaProps {
  value: string
  onChange: (value: string) => void
  context: VariableContext
  placeholder?: string
  className?: string
  id?: string
}

interface VariableSpan {
  text: string
  isVariable: boolean
  isResolved: boolean
  resolvedValue?: string
  startIndex: number
  endIndex: number
}

/**
 * Textarea with variable highlighting
 * Shows resolved variables with green background, unresolved with red background
 */
export function VariableHighlightedTextarea({
  value,
  onChange,
  context,
  placeholder,
  className = '',
  id,
}: VariableHighlightedTextareaProps) {
  const [spans, setSpans] = useState<VariableSpan[]>([])
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    variable: VariableSpan | null
  }>({ visible: false, x: 0, y: 0, variable: null })
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  // Parse text and identify variables
  useEffect(() => {
    const variablePattern = /\{\{(env|global)\.([a-zA-Z0-9_]+)\}\}/g
    const newSpans: VariableSpan[] = []
    let lastIndex = 0
    let match

    while ((match = variablePattern.exec(value)) !== null) {
      // Add text before variable
      if (match.index > lastIndex) {
        newSpans.push({
          text: value.substring(lastIndex, match.index),
          isVariable: false,
          isResolved: false,
          startIndex: lastIndex,
          endIndex: match.index,
        })
      }

      // Check if variable is resolved
      const placeholder = match[0]
      const result = resolveVariables(placeholder, context)
      const isResolved = result.unresolvedVars.length === 0

      newSpans.push({
        text: placeholder,
        isVariable: true,
        isResolved,
        resolvedValue: isResolved ? result.resolved : undefined,
        startIndex: match.index,
        endIndex: match.index + placeholder.length,
      })

      lastIndex = match.index + placeholder.length
    }

    // Add remaining text
    if (lastIndex < value.length) {
      newSpans.push({
        text: value.substring(lastIndex),
        isVariable: false,
        isResolved: false,
        startIndex: lastIndex,
        endIndex: value.length,
      })
    }

    setSpans(newSpans)
  }, [value, context])

  // Sync scroll between textarea and highlight layer
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  // Show tooltip on click for variables
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const cursorPos = textarea.selectionStart

    // Find which span was clicked
    const clickedSpan = spans.find(
      span => span.isVariable && cursorPos >= span.startIndex && cursorPos <= span.endIndex
    )

    if (clickedSpan) {
      const rect = textarea.getBoundingClientRect()
      setTooltip({
        visible: true,
        x: e.clientX,
        y: rect.top - 10,
        variable: clickedSpan,
      })
    } else {
      setTooltip(prev => ({ ...prev, visible: false }))
    }
  }

  return (
    <div className={`relative h-full ${className}`} onClick={handleClick}>
      {/* Highlight layer (behind textarea) */}
      <div
        ref={highlightRef}
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-transparent px-3 py-2 font-mono text-xs leading-normal"
        aria-hidden="true"
      >
        {spans.map((span, idx) => (
          <span
            key={idx}
            className={
              span.isVariable
                ? span.isResolved
                  ? 'rounded bg-green-500/20 px-0.5'
                  : 'rounded bg-red-500/20 px-0.5'
                : ''
            }
            style={{ color: 'transparent' }}
          >
            {span.text}
          </span>
        ))}
      </div>

      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        className="relative z-10 h-full w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs leading-normal text-foreground caret-foreground focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
        spellCheck={false}
      />

      {/* Tooltip */}
      {tooltip.visible && tooltip.variable && (
        <div
          className="fixed z-50 max-w-xs rounded-lg border border-border bg-surface px-3 py-2 shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%) translateY(-100%)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                tooltip.variable.isResolved ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'
              }`}
            ></span>
            <code className="text-xs font-mono font-semibold text-foreground">{tooltip.variable.text}</code>
          </div>
          {tooltip.variable.isResolved ? (
            <p className="text-xs text-foreground">
              <span className="text-muted-foreground">Resolves to:</span>{' '}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono font-medium">
                {tooltip.variable.resolvedValue}
              </code>
            </p>
          ) : (
            <>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Variable not found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Define in Workspace Settings → Environments or Global Variables
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

