import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// Modal registry - all modals that can be opened app-wide
export type ModalType = 
  | 'environmentEditor'
  | 'globalVariables'
  | 'keyboardShortcuts'
  | 'commandPalette'
  | 'settings'
  | 'createWorkspace'
  | 'workspaceSettings'
  | 'saveRequest'

interface ModalContextType {
  openModal: (type: ModalType, props?: Record<string, any>) => void
  closeModal: (type: ModalType) => void
  closeAllModals: () => void
  isModalOpen: (type: ModalType) => boolean
  getModalProps: (type: ModalType) => Record<string, any> | undefined
}

const ModalContext = createContext<ModalContextType | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModals, setActiveModals] = useState<Map<ModalType, Record<string, any>>>(new Map())

  const openModal = useCallback((type: ModalType, props?: Record<string, any>) => {
    setActiveModals(prev => {
      const next = new Map(prev)
      next.set(type, props || {})
      return next
    })
  }, [])

  const closeModal = useCallback((type: ModalType) => {
    setActiveModals(prev => {
      const next = new Map(prev)
      next.delete(type)
      return next
    })
  }, [])

  const closeAllModals = useCallback(() => {
    setActiveModals(new Map())
  }, [])

  const isModalOpen = useCallback((type: ModalType) => {
    return activeModals.has(type)
  }, [activeModals])

  const getModalProps = useCallback((type: ModalType) => {
    return activeModals.get(type)
  }, [activeModals])

  return (
    <ModalContext.Provider value={{ 
      openModal, 
      closeModal, 
      closeAllModals, 
      isModalOpen, 
      getModalProps 
    }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}

// Convenience hooks for specific modals
export function useEnvironmentEditorModal() {
  const { openModal, closeModal, isModalOpen, getModalProps } = useModal()
  return {
    open: (props?: Record<string, any>) => openModal('environmentEditor', props),
    close: () => closeModal('environmentEditor'),
    isOpen: isModalOpen('environmentEditor'),
    props: getModalProps('environmentEditor'),
  }
}

export function useGlobalVariablesModal() {
  const { openModal, closeModal, isModalOpen, getModalProps } = useModal()
  return {
    open: (props?: Record<string, any>) => openModal('globalVariables', props),
    close: () => closeModal('globalVariables'),
    isOpen: isModalOpen('globalVariables'),
    props: getModalProps('globalVariables'),
  }
}

export function useKeyboardShortcutsModal() {
  const { openModal, closeModal, isModalOpen } = useModal()
  return {
    open: () => openModal('keyboardShortcuts'),
    close: () => closeModal('keyboardShortcuts'),
    isOpen: isModalOpen('keyboardShortcuts'),
  }
}

export function useCommandPalette() {
  const { openModal, closeModal, isModalOpen } = useModal()
  return {
    open: () => openModal('commandPalette'),
    close: () => closeModal('commandPalette'),
    isOpen: isModalOpen('commandPalette'),
  }
}

export function useSettingsModal() {
  const { openModal, closeModal, isModalOpen, getModalProps } = useModal()
  return {
    open: (props?: Record<string, any>) => openModal('settings', props),
    close: () => closeModal('settings'),
    isOpen: isModalOpen('settings'),
    props: getModalProps('settings'),
  }
}

export function useWorkspaceModals() {
  const { openModal, closeModal, isModalOpen, getModalProps } = useModal()
  return {
    openCreateWorkspace: (props?: Record<string, any>) => openModal('createWorkspace', props),
    closeCreateWorkspace: () => closeModal('createWorkspace'),
    isCreateWorkspaceOpen: isModalOpen('createWorkspace'),
    createWorkspaceProps: getModalProps('createWorkspace'),
    
    openWorkspaceSettings: (props?: Record<string, any>) => openModal('workspaceSettings', props),
    closeWorkspaceSettings: () => closeModal('workspaceSettings'),
    isWorkspaceSettingsOpen: isModalOpen('workspaceSettings'),
    workspaceSettingsProps: getModalProps('workspaceSettings'),
  }
}
