import { useModal } from '../contexts/ModalContext'
import { EnvironmentEditorModal } from './workspace/EnvironmentEditorModal'
import { GlobalVariablesModal } from './workspace/GlobalVariablesModal'
import { KeyboardShortcutsModal } from './workspace/KeyboardShortcutsModal'
import { CommandPalette } from './workspace/CommandPalette'
import { SettingsModal } from './workspace/SettingsModal'
import { CreateWorkspaceModal } from './workspace/CreateWorkspaceModal'
import { WorkspaceSettingsModal } from './workspace/WorkspaceSettingsModal'
import { SaveRequestModal } from './workspace/SaveRequestModal'

/**
 * Central modal renderer - handles all app-wide modals
 * Separates modal rendering from business logic
 */
export function ModalRenderer() {
  const { isModalOpen, getModalProps, closeModal } = useModal()

  return (
    <>
      {/* Environment Editor Modal */}
      {isModalOpen('environmentEditor') && (() => {
        const props = getModalProps('environmentEditor')
        return props ? (
          <EnvironmentEditorModal
            {...props as any}
            onClose={() => closeModal('environmentEditor')}
          />
        ) : null
      })()}

      {/* Global Variables Modal */}
      {isModalOpen('globalVariables') && (() => {
        const props = getModalProps('globalVariables')
        return props ? (
          <GlobalVariablesModal
            {...props as any}
            onClose={() => closeModal('globalVariables')}
          />
        ) : null
      })()}

      {/* Keyboard Shortcuts Modal */}
      {isModalOpen('keyboardShortcuts') && (
        <KeyboardShortcutsModal
          isOpen={true}
          onClose={() => closeModal('keyboardShortcuts')}
        />
      )}

      {/* Command Palette */}
      {isModalOpen('commandPalette') && (() => {
        const props = getModalProps('commandPalette')
        return props ? (
          <CommandPalette
            isOpen={true}
            {...props as any}
            onClose={() => closeModal('commandPalette')}
          />
        ) : null
      })()}

      {/* Settings Modal */}
      {isModalOpen('settings') && (() => {
        const props = getModalProps('settings')
        return props ? (
          <SettingsModal
            isOpen={true}
            {...props as any}
            onClose={() => closeModal('settings')}
          />
        ) : null
      })()}

      {/* Create Workspace Modal */}
      {isModalOpen('createWorkspace') && (() => {
        const props = getModalProps('createWorkspace')
        return props ? (
          <CreateWorkspaceModal
            isOpen={true}
            {...props as any}
            onClose={() => closeModal('createWorkspace')}
          />
        ) : null
      })()}

      {/* Workspace Settings Modal */}
      {isModalOpen('workspaceSettings') && (() => {
        const props = getModalProps('workspaceSettings')
        return props ? (
          <WorkspaceSettingsModal
            isOpen={true}
            {...props as any}
            onClose={() => closeModal('workspaceSettings')}
          />
        ) : null
      })()}

      {/* Save Request Modal */}
      {isModalOpen('saveRequest') && (() => {
        const props = getModalProps('saveRequest')
        return props ? (
          <SaveRequestModal
            isOpen={true}
            {...props as any}
            onClose={() => closeModal('saveRequest')}
          />
        ) : null
      })()}
    </>
  )
}
