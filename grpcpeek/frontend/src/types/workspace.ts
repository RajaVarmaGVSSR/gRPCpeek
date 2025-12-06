// gRPCpeek v2 Type Definitions
// Clean, modern type system for the Postman-inspired UI revamp
// No backward compatibility - fresh start

// ============================================================================
// Core Building Blocks
// ============================================================================

export type GrpcMethodType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidirectional_streaming'

export interface Variable {
  id: string
  key: string
  value: string
  enabled: boolean
  secret?: boolean  // Hide value in UI (for sensitive data like API keys)
}

export interface ImportPath {
  id: string
  path: string  // Absolute file path or directory path
  type: 'file' | 'directory'
  enabled: boolean
  lastParsed?: string  // ISO timestamp of last successful parse
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'apiKey'
  token?: string  // For bearer
  username?: string  // For basic
  password?: string  // For basic
  key?: string  // For API key header name
  value?: string  // For API key value
  bearerToken?: string  // Deprecated: use 'token'
  basicAuth?: {
    username: string
    password: string
  }  // Deprecated: use username/password directly
}

export interface GrpcStatus {
  code: number  // 0 = OK, non-zero = error
  message: string
  details?: any
}

// ============================================================================
// Environment & Workspace
// ============================================================================

export interface TlsConfig {
  enabled: boolean
  // Client certificate authentication (mTLS)
  clientCertPath?: string  // Path to client certificate file
  clientKeyPath?: string   // Path to client private key file
  // Server certificate validation
  serverCaCertPath?: string  // Path to CA certificate file for server validation
  insecureSkipVerify?: boolean  // Skip server certificate verification (for self-signed certs in dev)
}

export interface Environment {
  id: string
  name: string
  host: string
  port: number
  variables: Variable[]  // Environment-specific variables
  auth: AuthConfig  // Default auth for all requests in this environment
  metadata: Record<string, string>  // Default metadata headers for all requests
  tls: TlsConfig  // TLS/SSL configuration
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  importPaths: ImportPath[]  // Proto file/directory paths for discovery
  globals: Variable[]  // Global variables available across all environments
  environments: Environment[]
  collections: Collection[]
  requestHistory: HistoryEntry[]
  
  // Session state (persisted across app restarts)
  services?: Service[]  // Parsed services from proto files
  openTabs?: RequestTab[]  // Currently open request tabs
  activeTabId?: string | null  // Which tab is currently active
  
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Collections & Saved Requests (Nested Folders)
// ============================================================================

export interface Collection {
  id: string
  name: string
  description?: string
  folders: Folder[]  // Top-level folders
  requests: SavedRequest[]  // Top-level requests (not in folders)
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: string
  name: string
  description?: string
  folders: Folder[]  // Nested folders (unlimited depth)
  requests: SavedRequest[]  // Requests in this folder
  collapsed?: boolean  // UI state for tree view
}

export interface SavedRequest {
  id: string
  name: string
  description?: string
  service: string
  method: string
  methodType: GrpcMethodType
  requestBody: string  // JSON string
  metadata: Record<string, string>
  auth: AuthConfig  // Can override environment auth
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Request Tabs (Active Requests in Editor)
// ============================================================================

export interface RequestTab {
  id: string
  name: string  // Display name: "ServiceName.MethodName"
  service: string
  method: string
  methodType: GrpcMethodType
  
  // Request configuration
  requestBody: string  // JSON (for unary/server_streaming)
  clientStreamingMessages?: ClientStreamMessage[]  // For client_streaming/bidirectional_streaming
  metadata: Record<string, string>  // gRPC metadata headers
  disableEnvironmentMetadata?: boolean  // Don't inherit metadata from environment
  auth: AuthConfig  // Can override environment auth
  tls?: TlsConfig  // Can override environment TLS config
  
  // Environment and endpoint configuration (tab-level)
  selectedEnvironmentId?: string | null  // Which environment this tab uses
  requestHost?: string  // Override environment host
  requestPort?: number  // Override environment port
  
  // Response data
  response: string
  responseMetadata: Record<string, string>  // gRPC metadata/trailers
  streamingMessages: StreamMessage[]
  status: GrpcStatus | null
  duration: number | null  // ms
  responseSize: number | null  // bytes
  
