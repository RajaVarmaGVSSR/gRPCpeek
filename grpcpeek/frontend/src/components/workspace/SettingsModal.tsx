/**
 * SettingsModal - User preferences and settings
 * 
 * Features:
 * - Theme selection (light/dark/auto)
 * - Font size preferences
 * - Default environment
 * - Auto-save toggle
 * - Persist to localStorage
 */

import { useState, useEffect } from 'react'
import { Button, Select, Label } from '../ui'

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto'
  fontSize: 'small' | 'medium' | 'large'
  defaultEnvironmentId: string | null
  autoSave: boolean
  compactMode: boolean
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: UserSettings
  onSave: (settings: UserSettings) => void
  environments?: Array<{ id: string; name: string }>
}

const SETTINGS_STORAGE_KEY = 'grpcpeek_user_settings'

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  environments = [],
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(localSettings)
    // Persist to localStorage
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(localSettings))
    onClose()
  }

  const handleReset = () => {
    const defaultSettings: UserSettings = {
      theme: 'auto',
      fontSize: 'medium',
      defaultEnvironmentId: null,
      autoSave: true,
      compactMode: false,
    }
    setLocalSettings(defaultSettings)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="text-xl font-semibold">Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize your gRPCpeek experience
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Content */}
        <div className="max-h-[60vh] space-y-6 overflow-y-auto p-6">
          {/* Appearance Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Appearance
            </h3>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme-select">Theme</Label>
              <Select
                id="theme-select"
                value={localSettings.theme}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, theme: e.target.value as any })
                }
              >
                <option value="auto">Auto (System)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color theme
              </p>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label htmlFor="font-size-select">Font Size</Label>
              <Select
                id="font-size-select"
                value={localSettings.fontSize}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, fontSize: e.target.value as any })
                }
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Adjust the base font size for better readability
              </p>
            </div>

            {/* Compact Mode */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="compact-mode">Compact Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Reduce spacing for more content density
                </p>
              </div>
              <button
                id="compact-mode"
                role="switch"
                aria-checked={localSettings.compactMode}
                onClick={() =>
                  setLocalSettings({ ...localSettings, compactMode: !localSettings.compactMode })
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  localSettings.compactMode ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    localSettings.compactMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Behavior Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Behavior
            </h3>

            {/* Default Environment */}
            <div className="space-y-2">
              <Label htmlFor="default-env-select">Default Environment</Label>
              <Select
                id="default-env-select"
                value={localSettings.defaultEnvironmentId || ''}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    defaultEnvironmentId: e.target.value || null,
                  })
                }
              >
                <option value="">None (Use last selected)</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Set the default environment to use on startup
              </p>
            </div>

            {/* Auto-save */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="auto-save">Auto-save Requests</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save request changes
                </p>
              </div>
              <button
                id="auto-save"
                role="switch"
                aria-checked={localSettings.autoSave}
                onClick={() =>
                  setLocalSettings({ ...localSettings, autoSave: !localSettings.autoSave })
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  localSettings.autoSave ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    localSettings.autoSave ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* About Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </h3>
            <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">gRPCpeek</h4>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  v0.1.0
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                A modern, cross-platform gRPC client built with Tauri and React.
              </p>
              <div className="flex gap-3 pt-2 text-xs">
                <a
                  href="https://github.com/yourusername/grpcpeek"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/yourusername/grpcpeek/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Report Issue
                </a>
                <a
                  href="https://github.com/yourusername/grpcpeek/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  License
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border p-6">
          <Button variant="ghost" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to load settings from localStorage
export function loadUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load user settings:', error)
  }

  // Return default settings
  return {
    theme: 'auto',
    fontSize: 'medium',
    defaultEnvironmentId: null,
    autoSave: true,
    compactMode: false,
  }
}
