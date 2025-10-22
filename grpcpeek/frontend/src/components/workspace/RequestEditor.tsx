import { useState } from 'react'
import { Card, Label, Textarea, Button, Input, Select } from '../ui'
import type { RequestTab, AuthConfig, TlsConfig, Workspace, VariableContext, Service } from '../../types/workspace'
import { VariableIndicator } from './VariableIndicator'
import { open } from '@tauri-apps/plugin-dialog'

interface RequestEditorProps {
  tab: RequestTab
  onUpdate: (updates: Partial<RequestTab>) => void
  onGenerateSample: () => void
  isGenerating: boolean
  canGenerateSample: boolean
  workspace: Workspace
  onSendRequest: () => void
  onSaveRequest: () => void
  services: Service[]
}

export function RequestEditor({
  tab,
  onUpdate,
  onGenerateSample,
  isGenerating,
  canGenerateSample,
  workspace,
  onSendRequest,
  onSaveRequest,
  services,
}: RequestEditorProps) {
  const [activeSection, setActiveSection] = useState<'body' | 'metadata' | 'auth' | 'tls'>('body')
  
  // Get available methods for the selected service
  const selectedService = services.find(s => s.name === tab.service)
  const availableMethods = selectedService?.methods || []

  // Build variable context from tab's selected environment
  const selectedEnv = workspace.environments.find(env => env.id === tab.selectedEnvironmentId)
  const variableContext: VariableContext = {
    environmentVariables: selectedEnv?.variables || [],
    globalVariables: workspace.globals || [],
  }

  const handleBodyChange = (value: string) => {
    onUpdate({ requestBody: value, isDirty: true })
  }

  const handleMetadataChange = (key: string, value: string) => {
    const newMetadata = { ...tab.metadata }
    if (value) {
      newMetadata[key] = value
    } else {
      delete newMetadata[key]
    }
    onUpdate({ metadata: newMetadata, isDirty: true })
  }

  const addMetadataEntry = () => {
    const newKey = `key-${Date.now()}`
    handleMetadataChange(newKey, '')
  }

  const removeMetadataEntry = (key: string) => {
    const newMetadata = { ...tab.metadata }
    delete newMetadata[key]
    onUpdate({ metadata: newMetadata, isDirty: true })
  }

  const handleAuthChange = (updates: Partial<AuthConfig>) => {
    onUpdate({
      auth: { ...tab.auth, ...updates },
      isDirty: true,
    })
  }

  const handleTlsChange = (updates: Partial<TlsConfig>) => {
    onUpdate({
      tls: { ...(tab.tls || { enabled: false }), ...updates },
      isDirty: true,
    })
  }

  const handleServiceChange = (serviceName: string) => {
    const newService = services.find(s => s.name === serviceName)
    if (!newService) return

    // When service changes, reset to first method and update tab name
    const firstMethod = newService.methods[0]
    if (firstMethod) {
      onUpdate({
        service: serviceName,
        method: firstMethod.name,
        methodType: firstMethod.methodType,
        name: `${serviceName}.${firstMethod.name}`,
        requestBody: firstMethod.sampleRequest || '',
        isDirty: true,
      })
    }
  }

  const handleMethodChange = (methodName: string) => {
    const method = availableMethods.find(m => m.name === methodName)
    if (!method) return

    onUpdate({
      method: methodName,
      methodType: method.methodType,
      name: `${tab.service}.${methodName}`,
      requestBody: method.sampleRequest || '',
      isDirty: true,
    })
  }

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(tab.requestBody)
      const formatted = JSON.stringify(parsed, null, 2)
      onUpdate({ requestBody: formatted, isDirty: true })
    } catch (error) {
      // Invalid JSON, don't format
      console.error('Invalid JSON:', error)
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-6">
      {/* Sticky Header with Action Buttons */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-4 rounded-t-xl border-b border-border/50 bg-surface px-6 py-4">
        {/* Service and Method Selection */}
        <div className="mb-4 flex items-center gap-4 rounded-lg border border-border/40 bg-surface-muted/30 p-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Service:
            </Label>
            <Select
              value={tab.service}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="flex-1 text-xs h-8 bg-surface"
              disabled={services.length === 0}
            >
              {services.length === 0 ? (
                <option value="">No services available</option>
              ) : (
                services.map(service => (
                  <option key={service.name} value={service.name}>
                    {service.name}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Method:
            </Label>
            <Select
              value={tab.method}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="flex-1 text-xs h-8 bg-surface"
              disabled={availableMethods.length === 0}
            >
              {availableMethods.length === 0 ? (
                <option value="">No methods available</option>
              ) : (
                availableMethods.map(method => (
                  <option key={method.name} value={method.name}>
                    {method.name}
                    <span className="text-muted-foreground"> • {method.methodType}</span>
                  </option>
                ))
              )}
            </Select>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerateSample}
            disabled={isGenerating || !canGenerateSample}
            title={!canGenerateSample ? 'Run in Tauri mode to reset to sample' : 'Reset request body to sample'}
          >
            {isGenerating ? 'Resetting...' : '🔄 Reset to Sample'}
          </Button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onSendRequest}
            disabled={tab.isLoading}
            className="flex-1"
          >
            {tab.isLoading ? '⏳ Calling...' : '🚀 Send Request'}
          </Button>
          <Button
            variant="secondary"
            onClick={onSaveRequest}
            title="Save request"
            className="px-4"
          >
            💾 Save
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1">
        <button
          onClick={() => setActiveSection('body')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeSection === 'body'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveSection('metadata')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeSection === 'metadata'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Metadata {Object.keys(tab.metadata).length > 0 && `(${Object.keys(tab.metadata).length})`}
        </button>
        <button
          onClick={() => setActiveSection('auth')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeSection === 'auth'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Auth
        </button>
        <button
          onClick={() => setActiveSection('tls')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeSection === 'tls'
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          TLS {tab.tls?.enabled && '🔒'}
        </button>
      </div>

      {/* Section content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSection === 'body' && (
          <>
            <div className="flex-shrink-0 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="request-body">Request Body (JSON)</Label>
                <VariableIndicator text={tab.requestBody} context={variableContext} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={formatJSON}
                className="h-6 px-2 text-xs"
              >
                Format JSON
              </Button>
            </div>
            <Textarea
              id="request-body"
              value={tab.requestBody}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder='{"field": "value"}'
              className="flex-1 resize-none font-mono text-xs mb-2"
            />
            {tab.requestBody && (
              <p className="flex-shrink-0 text-xs text-muted-foreground">
                💡 Use <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{env.varName}}'}</code> or <code className="px-1 py-0.5 rounded bg-surface-muted font-mono">{'{{global.varName}}'}</code> for dynamic values
              </p>
            )}
          </>
        )}

        {activeSection === 'metadata' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>gRPC Metadata Headers</Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={addMetadataEntry}
                className="h-6 px-2 text-xs"
              >
                + Add Header
              </Button>
            </div>

            {Object.entries(tab.metadata).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No metadata headers yet. Click "Add Header" to add one.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(tab.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const oldValue = tab.metadata[key]
                        removeMetadataEntry(key)
                        handleMetadataChange(e.target.value, oldValue)
                      }}
                      placeholder="Header name"
                      className="flex-1 text-xs"
                    />
                    <Input
                      value={value}
                      onChange={(e) => handleMetadataChange(key, e.target.value)}
                      placeholder="Header value"
                      className="flex-1 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetadataEntry(key)}
                      className="h-9 w-9 p-0"
                      title="Remove header"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'auth' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="auth-type">Authentication Type</Label>
              <select
                id="auth-type"
                value={tab.auth.type}
                onChange={(e) => handleAuthChange({ type: e.target.value as AuthConfig['type'] })}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apiKey">API Key</option>
              </select>
            </div>

            {tab.auth.type === 'bearer' && (
              <div>
                <Label htmlFor="bearer-token">Bearer Token</Label>
                <Input
                  id="bearer-token"
                  type="password"
                  value={tab.auth.token || ''}
                  onChange={(e) => handleAuthChange({ token: e.target.value })}
                  placeholder="Enter bearer token"
                  className="mt-1"
                />
              </div>
            )}

            {tab.auth.type === 'basic' && (
              <>
                <div>
                  <Label htmlFor="basic-username">Username</Label>
                  <Input
                    id="basic-username"
                    value={tab.auth.username || ''}
                    onChange={(e) => handleAuthChange({ username: e.target.value })}
                    placeholder="Enter username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="basic-password">Password</Label>
                  <Input
                    id="basic-password"
                    type="password"
                    value={tab.auth.password || ''}
                    onChange={(e) => handleAuthChange({ password: e.target.value })}
                    placeholder="Enter password"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {tab.auth.type === 'apiKey' && (
              <>
                <div>
                  <Label htmlFor="apikey-key">Key Name</Label>
                  <Input
                    id="apikey-key"
                    value={tab.auth.key || ''}
                    onChange={(e) => handleAuthChange({ key: e.target.value })}
                    placeholder="e.g., X-API-Key"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="apikey-value">Key Value</Label>
                  <Input
                    id="apikey-value"
                    type="password"
                    value={tab.auth.value || ''}
                    onChange={(e) => handleAuthChange({ value: e.target.value })}
                    placeholder="Enter API key"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {tab.auth.type === 'none' && (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No authentication configured. Select an auth type above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TLS/SSL Configuration Section */}
        {activeSection === 'tls' && (
          <div className="space-y-4 overflow-auto">
            <div className="flex items-center gap-3">
              <input
                id="tls-enabled"
                type="checkbox"
                checked={tab.tls?.enabled || false}
                onChange={(e) => handleTlsChange({ enabled: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
              />
              <Label htmlFor="tls-enabled" className="text-base font-semibold">
                Enable TLS/SSL {tab.tls?.enabled && '🔒'}
              </Label>
            </div>

            <p className="text-sm text-muted-foreground">
              Enable TLS/SSL for secure gRPC connections. When disabled, connections are unencrypted (insecure).
            </p>

            {tab.tls?.enabled && (
              <>
                <div className="space-y-4 rounded-lg border border-border/40 bg-surface-muted/30 p-4">
                  <h4 className="text-sm font-medium text-foreground">Client Certificate (mTLS)</h4>
                  <p className="text-xs text-muted-foreground">
                    Optional: Required for mutual TLS authentication where the server validates the client.
                  </p>
                  
                  <div>
                    <Label htmlFor="client-cert-path">Client Certificate File</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="client-cert-path"
                        value={tab.tls?.clientCertPath || ''}
                        onChange={(e) => handleTlsChange({ clientCertPath: e.target.value })}
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
                            if (selected) handleTlsChange({ clientCertPath: selected })
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
                    <Label htmlFor="client-key-path">Client Private Key File</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="client-key-path"
                        value={tab.tls?.clientKeyPath || ''}
                        onChange={(e) => handleTlsChange({ clientKeyPath: e.target.value })}
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
                            if (selected) handleTlsChange({ clientKeyPath: selected })
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
                    <Label htmlFor="server-ca-path">CA Certificate File (Optional)</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="server-ca-path"
                        value={tab.tls?.serverCaCertPath || ''}
                        onChange={(e) => handleTlsChange({ serverCaCertPath: e.target.value })}
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
                            if (selected) handleTlsChange({ serverCaCertPath: selected })
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
                      id="insecure-skip-verify"
                      type="checkbox"
                      checked={tab.tls?.insecureSkipVerify || false}
                      onChange={(e) => handleTlsChange({ insecureSkipVerify: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-yellow-600 focus:ring-2 focus:ring-yellow-600/20"
                    />
                    <div className="flex-1">
                      <Label htmlFor="insecure-skip-verify" className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
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

            {!tab.tls?.enabled && (
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  ⚠️ TLS/SSL is disabled. Connections will be unencrypted and insecure.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enable TLS above to use encrypted connections.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
