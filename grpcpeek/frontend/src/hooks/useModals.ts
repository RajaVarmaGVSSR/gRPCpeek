import { useState } from 'react'

export interface ModalsState {
  showEnvironmentEditor: boolean
  showGlobalVariables: boolean
  showKeyboardShortcuts: boolean
  showCommandPalette: boolean
  showSettings: boolean
  showCreateWorkspace: boolean
  showWorkspaceSettings: boolean
  workspaceToRename: string | null
}

export interface ModalsActions {
  setShowEnvironmentEditor: (show: boolean) => void
  setShowGlobalVariables: (show: boolean) => void
  setShowKeyboardShortcuts: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  setShowCreateWorkspace: (show: boolean) => void
  setShowWorkspaceSettings: (show: boolean) => void
  setWorkspaceToRename: (id: string | null) => void
  openEnvironmentEditor: () => void
  closeEnvironmentEditor: () => void
  openGlobalVariables: () => void
  closeGlobalVariables: () => void
  openKeyboardShortcuts: () => void
  closeKeyboardShortcuts: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSettings: () => void
  closeSettings: () => void
  openCreateWorkspace: () => void
  closeCreateWorkspace: () => void
  openWorkspaceSettings: () => void
  closeWorkspaceSettings: () => void
  openWorkspaceRename: (id: string) => void
  closeWorkspaceRename: () => void
}

export type UseModalsReturn = ModalsState & ModalsActions

/**
 * Custom hook to manage all modal states in the application
 */
export function useModals(): UseModalsReturn {
  const [showEnvironmentEditor, setShowEnvironmentEditor] = useState(false)
  const [showGlobalVariables, setShowGlobalVariables] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false)
  const [workspaceToRename, setWorkspaceToRename] = useState<string | null>(null)

  return {
    // State
    showEnvironmentEditor,
    showGlobalVariables,
    showKeyboardShortcuts,
    showCommandPalette,
    showSettings,
    showCreateWorkspace,
    showWorkspaceSettings,
    workspaceToRename,

    // Setters (raw)
    setShowEnvironmentEditor,
    setShowGlobalVariables,
    setShowKeyboardShortcuts,
    setShowCommandPalette,
    setShowSettings,
    setShowCreateWorkspace,
    setShowWorkspaceSettings,
    setWorkspaceToRename,

    // Convenience methods
    openEnvironmentEditor: () => setShowEnvironmentEditor(true),
    closeEnvironmentEditor: () => setShowEnvironmentEditor(false),
    openGlobalVariables: () => setShowGlobalVariables(true),
    closeGlobalVariables: () => setShowGlobalVariables(false),
    openKeyboardShortcuts: () => setShowKeyboardShortcuts(true),
    closeKeyboardShortcuts: () => setShowKeyboardShortcuts(false),
    openCommandPalette: () => setShowCommandPalette(true),
    closeCommandPalette: () => setShowCommandPalette(false),
    openSettings: () => setShowSettings(true),
    closeSettings: () => setShowSettings(false),
    openCreateWorkspace: () => setShowCreateWorkspace(true),
    closeCreateWorkspace: () => setShowCreateWorkspace(false),
    openWorkspaceSettings: () => setShowWorkspaceSettings(true),
    closeWorkspaceSettings: () => setShowWorkspaceSettings(false),
    openWorkspaceRename: (id: string) => setWorkspaceToRename(id),
    closeWorkspaceRename: () => setWorkspaceToRename(null),
  }
}
