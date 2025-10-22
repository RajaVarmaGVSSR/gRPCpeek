import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: (event: KeyboardEvent) => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === (event.ctrlKey || event.metaKey)
        const shiftMatch = shortcut.shift === undefined || shortcut.shift === event.shiftKey
        const altMatch = shortcut.alt === undefined || shortcut.alt === event.altKey
        const metaMatch = shortcut.meta === undefined || shortcut.meta === event.metaKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          event.preventDefault()
          shortcut.handler(event)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

// Common keyboard shortcuts
export const SHORTCUTS = {
  SEND_REQUEST: { key: 'Enter', ctrl: true, description: 'Send request' },
  SAVE_REQUEST: { key: 's', ctrl: true, description: 'Save request' },
  NEW_TAB: { key: 't', ctrl: true, description: 'New tab' },
  CLOSE_TAB: { key: 'w', ctrl: true, description: 'Close tab' },
  NEXT_TAB: { key: 'Tab', ctrl: true, description: 'Next tab' },
  PREV_TAB: { key: 'Tab', ctrl: true, shift: true, description: 'Previous tab' },
  FOCUS_SEARCH: { key: 'f', ctrl: true, description: 'Focus search' },
  FORMAT_JSON: { key: 'f', ctrl: true, shift: true, description: 'Format JSON' },
  TOGGLE_SIDEBAR: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
}
