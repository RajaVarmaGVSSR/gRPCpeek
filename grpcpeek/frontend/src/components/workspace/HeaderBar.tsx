/**
 * HeaderBar - Top navigation bar with workspace selector and actions
 * 
 * Features:
 * - Workspace dropdown (switch between workspaces)
 * - Global variables button
 * - Settings button
 */

import { Badge, Button } from '../ui'
import { WorkspaceSelector } from './WorkspaceSelector'
import type { Workspace } from '../../types/workspace'

interface HeaderBarProps {
  workspaces: Workspace[]
  activeWorkspaceId: string
  onWorkspaceSwitch: (workspaceId: string) => void
  onWorkspaceCreate: () => void
  onWorkspaceRename: (workspaceId: string) => void
  onWorkspaceDelete: (workspaceId: string) => void
  onWorkspaceSettings: (workspaceId: string) => void
  workspace: Workspace
  onGlobalVariablesClick?: () => void
  onSettingsClick?: () => void
  onKeyboardShortcutsClick?: () => void
  onSidebarToggle?: () => void
  isSidebarOpen?: boolean
}

export function HeaderBar({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSwitch,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
  onWorkspaceSettings,
  workspace,
  onGlobalVariablesClick,
  onSettingsClick,
  onKeyboardShortcutsClick,
  onSidebarToggle,
  isSidebarOpen,
}: HeaderBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-surface/30 px-4 py-3 md:px-6">
      {/* Left Section: Mobile Menu + Branding + Workspace */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile Sidebar Toggle - Only visible on mobile/tablet */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSidebarToggle}
          className="lg:hidden"
          title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </Button>
        
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">gRPCpeek</h1>
        </div>
        
        {/* Workspace Selector - Hidden on mobile */}
        <div className="hidden sm:block">
          <WorkspaceSelector
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSwitch={onWorkspaceSwitch}
            onCreate={onWorkspaceCreate}
            onRename={onWorkspaceRename}
            onDelete={onWorkspaceDelete}
            onSettings={onWorkspaceSettings}
          />
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Keyboard Shortcuts Button - Hidden on mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onKeyboardShortcutsClick}
          title="Keyboard shortcuts (? or Ctrl+/)"
          className="hidden md:flex"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </Button>

        {/* Global Variables Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onGlobalVariablesClick}
          className="gap-2"
          title="Manage global variables"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          <span className="hidden sm:inline">Variables</span>
          {workspace.globals.length > 0 && (
            <Badge variant="neutral" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
              {workspace.globals.length}
            </Badge>
          )}
        </Button>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          title="Settings"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Button>
      </div>
    </header>
  )
}
