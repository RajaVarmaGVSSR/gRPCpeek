/**
 * EnvironmentEditorModal - Comprehensive environment configuration
 * 
 * Features:
 * - Edit environment name, host, port
 * - Manage environment variables (add, edit, delete, toggle)
 * - Configure authentication (None, Bearer, Basic, API Key)
 * - Manage metadata key-value pairs
 * - Add/remove environments
 */

import { useState } from 'react'
import { Button, Input, Label, Card } from '../ui'
import type { Environment, Variable, AuthConfig, TlsConfig } from '../../types/workspace'
import { open } from '@tauri-apps/plugin-dialog'

interface EnvironmentEditorModalProps {
  environment?: Environment  // Optional for create mode
  mode: 'create' | 'edit'
  onSave: (updates: Partial<Environment>) => void
  onDelete?: () => void  // Optional, only for edit mode
  onClose: () => void
}

export function EnvironmentEditorModal({
  environment,
  mode,
  onSave,
  onDelete,
  onClose,
}: EnvironmentEditorModalProps) {
  const [name, setName] = useState(environment?.name || '')
  const [host, setHost] = useState(environment?.host || 'localhost')
  const [port, setPort] = useState(environment?.port.toString() || '50051')
  const [variables, setVariables] = useState<Variable[]>(
    Array.isArray(environment?.variables)
      ? environment.variables.map((variable) => ({ ...variable }))
      : []
  )
  const [auth, setAuth] = useState<AuthConfig>(environment?.auth ? { ...environment.auth } : { type: 'none' })
  const [metadata, setMetadata] = useState<Record<string, string>>({
    ...(environment?.metadata || {}),
  })
  const [tls, setTls] = useState<TlsConfig>(environment?.tls ? { ...environment.tls } : { enabled: false })
  const [activeTab, setActiveTab] = useState<'general' | 'variables' | 'auth' | 'metadata' | 'tls'>('general')

  // Variable management
  const addVariable = () => {
    const newVar: Variable = {
      id: `var-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
      secret: false,
    }
    setVariables([...variables, newVar])
  }

  const updateVariable = (id: string, updates: Partial<Variable>) => {
    setVariables(variables.map(v => v.id === id ? { ...v, ...updates } : v))
  }

  const deleteVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id))
  }

  // Metadata management
  const addMetadata = () => {
    let counter = Object.keys(metadata).length + 1
    let key = `header-${counter}`
    while (metadata[key]) {
      counter += 1
      key = `header-${counter}`
    }
    setMetadata({ ...metadata, [key]: '' })
  }

  const updateMetadataKey = (oldKey: string, newKey: string) => {
    const newMetadata = { ...metadata }
    newMetadata[newKey] = newMetadata[oldKey]
    delete newMetadata[oldKey]
    setMetadata(newMetadata)
  }

  const updateMetadataValue = (key: string, value: string) => {
    setMetadata({ ...metadata, [key]: value })
  }

  const deleteMetadata = (key: string) => {
    const newMetadata = { ...metadata }
    delete newMetadata[key]
    setMetadata(newMetadata)
  }

  const handleSave = () => {
    const parsedPort = parseInt(port, 10)
    const safePort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : (environment?.port || 50051)

    const sanitizedVariables = variables
      .filter((variable) => variable.key.trim().length > 0)
      .map((variable) => ({
        ...variable,
        key: variable.key.trim(),
      }))

    const metadataEntries = Object.entries(metadata)
    const sanitizedMetadata = metadataEntries.reduce<Record<string, string>>((acc, [key, value]) => {
      const trimmedKey = key.trim()
      if (!trimmedKey) {
        return acc
      }

      if (!Object.prototype.hasOwnProperty.call(acc, trimmedKey)) {
        acc[trimmedKey] = value
      }
      return acc
    }, {})

    const updates = {
      name: name.trim() || (environment?.name || 'New Environment'),
      host: host.trim() || 'localhost',
      port: safePort,
      variables: sanitizedVariables,
      auth: { ...auth },
      metadata: sanitizedMetadata,
      tls: { ...tls },
    }

    console.log('EnvironmentEditorModal - Saving updates:', updates)
    onSave(updates)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 p-6">
          <div>
            <h2 className="text-xl font-semibold">{mode === 'create' ? 'Create Environment' : 'Edit Environment'}</h2>
            <p className="text-sm text-muted-foreground">Configure environment settings and variables</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/50 px-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('variables')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'variables'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Variables ({variables.length})
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'auth'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Authorization
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'metadata'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Metadata ({Object.keys(metadata).length})
          </button>
          <button
            onClick={() => setActiveTab('tls')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'tls'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            TLS/SSL {tls.enabled && '🔒'}
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
            {/* Basic Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic Settings</h3>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="env-name">Environment Name</Label>
                  <Input
                    id="env-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Development"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="env-host">Host</Label>
                  <Input
                    id="env-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
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
                  />
                </div>
              </div>
            </section>
            </div>
          )}

          {/* Variables Tab */}
          {activeTab === 'variables' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Environment Variables</h3>
                <Button size="sm" onClick={addVariable}>
                  + Add Variable
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Define variables that can be referenced in requests using <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{env.varName}}'}</code>
              </p>

              {variables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">No variables yet. Click "Add Variable" to create one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {variables.map((variable) => (
                    <div key={variable?.id || Math.random()} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface p-3">
                      <input
                        type="checkbox"
                        checked={variable?.enabled ?? true}
                        onChange={(e) => updateVariable(variable.id, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-border text-focus"
                        title="Enable/disable variable"
                      />
                      
                      <Input
                        value={variable?.key || ''}
                        onChange={(e) => updateVariable(variable.id, { key: e.target.value })}
                        placeholder="KEY"
                        className="flex-1"
                      />
                      
                      <Input
                        type={variable?.secret ? 'password' : 'text'}
                        value={variable?.value || ''}
                        onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1"
                      />
                      
                      <button
                        onClick={() => updateVariable(variable.id, { secret: !variable?.secret })}
                        className="rounded p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                        title={variable?.secret ? 'Show value' : 'Hide value'}
                      >
                        {variable?.secret ? '👁️' : '🔒'}
                      </button>
                      
                      <button
                        onClick={() => deleteVariable(variable.id)}
                        className="rounded p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Delete variable"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Auth Tab */}
          {activeTab === 'auth' && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Authorization</h3>
              
              <p className="text-sm text-muted-foreground">
                Configure default authentication for all requests in this environment. Can be overridden per-request.
              </p>

              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['none', 'bearer', 'basic', 'apiKey'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        if (auth?.type === type) {
                          return
                        }

                        const nextAuth: AuthConfig =
                          type === 'none'
                            ? { type }
                            : type === 'bearer'
                              ? { type, token: '' }
                              : type === 'basic'
                                ? { type, username: '', password: '' }
                                : { type, key: '', value: '' }
                        setAuth(nextAuth)
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        auth?.type === type
                          ? 'bg-surface-emphasis text-surface-contrast'
                          : 'bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      }`}
                    >
                      {type === 'none' ? 'None' : type === 'bearer' ? 'Bearer Token' : type === 'basic' ? 'Basic Auth' : 'API Key'}
                    </button>
                  ))}
                </div>

                {auth?.type === 'bearer' && (
                  <div className="space-y-2">
                    <Label htmlFor="bearer-token">Bearer Token</Label>
                    <Input
                      id="bearer-token"
                      type="password"
                      value={auth.token || ''}
                      onChange={(e) => setAuth({ ...auth, token: e.target.value })}
                      placeholder="Enter token"
                    />
                  </div>
                )}

                {auth?.type === 'basic' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="basic-username">Username</Label>
                      <Input
                        id="basic-username"
                        value={auth.username || ''}
                        onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                        placeholder="Username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="basic-password">Password</Label>
                      <Input
                        id="basic-password"
                        type="password"
                        value={auth.password || ''}
                        onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                        placeholder="Password"
                      />
                    </div>
                  </div>
                )}

                {auth?.type === 'apiKey' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="apikey-key">Key</Label>
                      <Input
                        id="apikey-key"
                        value={auth.key || ''}
                        onChange={(e) => setAuth({ ...auth, key: e.target.value })}
                        placeholder="X-API-Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apikey-value">Value</Label>
                      <Input
                        id="apikey-value"
                        type="password"
                        value={auth.value || ''}
                        onChange={(e) => setAuth({ ...auth, value: e.target.value })}
                        placeholder="API key value"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Default Metadata</h3>
                <Button size="sm" onClick={addMetadata}>
                  + Add Metadata
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Define default gRPC metadata headers that will be included in all requests for this environment.
              </p>

              {Object.keys(metadata).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">No metadata. Click "Add Metadata" to create key-value pairs.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface p-3">
                      <Input
                        value={key}
                        onChange={(e) => updateMetadataKey(key, e.target.value)}
                        placeholder="key"
                        className="flex-1"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateMetadataValue(key, e.target.value)}
                        placeholder="value"
                        className="flex-1"
                      />
                      <button
                        onClick={() => deleteMetadata(key)}
                        className="rounded p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Delete metadata"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TLS/SSL Tab */}
          {activeTab === 'tls' && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  id="env-tls-enabled"
                  type="checkbox"
                  checked={tls.enabled}
                  onChange={(e) => setTls({ ...tls, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                />
                <Label htmlFor="env-tls-enabled" className="text-base font-semibold">
                  Enable TLS/SSL for this environment {tls.enabled && '🔒'}
                </Label>
              </div>

              <p className="text-sm text-muted-foreground">
                Configure TLS/SSL settings for secure gRPC connections. When disabled, connections will be unencrypted (insecure). These settings will be used by default for all requests in this environment.
              </p>

              {tls.enabled && (
                <>
                  <div className="space-y-4 rounded-lg border border-border/40 bg-surface-muted/30 p-4">
                    <h4 className="text-sm font-medium text-foreground">Client Certificate (mTLS)</h4>
                    <p className="text-xs text-muted-foreground">
                      Optional: Required for mutual TLS authentication where the server validates the client.
                    </p>
                    
                    <div>
                      <Label htmlFor="env-client-cert-path">Client Certificate File</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          id="env-client-cert-path"
                          value={tls.clientCertPath || ''}
                          onChange={(e) => setTls({ ...tls, clientCertPath: e.target.value })}
                          placeholder="/path/to/client-cert.pem"
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            try {
                              const selected = await open({
                                multiple: false,
                                filters: [{ name: 'Certificate', extensions: ['pem', 'crt', 'cer'] }]
                              })
                              if (selected) setTls({ ...tls, clientCertPath: selected })
                            } catch (error) {
                              console.error('Failed to open file picker:', error)
                            }
                          }}
                          title="Browse for certificate file"
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="env-client-key-path">Client Private Key File</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          id="env-client-key-path"
                          value={tls.clientKeyPath || ''}
                          onChange={(e) => setTls({ ...tls, clientKeyPath: e.target.value })}
                          placeholder="/path/to/client-key.pem"
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            try {
                              const selected = await open({
                                multiple: false,
                                filters: [{ name: 'Private Key', extensions: ['pem', 'key'] }]
                              })
                              if (selected) setTls({ ...tls, clientKeyPath: selected })
                            } catch (error) {
                              console.error('Failed to open file picker:', error)
                            }
                          }}
                          title="Browse for key file"
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border border-border/40 bg-surface-muted/30 p-4">
                    <h4 className="text-sm font-medium text-foreground">Server Certificate Validation</h4>
                    
                    <div>
                      <Label htmlFor="env-server-ca-path">CA Certificate File (Optional)</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          id="env-server-ca-path"
                          value={tls.serverCaCertPath || ''}
                          onChange={(e) => setTls({ ...tls, serverCaCertPath: e.target.value })}
                          placeholder="/path/to/ca-cert.pem"
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            try {
                              const selected = await open({
                                multiple: false,
                                filters: [{ name: 'CA Certificate', extensions: ['pem', 'crt', 'cer'] }]
                              })
                              if (selected) setTls({ ...tls, serverCaCertPath: selected })
                            } catch (error) {
                              console.error('Failed to open file picker:', error)
                            }
                          }}
                          title="Browse for CA certificate file"
                        >
                          Browse
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Custom CA certificate to verify the server's certificate. Leave empty to use system CAs.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                      <input
                        id="env-insecure-skip-verify"
                        type="checkbox"
                        checked={tls.insecureSkipVerify || false}
                        onChange={(e) => setTls({ ...tls, insecureSkipVerify: e.target.checked })}
                        className="h-4 w-4 rounded border-border text-yellow-600 focus:ring-2 focus:ring-yellow-600/20"
                      />
                      <div className="flex-1">
                        <Label htmlFor="env-insecure-skip-verify" className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                          Skip Server Certificate Verification
                        </Label>
                        <p className="mt-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                          ⚠️ Only use for self-signed certificates in development. Disables certificate validation!
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!tls.enabled && (
                <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    ⚠️ TLS/SSL is disabled for this environment. Connections will be unencrypted and insecure.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enable TLS above to use encrypted connections.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer - Actions */}
        <div className="flex items-center justify-between border-t border-border/50 p-6">
          {mode === 'edit' && onDelete && (
            <Button variant="ghost" onClick={onDelete} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete Environment
            </Button>
          )}
          {mode === 'create' && <div />}
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {mode === 'create' ? 'Create Environment' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
