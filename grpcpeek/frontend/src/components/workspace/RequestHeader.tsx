import { useState, useEffect } from 'react'
import { Card, Input, Label, Select } from '../ui'
import type { Workspace } from '../../types/workspace'

interface RequestHeaderProps {
  workspace: Workspace
  selectedEnvironmentId: string | null | undefined
  onEnvironmentChange: (environmentId: string | null) => void
  // For request-level overrides
  requestHost?: string
  requestPort?: number
  onRequestHostChange?: (host: string) => void
  onRequestPortChange?: (port: number) => void
  // For syncing metadata and auth from environment
  onSyncFromEnvironment?: (environmentId?: string | null) => void
}

export function RequestHeader({
  workspace,
  selectedEnvironmentId,
  onEnvironmentChange,
  requestHost,
  requestPort,
  onRequestHostChange,
  onRequestPortChange,
  onSyncFromEnvironment,
}: RequestHeaderProps) {
  const activeEnv = workspace.environments.find(env => env.id === selectedEnvironmentId)
  
  // Use request-level overrides if provided, otherwise use environment values
  const displayHost = requestHost ?? activeEnv?.host ?? 'localhost'
  const displayPort = requestPort ?? activeEnv?.port ?? 50051
  
  const [isManualMode, setIsManualMode] = useState(!!requestHost || !!requestPort)
  const [localHost, setLocalHost] = useState(displayHost)
  const [localPort, setLocalPort] = useState(displayPort.toString())

  // Update local state when environment changes
  useEffect(() => {
    if (!isManualMode) {
      setLocalHost(activeEnv?.host ?? 'localhost')
      setLocalPort((activeEnv?.port ?? 50051).toString())
    }
  }, [activeEnv, isManualMode])

  const handleEnvironmentChange = (envId: string | null) => {
    setIsManualMode(false)
    onEnvironmentChange(envId)
    // Sync metadata and auth from the NEW environment
    if (onSyncFromEnvironment && envId) {
      onSyncFromEnvironment(envId)
    }
  }

  const handleHostChange = (value: string) => {
    setLocalHost(value)
    setIsManualMode(true)
    onRequestHostChange?.(value)
  }

  const handlePortChange = (value: string) => {
    setLocalPort(value)
    const parsedPort = parseInt(value, 10)
    if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      setIsManualMode(true)
      onRequestPortChange?.(parsedPort)
    }
  }

  const handleResetToEnvironment = () => {
    setIsManualMode(false)
    setLocalHost(activeEnv?.host ?? 'localhost')
    setLocalPort((activeEnv?.port ?? 50051).toString())
    onRequestHostChange?.('')
    onRequestPortChange?.(0)
  }

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      {/* Environment Selector */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <Label htmlFor="request-environment" className="text-xs text-muted-foreground whitespace-nowrap">
          Environment:
        </Label>
        <Select
          id="request-environment"
          value={selectedEnvironmentId || ''}
          onChange={(e) => handleEnvironmentChange(e.target.value || null)}
          className="flex-1 text-xs h-8"
        >
          <option value="">No environment</option>
          {workspace.environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Host */}
      <div className="flex items-center gap-2 min-w-[200px] flex-1">
        <Label htmlFor="request-host" className="text-xs text-muted-foreground whitespace-nowrap">
          Host:
        </Label>
        <Input
          id="request-host"
          value={localHost}
          onChange={(e) => handleHostChange(e.target.value)}
          placeholder="localhost"
          className="flex-1 text-xs h-8"
        />
      </div>

      {/* Port */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <Label htmlFor="request-port" className="text-xs text-muted-foreground whitespace-nowrap">
          Port:
        </Label>
        <Input
          id="request-port"
          type="number"
          value={localPort}
          onChange={(e) => handlePortChange(e.target.value)}
          placeholder="50051"
          className="w-20 text-xs h-8"
          min="1"
          max="65535"
        />
      </div>

      {/* Manual override indicator */}
      {isManualMode && (
        <button
          onClick={handleResetToEnvironment}
          className="text-xs text-muted-foreground hover:text-foreground transition underline"
          title="Reset to environment defaults"
        >
          Reset to {activeEnv?.name || 'environment'}
        </button>
      )}

      {/* Target display */}
      <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
        <span className="font-mono">
          {localHost}:{localPort}
        </span>
        {isManualMode && (
          <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">
            Manual
          </span>
        )}
      </div>
    </Card>
  )
}
