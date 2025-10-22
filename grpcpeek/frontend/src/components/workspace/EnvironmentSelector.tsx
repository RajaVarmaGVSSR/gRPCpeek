import type { Environment } from '../../types/workspace'
import { Select } from '../ui'

interface EnvironmentSelectorProps {
  environments: Environment[]
  activeEnvironmentId: string | null
  onEnvironmentChange: (envId: string) => void
  onManageEnvironments?: () => void
}

export function EnvironmentSelector({
  environments,
  activeEnvironmentId,
  onEnvironmentChange,
  onManageEnvironments,
}: EnvironmentSelectorProps) {
  if (environments.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Environment:</span>
        <button
          onClick={onManageEnvironments}
          className="h-8 rounded bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
          disabled={!onManageEnvironments}
        >
          Set up environments
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Environment:</span>
      <Select
        value={activeEnvironmentId || ''}
        onChange={(e) => onEnvironmentChange(e.target.value)}
        className="h-8 w-auto text-xs"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </Select>
      {onManageEnvironments && (
        <button
          onClick={onManageEnvironments}
          className="rounded p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          title="Manage environments"
          disabled={!onManageEnvironments}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  )
}
