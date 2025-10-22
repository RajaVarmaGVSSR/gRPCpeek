/**
 * GlobalVariablesModal - Manage workspace-level global variables
 * 
 * Features:
 * - View all global variables
 * - Add new global variables
 * - Edit existing variables
 * - Toggle enabled/disabled state
 * - Toggle secret (password) state
 * - Delete variables
 */

import { useState } from 'react'
import { Button, Input, Card } from '../ui'
import type { Variable } from '../../types/workspace'

interface GlobalVariablesModalProps {
  variables: Variable[]
  onSave: (variables: Variable[]) => void
  onClose: () => void
}

export function GlobalVariablesModal({
  variables: initialVariables,
  onSave,
  onClose,
}: GlobalVariablesModalProps) {
  const [variables, setVariables] = useState<Variable[]>(initialVariables)

  const addVariable = () => {
    const newVar: Variable = {
      id: `global-var-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
      secret: false,
    }
    setVariables([...variables, newVar])
  }

  const updateVariable = (id: string, updates: Partial<Variable>) => {
    setVariables(variables.map(v => v.id === id ? { ...v, ...updates } : v))
  }

  const deleteVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id))
  }

  const handleSave = () => {
    onSave(variables)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in" onClick={onClose}>
      <Card className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 p-6">
          <div>
            <h2 className="text-xl font-semibold">Global Variables</h2>
            <p className="text-sm text-muted-foreground">
              Variables available across all environments. Reference with <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{'{{global.key}}'}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {variables.length} variable{variables.length !== 1 ? 's' : ''}
              </p>
              <Button size="sm" onClick={addVariable}>
                + Add Variable
              </Button>
            </div>

            {variables.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-12 text-center">
                <div className="mb-3 text-3xl opacity-40">🌍</div>
                <p className="mb-2 font-medium">No global variables yet</p>
                <p className="text-sm text-muted-foreground">
                  Global variables can be used in any environment or request
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <div className="w-10"></div>
                  <div>Key</div>
                  <div>Value</div>
                  <div className="w-10"></div>
                  <div className="w-10"></div>
                </div>

                {variables.map((variable) => (
                  <div key={variable.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-surface p-3">
                    <input
                      type="checkbox"
                      checked={variable.enabled}
                      onChange={(e) => updateVariable(variable.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-focus"
                      title={variable.enabled ? 'Enabled' : 'Disabled'}
                    />
                    
                    <Input
                      value={variable.key}
                      onChange={(e) => updateVariable(variable.id, { key: e.target.value })}
                      placeholder="VARIABLE_NAME"
                      className="font-mono"
                      disabled={!variable.enabled}
                    />
                    
                    <Input
                      type={variable.secret ? 'password' : 'text'}
                      value={variable.value}
                      onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                      placeholder="value"
                      disabled={!variable.enabled}
                    />
                    
                    <button
                      onClick={() => updateVariable(variable.id, { secret: !variable.secret })}
                      className="rounded p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
                      title={variable.secret ? 'Show value' : 'Hide value (secret)'}
                      disabled={!variable.enabled}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {variable.secret ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        )}
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => deleteVariable(variable.id)}
                      className="rounded p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      title="Delete variable"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Helper Text */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <div className="flex gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Usage in requests:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs">
                    <li>Reference global variables with <code className="rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900/40">{'{{global.API_VERSION}}'}</code></li>
                    <li>Global variables work across all environments</li>
                    <li>Disabled variables won't be resolved</li>
                    <li>Secret variables are hidden by default</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border/50 p-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  )
}
