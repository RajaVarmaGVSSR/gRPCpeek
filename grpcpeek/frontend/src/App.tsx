import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

import { Sidebar, type SidebarView } from './components/workspace/Sidebar'
import { RequestTabs } from './components/workspace/RequestTabs'
import { RequestEditor } from './components/workspace/RequestEditor'
import { RequestHeader } from './components/workspace/RequestHeader'
import { ResponseViewer } from './components/workspace/ResponseViewer'
import { HeaderBar } from './components/workspace/HeaderBar'
import { loadUserSettings, type UserSettings } from './components/workspace/SettingsModal'
import { Button } from './components/ui/Button'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useWorkspaceManager } from './hooks/useWorkspaceManager'
import { useRequestManager } from './hooks/useRequestManager'
import { useToast } from './contexts/ToastContext'
import {
  useModal,
  useGlobalVariablesModal,
  useKeyboardShortcutsModal,
  useCommandPalette,
  useSettingsModal,
  useWorkspaceModals,
} from './contexts/ModalContext'
import { saveWorkspace } from './lib/workspace'

type WorkspaceSettingsTab = 'general' | 'imports' | 'globals' | 'environments'

function App() {
  const { showToast } = useToast()
  
  // Modal hooks (from centralized ModalContext)
  const { openModal } = useModal()
  const globalVariablesModal = useGlobalVariablesModal()
  const keyboardShortcutsModal = useKeyboardShortcutsModal()
  const commandPalette = useCommandPalette()
  const settingsModal = useSettingsModal()
  const workspaceModals = useWorkspaceModals()
  
  // State management hooks
  const workspaceManager = useWorkspaceManager()
  const requestManager = useRequestManager(
    workspaceManager.workspace,
    workspaceManager.setWorkspace,
    showToast,
    openModal
  )
  const setServices = requestManager.setServices
  const hasEnabledImportPaths = workspaceManager.workspace.importPaths.some((ip) => ip.enabled)
  
  // UI state
  const [sidebarView, setSidebarView] = useState<SidebarView>('services')
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved, 10) : 280
  })
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [userSettings, setUserSettings] = useState<UserSettings>(() => loadUserSettings())
  const [isParsingProtos, setIsParsingProtos] = useState(false)
  const [parsedWorkspaceId, setParsedWorkspaceId] = useState<string | null>(null)

  // Sidebar resize handler
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString())
  }, [sidebarWidth])

  // Apply user settings to root element
  useEffect(() => {
    const root = document.documentElement
    
    // Apply theme
    if (userSettings.theme === 'dark') {
      root.classList.add('dark')
    } else if (userSettings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      // Auto: use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    // Apply font size
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large')
    root.classList.add(`font-size-${userSettings.fontSize}`)

    // Apply compact mode
    if (userSettings.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
  }, [userSettings])

  // Save workspace to localStorage whenever it changes
  useEffect(() => {
    saveWorkspace(workspaceManager.workspace)
  }, [workspaceManager.workspace])

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Enter',
      ctrl: true,
      handler: () => {
        if (requestManager.activeTab && !requestManager.activeTab.isLoading) {
          requestManager.handleGrpcCall()
        }
      },
    },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        if (requestManager.activeTab) {
          requestManager.handleSaveRequest()
        }
      },
    },
    {
      key: 'w',
      ctrl: true,
      handler: () => {
        if (requestManager.activeTabId) {
          requestManager.closeTab(requestManager.activeTabId)
        }
      },
    },
    {
      key: 'Tab',
      ctrl: true,
      handler: (e) => {
        e.preventDefault()
        if (requestManager.tabs.length > 1 && requestManager.activeTabId) {
          const currentIndex = requestManager.tabs.findIndex((t) => t.id === requestManager.activeTabId)
          const nextIndex = (currentIndex + 1) % requestManager.tabs.length
          requestManager.setActiveTabId(requestManager.tabs[nextIndex].id)
        }
      },
    },
    {
      key: '?',
      handler: () => {
        keyboardShortcutsModal.open()
      },
    },
    {
      key: 'Escape',
      handler: () => {
        if (keyboardShortcutsModal.isOpen) {
          keyboardShortcutsModal.close()
        } else if (commandPalette.isOpen) {
          commandPalette.close()
        }
      },
    },
    {
      key: 'k',
      ctrl: true,
      handler: (e) => {
        e.preventDefault()
        commandPalette.open()
      },
    },
  ])

  // Proto reparse handler (extracted from inline logic)
  const handleProtoReparse = useCallback(async (
    options?: { showStartToast?: boolean; showSuccessToast?: boolean; suppressErrors?: boolean }
  ) => {
    const { showStartToast = true, showSuccessToast = true, suppressErrors = false } = options || {}

    if (isParsingProtos) {
      if (!suppressErrors && showStartToast) {
        showToast('Proto parsing already in progress', 'info')
      }
      return false
    }

    const enabledPaths = workspaceManager.workspace.importPaths
      .filter((ip) => ip.enabled)
      .map((ip) => ({
        id: ip.id,
        path: ip.path,
        type: ip.type,
        enabled: ip.enabled,
      }))

    if (enabledPaths.length === 0) {
      if (!suppressErrors) {
        showToast('No import paths configured', 'error')
      }
      return false
    }

    try {
      if (showStartToast) {
        showToast('Parsing proto files...', 'info')
      }

      setIsParsingProtos(true)

      const result = await invoke<{
        success: boolean
        services: any[]
        errors: Array<{ file: string; message: string; suggestion?: string }>
        warnings: string[]
      }>('parse_proto_files', { importPaths: enabledPaths })

      if (result.success) {
  setServices(result.services)
        setParsedWorkspaceId(workspaceManager.workspace.id)

        if (showSuccessToast) {
          const serviceCount = result.services.length
          const methodCount = result.services.reduce((sum: number, s: any) => sum + s.methods.length, 0)
          showToast(`✓ Parsed ${serviceCount} services with ${methodCount} methods`, 'success')
        }

        if (result.warnings.length > 0) {
          console.warn('Parse warnings:', result.warnings)
        }

        return true
      } else {
        if (!suppressErrors) {
          showToast(`Failed to parse protos: ${result.errors[0]?.message || 'Unknown error'}`, 'error')
        }
        console.error('Parse errors:', result.errors)
        return false
      }
    } catch (error) {
      if (!suppressErrors) {
        showToast(`Error parsing protos: ${error}`, 'error')
      }
      console.error('Parse error:', error)
      return false
    } finally {
      setIsParsingProtos(false)
    }
  }, [
    isParsingProtos,
    setServices,
    showToast,
    workspaceManager.workspace.id,
    workspaceManager.workspace.importPaths,
  ])

  const openWorkspaceSettings = (initialTab: WorkspaceSettingsTab = 'general') => {
    workspaceModals.openWorkspaceSettings({
      workspace: workspaceManager.workspace,
      onSave: workspaceManager.updateWorkspace,
      onImportPathAdd: workspaceManager.handleImportPathAdd,
      onImportPathRemove: workspaceManager.handleImportPathRemove,
      onImportPathToggle: workspaceManager.handleImportPathToggle,
      onReparse: handleProtoReparse,
      onEnvironmentCreate: workspaceManager.createEnvironmentEntry,
      onEnvironmentUpdate: workspaceManager.updateEnvironmentEntry,
      onEnvironmentDelete: workspaceManager.deleteEnvironmentEntry,
      initialTab,
    })
  }

  // Keep the workspace settings modal in sync with environment changes
  useEffect(() => {
    if (workspaceModals.isWorkspaceSettingsOpen) {
      const currentProps = workspaceModals.workspaceSettingsProps
      if (currentProps && currentProps.workspace) {
        // Only update if the environments have actually changed (compare by reference)
        const currentEnvs = currentProps.workspace.environments
        const newEnvs = workspaceManager.workspace.environments
        if (currentEnvs !== newEnvs) {
          workspaceModals.openWorkspaceSettings({
            ...currentProps,
            workspace: workspaceManager.workspace,
          })
        }
      }
    }
  }, [workspaceManager.workspace.environments, workspaceModals])

  useEffect(() => {
    if (!hasEnabledImportPaths) {
      setParsedWorkspaceId(null)
      return
    }

    if (parsedWorkspaceId === workspaceManager.workspace.id || isParsingProtos) {
      return
    }

    setParsedWorkspaceId(workspaceManager.workspace.id)
    void handleProtoReparse({ showStartToast: false, showSuccessToast: false, suppressErrors: true })
  }, [
    handleProtoReparse,
    hasEnabledImportPaths,
    isParsingProtos,
    parsedWorkspaceId,
    workspaceManager.workspace.id,
  ])

  return (
    <div className="flex h-dvh min-h-[640px] flex-col bg-background">
      {/* Header Bar */}
      <HeaderBar
        workspaces={workspaceManager.workspaces}
        activeWorkspaceId={workspaceManager.workspace.id}
        onWorkspaceSwitch={workspaceManager.switchWorkspace}
        onWorkspaceCreate={() => workspaceModals.openCreateWorkspace({
          onSave: (name: string) => {
            workspaceManager.createWorkspace(name)
            showToast(`Workspace "${name}" created`, 'success')
            workspaceModals.closeCreateWorkspace()
          },
          existingNames: workspaceManager.workspaces.map(w => w.name),
          mode: 'create',
        })}
        onWorkspaceRename={(id: string) => workspaceModals.openCreateWorkspace({
          onSave: (name: string) => {
            workspaceManager.renameWorkspace(id, name)
            showToast(`Workspace renamed to "${name}"`, 'success')
            workspaceModals.closeCreateWorkspace()
          },
          existingNames: workspaceManager.workspaces.map(w => w.name),
          mode: 'rename',
          currentName: workspaceManager.workspaces.find(w => w.id === id)?.name,
        })}
        onWorkspaceDelete={workspaceManager.deleteWorkspace}
  onWorkspaceSettings={(_workspaceId) => openWorkspaceSettings()}
        workspace={workspaceManager.workspace}
        onGlobalVariablesClick={() => globalVariablesModal.open({
          variables: workspaceManager.workspace.globals,
          onSave: workspaceManager.handleGlobalVariablesSave,
        })}
        onKeyboardShortcutsClick={() => keyboardShortcutsModal.open()}
        onSettingsClick={() => settingsModal.open({
          settings: userSettings,
          onSave: (newSettings: UserSettings) => {
            setUserSettings(newSettings)
            showToast('Settings saved successfully', 'success')
          },
          environments: workspaceManager.workspace.environments,
        })}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed to left edge */}
        <div
          className={`
            fixed inset-y-0 left-0 top-[60px] z-30 transform transition-transform duration-300 lg:relative lg:top-0 lg:z-auto lg:translate-x-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        >
            {/* Mobile overlay backdrop */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
                aria-hidden="true"
              />
            )}
            
            {/* Sidebar content */}
            <div className="relative h-full">
              <Sidebar
                view={sidebarView}
                onViewChange={setSidebarView}
                services={requestManager.services}
                collections={workspaceManager.workspace.collections}
                history={workspaceManager.workspace.requestHistory}
                onMethodClick={requestManager.handleMethodClick}
                onSavedRequestClick={requestManager.handleLoadRequest}
                onSavedRequestDelete={requestManager.handleDeleteRequest}
                onSavedRequestRename={requestManager.handleRenameRequest}
                onHistoryClick={requestManager.handleLoadRequest}
                onCreateCollection={workspaceManager.handleCreateCollection}
                onRenameCollection={workspaceManager.handleRenameCollection}
                onDeleteCollection={workspaceManager.handleDeleteCollection}
                onCreateFolder={workspaceManager.handleCreateFolder}
                onRenameFolder={workspaceManager.handleRenameFolder}
                onDeleteFolder={workspaceManager.handleDeleteFolder}
                onCreateRequestInCollection={requestManager.handleCreateRequestInCollection}
              />
              
              {/* Resize handle - only on desktop */}
              <div
                className="hidden lg:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizing(true)
                }}
                style={{
                  backgroundColor: isResizing ? 'rgb(var(--primary) / 0.5)' : 'transparent'
                }}
              />
            </div>
          </div>

          {/* Main content area - Full width minus sidebar */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-5 py-6 lg:px-8">

            {/* Tabs Bar - Full Width */}
            <RequestTabs
              tabs={requestManager.tabs}
              activeTabId={requestManager.activeTabId}
              onTabClick={requestManager.setActiveTabId}
              onTabClose={requestManager.closeTab}
            />

            {/* Request Header - Shows environment, host, and port */}
            {requestManager.activeTab && (
              <RequestHeader
                workspace={workspaceManager.workspace}
                selectedEnvironmentId={requestManager.activeTab.selectedEnvironmentId}
                onEnvironmentChange={(envId) => requestManager.updateActiveTab({ selectedEnvironmentId: envId, isDirty: true })}
                requestHost={requestManager.activeTab.requestHost}
                requestPort={requestManager.activeTab.requestPort}
                onRequestHostChange={(host) => requestManager.updateActiveTab({ requestHost: host, isDirty: true })}
                onRequestPortChange={(port) => requestManager.updateActiveTab({ requestPort: port, isDirty: true })}
                onSyncFromEnvironment={requestManager.syncFromEnvironment}
              />
            )}

            {/* Request and Response Grid - Responsive: Stack on mobile, side-by-side on desktop */}
            <div className="grid flex-1 min-h-0 gap-4 md:gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Left column: Request Editor */}
              {requestManager.activeTab ? (
                <RequestEditor
                  tab={requestManager.activeTab}
                  onUpdate={requestManager.updateActiveTab}
                  onGenerateSample={requestManager.handleGenerateSample}
                  isGenerating={requestManager.isGenerating}
                  canGenerateSample={!!requestManager.protoContent || requestManager.services.length > 0}
                  workspace={workspaceManager.workspace}
                  onSendRequest={requestManager.handleGrpcCall}
                  onSaveRequest={requestManager.handleSaveRequest}
                  onSendStreamMessage={requestManager.handleSendStreamMessage}
                  onFinishStreaming={requestManager.handleFinishStreaming}
                  services={requestManager.services}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-surface-muted/20 p-8">
                  <div className="mb-4 text-4xl opacity-40">👈</div>
                  <div className="space-y-3 text-center max-w-md">
                    <h3 className="text-base font-semibold text-foreground">
                      Select a gRPC Method
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Click a method in the service list to create a new request tab and start testing your gRPC services
                    </p>
                    {requestManager.services.length === 0 && (
                      <div className="flex flex-col items-center gap-3 pt-4">
                        <Button
                          onClick={() => handleProtoReparse()}
                          disabled={isParsingProtos || !hasEnabledImportPaths}
                          variant="secondary"
                          size="sm"
                        >
                          {isParsingProtos ? 'Parsing...' : 'Parse Proto Files'}
                        </Button>
                        <p className="text-xs text-muted-foreground border-t border-border/50 pt-4 text-center">
                          💡 <strong>Getting Started:</strong> Configure proto import paths in{' '}
                          <button
                            onClick={() => openWorkspaceSettings()}
                            className="text-primary hover:underline font-medium"
                          >
                            Workspace Settings
                          </button>
                          {' '}and refresh once they're saved.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right column: Response Viewer */}
              <ResponseViewer
                tab={requestManager.activeTab || null}
                onClearStreaming={() => {
                  if (requestManager.activeTab) {
                    requestManager.updateActiveTab({
                      streamingMessages: [],
                      isStreaming: false
                    })
                  }
                }}
              />
            </div>
          </div>
      </div>
    </div>
  )
}

export default App
