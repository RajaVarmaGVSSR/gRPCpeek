import { useState } from 'react'
import { Button, Input, Label, Card } from '../ui'

interface CreateEnvironmentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, host: string, port: number) => void
}

export function CreateEnvironmentModal({
  isOpen,
  onClose,
  onCreate,
}: CreateEnvironmentModalProps) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('50051')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim(), host.trim(), parseInt(port, 10))
      // Reset form
      setName('')
      setHost('localhost')
      setPort('50051')
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <Card
        className="w-full max-w-md scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-border/50 p-6">
            <h2 className="text-xl font-semibold text-foreground">
              Create New Environment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure a new environment for your gRPC services
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="env-name">Environment Name *</Label>
              <Input
                id="env-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production, Staging, Development..."
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name for this environment
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="env-host">Host</Label>
              <Input
                id="env-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost or api.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="env-port">Port</Label>
              <Input
                id="env-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="50051"
                min="1"
                max="65535"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-surface-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                💡 <strong>Tip:</strong> You can configure variables, authentication, and metadata after creating the environment.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border/50 p-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Environment
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
