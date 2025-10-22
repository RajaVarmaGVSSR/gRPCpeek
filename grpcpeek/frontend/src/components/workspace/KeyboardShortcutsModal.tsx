import { Button } from '../ui'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'Enter'], description: 'Send request', category: 'Request' },
  { keys: ['Ctrl', 'S'], description: 'Save request', category: 'Request' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Format JSON', category: 'Request' },
  { keys: ['Ctrl', 'W'], description: 'Close tab', category: 'Navigation' },
  { keys: ['Ctrl', 'Tab'], description: 'Next tab', category: 'Navigation' },
  { keys: ['Ctrl', 'K'], description: 'Command palette', category: 'Navigation' },
  { keys: ['Ctrl', 'F'], description: 'Focus search', category: 'Navigation' },
  { keys: ['?'], description: 'Show shortcuts', category: 'General' },
  { keys: ['Esc'], description: 'Close modal', category: 'General' },
]

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
            <p className="text-sm text-muted-foreground">Speed up your workflow</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">{category}</h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter((s) => s.category === category)
                    .map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-muted/30 px-4 py-2.5"
                      >
                        <span className="text-sm text-foreground">{shortcut.description}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <kbd
                              key={keyIdx}
                              className="rounded border border-border bg-surface px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
