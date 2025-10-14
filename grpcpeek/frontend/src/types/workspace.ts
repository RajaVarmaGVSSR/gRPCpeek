export interface Service {
  name: string
  methods: Method[]
}

export type GrpcMethodType = 
  | 'unary' 
  | 'server_streaming' 
  | 'client_streaming' 
  | 'bidirectional_streaming'

export interface Method {
  name: string
  inputType: string
  outputType: string
  isClientStreaming: boolean
  isServerStreaming: boolean
  methodType: GrpcMethodType
}

export interface StreamMessage {
  index: number
  timestamp: string
  data: any
}

export interface StreamingResponse {
  streamId: string
  messages: StreamMessage[]
  status: 'streaming' | 'completed' | 'error'
  error?: string
}

export interface SavedRequest {
  id: string
  name: string
  service: string
  method: string
  payload: string
  metadata: Record<string, string>
  timestamp: number
}

export interface Environment {
  id: string
  name: string
  host: string
  port: number
  metadata: Record<string, string>
  variables: Record<string, string>
}

export interface Workspace {
  id: string
  name: string
  protoImportPaths: string[]
  defaultMetadata: Record<string, string>
  variables: Record<string, string>
  environments: Environment[]
  activeEnvironmentId: string | null
  savedRequests: SavedRequest[]
  requestHistory: SavedRequest[]
  createdAt: number
  updatedAt: number
}

export interface WorkspaceSettings {
  protoImportPaths: string[]
  defaultMetadata: Record<string, string>
  variables: Record<string, string>
}

export interface RequestTab {
  id: string
  name: string
  service: string
  method: string
  methodType: GrpcMethodType
  requestData: string
  response: string
  streamingMessages: any[]
  isStreaming: boolean
  isLoading: boolean
}
