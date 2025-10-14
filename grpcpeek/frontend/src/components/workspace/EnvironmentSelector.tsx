import type { Environment } from '../../types/workspace'
import { Select } from '../ui'

interface EnvironmentSelectorProps {
  environments: Environment[]
  activeEnvironmentId: string | null
  onEnvironmentChange: (envId: string) => void
}

export function EnvironmentSelector({
  environments,
  activeEnvironmentId,
  onEnvironmentChange,
}: EnvironmentSelectorProps) {
  if (environments.length === 0) {
    return null
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
    </div>
  )
}