  // UI state
  isStreaming: boolean
  isLoading: boolean
  isDirty: boolean  // Has unsaved changes
  savedRequestId?: string  // If saved to a collection, reference to SavedRequest
  streamConnectionOpen?: boolean  // For client streaming - is the stream connection open?
  
  createdAt: string
}

export interface ClientStreamMessage {
  id: string
  body: string  // JSON
  sent: boolean
  timestamp?: string  // When it was sent
}

export interface StreamMessage {
  id: string
  timestamp: string  // ISO string
  data: any  // Parsed JSON
  index: number  // Message number in stream
  size?: number  // bytes
}

// ============================================================================
// History
// ============================================================================

export interface HistoryEntry {
  id: string
  timestamp: string  // ISO string
  service: string
  method: string
  methodType: GrpcMethodType
  endpoint: string  // "host:port"
  requestBody: string
  metadata: Record<string, string>
  status: GrpcStatus
  duration: number  // ms
  responseSize: number  // bytes
  messageCount?: number  // For streaming responses
  environmentId: string | null  // Which environment was active
}

// ============================================================================
// Proto Discovery (Scratchpad - Auto-discovered Services)
// ============================================================================

export interface Service {
  name: string
  packageName?: string
  methods: Method[]
  sourceProto?: string  // Which proto file this came from
  documentation?: string  // Extracted from proto comments
}

export interface Method {
  name: string
  inputType: string
  outputType: string
  isClientStreaming: boolean
  isServerStreaming: boolean
  methodType: GrpcMethodType
  documentation?: string  // Extracted from proto comments
  sampleRequest?: string  // Pre-computed sample JSON (generated during parsing)
}

// ============================================================================
// Variable Resolution ({{env.key}} and {{global.key}})
// ============================================================================

export interface VariableResolutionResult {
  resolved: string  // The string with variables replaced
  unresolvedVars: UnresolvedVariable[]  // Variables that couldn't be resolved
}

export interface UnresolvedVariable {
  placeholder: string  // e.g., "{{env.API_KEY}}"
  key: string  // e.g., "API_KEY"
  namespace: 'env' | 'global'
}

export interface VariableContext {
  environmentVariables: Variable[]
  globalVariables: Variable[]
}

// ============================================================================
// Proto Parsing (Backend)
// ============================================================================

export interface ProtoParseResult {
  success: boolean
  services: Service[]
  errors: ProtoParseError[]
  warnings: string[]
}

export interface ProtoParseError {
  file: string
  message: string
  suggestion?: string  // Helpful hint for fixing
}

export interface ProtoFile {
  path: string
  fileName: string
  package?: string
  imports: string[]  // Other proto files this one imports
  services: Service[]
  messages: string[]  // Message type names
}

export interface ProtoDependencyGraph {
  files: Map<string, ProtoFile>
  dependencies: Map<string, Set<string>>  // file -> files it depends on
  unresolvedImports: Array<{ file: string; import: string }>
}

// ============================================================================
// UI State Types
// ============================================================================

export type SidebarTab = 'collections' | 'environments' | 'scratchpad' | 'history'
export type RequestPanelTab = 'params' | 'authorization' | 'metadata' | 'body'
export type ResponsePanelTab = 'body' | 'metadata' | 'stream' | 'tests'

export interface UIState {
  sidebarTab: SidebarTab
  sidebarWidth: number
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'auto'
}

// ============================================================================
// Helper Types for UI Components
// ============================================================================

// For tree view rendering (collections, scratchpad)
export interface TreeNode<T> {
  id: string
  data: T
  children: TreeNode<T>[]
  parent?: TreeNode<T>
  expanded: boolean
  level: number  // Depth in tree (0 = root)
}

// For drag-and-drop in collections
export interface DragDropItem {
  id: string
  type: 'folder' | 'request'
  parentId: string | null
  collectionId: string
}

// For search/filter
export interface SearchResult {
  type: 'request' | 'folder' | 'service' | 'method'
  id: string
  name: string
  path: string[]  // Breadcrumb path
  matchScore: number
}
