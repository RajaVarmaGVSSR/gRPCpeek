import { useState, useEffect, useMemo } from 'react'
import { Input } from '../ui'
import type { Service } from '../../types/workspace'

interface Command {
  id: string
  label: string
  category: string
  icon?: string
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  services: Service[]
  onMethodClick: (service: string, method: string) => void
  onShowShortcuts?: () => void
  onShowSettings?: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  services,
  onMethodClick,
  onShowShortcuts,
  onShowSettings,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Build commands list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = []

    // Add service methods
    services.forEach((service) => {
      service.methods.forEach((method) => {
        cmds.push({
          id: `method-${service.name}-${method.name}`,
          label: `${service.name}.${method.name}`,
          category: 'Methods',
          icon: '⚡',
          action: () => {
            onMethodClick(service.name, method.name)
            onClose()
          },
          keywords: [service.name, method.name, method.methodType],
        })
      })
    })

    // Add app commands
    if (onShowShortcuts) {
      cmds.push({
        id: 'shortcuts',
        label: 'Show Keyboard Shortcuts',
        category: 'App',
        icon: '⌨️',
        action: () => {
          onShowShortcuts()
          onClose()
        },
        keywords: ['keyboard', 'shortcuts', 'help'],
      })
    }

    if (onShowSettings) {
      cmds.push({
        id: 'settings',
        label: 'Open Settings',
        category: 'App',
        icon: '⚙️',
        action: () => {
          onShowSettings()
          onClose()
        },
        keywords: ['settings', 'preferences', 'config'],
      })
    }

    return cmds
  }, [services, onMethodClick, onShowShortcuts, onShowSettings, onClose])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands

    const lowerQuery = query.toLowerCase()
    return commands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(lowerQuery)
      const matchKeywords = cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))
      return matchLabel || matchKeywords
    })
  }, [commands, query])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="border-b border-border p-4">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            autoFocus
            className="border-0 bg-transparent text-base focus:ring-0"
          />
        </div>

        {/* Commands List */}
        <div className="max-h-[400px] overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No commands found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    const globalIndex = filteredCommands.indexOf(cmd)
                    const isSelected = globalIndex === selectedIndex
                    return (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-surface-emphasis text-surface-contrast'
                            : 'hover:bg-surface-muted'
                        }`}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        {cmd.icon && <span className="text-lg">{cmd.icon}</span>}
                        <span className="flex-1 text-sm text-foreground">{cmd.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center gap-4 border-t border-border bg-surface-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono font-semibold">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono font-semibold">
              Enter
            </kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono font-semibold">
              Esc
            </kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
