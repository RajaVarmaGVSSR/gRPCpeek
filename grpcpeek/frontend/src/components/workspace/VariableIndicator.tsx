import { useState, useEffect } from 'react'
import type { VariableContext } from '../../types/workspace'
import { resolveVariables, findVariablePlaceholders, getAvailableVariables } from '../../lib/variableResolver'

interface VariableIndicatorProps {
  text: string
  context: VariableContext
  className?: string
}

/**
 * Component that displays indicators for variables in text
 * Shows which variables are resolved (green) vs unresolved (red)
 */
export function VariableIndicator({ text, context, className = '' }: VariableIndicatorProps) {
  const [placeholders, setPlaceholders] = useState<string[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)

  useEffect(() => {
    const found = findVariablePlaceholders(text)
    setPlaceholders(found)

    if (found.length > 0) {
      const result = resolveVariables(text, context)
      setUnresolvedCount(result.unresolvedVars.length)
      setResolvedCount(found.length - result.unresolvedVars.length)
    } else {
      setUnresolvedCount(0)
      setResolvedCount(0)
    }
  }, [text, context])

  if (placeholders.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {resolvedCount > 0 && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></span>
          {resolvedCount} resolved
        </span>
      )}
      {unresolvedCount > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600 dark:bg-red-400"></span>
          {unresolvedCount} unresolved
        </span>
      )}
    </div>
  )
}

interface VariableAutocompleteProps {
  context: VariableContext
  onSelect: (placeholder: string) => void
  isOpen: boolean
  onClose: () => void
}

/**
 * Dropdown showing available variables for autocomplete
 * Triggered when user types {{
 */
export function VariableAutocomplete({ context, onSelect, isOpen, onClose }: VariableAutocompleteProps) {
  const availableVars = getAvailableVariables(context)

  if (!isOpen || availableVars.length === 0) {
    return null
  }

  return (
    <div className="absolute z-50 mt-1 w-72 rounded-lg border border-border bg-surface shadow-lg">
      <div className="p-2 border-b border-border/50">
        <p className="text-xs font-medium text-muted-foreground">Available Variables</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {availableVars.map((variable) => (
          <button
            key={variable.placeholder}
            onClick={() => {
              onSelect(variable.placeholder)
              onClose()
            }}
            className="w-full px-3 py-2 text-left hover:bg-surface-muted transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    variable.namespace === 'env' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}></span>
                  <code className="text-xs font-mono text-foreground">{variable.placeholder}</code>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{variable.value}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                variable.namespace === 'env'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
              }`}>
                {variable.namespace}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-border/50 bg-surface-muted/50">
        <p className="text-xs text-muted-foreground">
          💡 Click to insert, or press Esc to close
        </p>
      </div>
    </div>
  )
}

interface VariableTooltipProps {
  placeholder: string
  context: VariableContext
  position: { x: number; y: number }
}

/**
 * Tooltip showing the resolved value of a variable on hover
 */
export function VariableTooltip({ placeholder, context, position }: VariableTooltipProps) {
  const result = resolveVariables(placeholder, context)
  const isResolved = result.unresolvedVars.length === 0
  const value = isResolved ? result.resolved : 'Unresolved'

  return (
    <div
      className="fixed z-50 px-3 py-2 rounded-lg border border-border bg-surface shadow-lg max-w-xs"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block w-2 h-2 rounded-full ${
          isResolved ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'
        }`}></span>
        <code className="text-xs font-mono font-medium text-foreground">{placeholder}</code>
      </div>
      <p className={`text-xs ${
        isResolved ? 'text-foreground' : 'text-red-600 dark:text-red-400'
      }`}>
        {value}
      </p>
      {!isResolved && (
        <p className="text-xs text-muted-foreground mt-1">
          Check environment or global variables
        </p>
      )}
    </div>
  )
}
