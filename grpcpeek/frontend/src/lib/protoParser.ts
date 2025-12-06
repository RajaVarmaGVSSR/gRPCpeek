import type { Service, Method } from '../types/workspace'

/**
 * Lightweight proto parser used only in the browser for dev (NOT a full proto parser).
 * It extracts service names and rpc method signatures (method name, input, output).
 * 
 * For production use, use the Tauri backend parser which provides full proto3 support.
 */
export function parseProtoLocal(protoText: string): Service[] {
  const services: Service[] = []
  const serviceRegex = /service\s+(\w+)\s*{([\s\S]*?)}/g
  const rpcRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)/g

  let svcMatch: RegExpExecArray | null
  while ((svcMatch = serviceRegex.exec(protoText)) !== null) {
    const svcName = svcMatch[1]
    const svcBody = svcMatch[2]
    const methods: Method[] = []

    let rpcMatch: RegExpExecArray | null
    while ((rpcMatch = rpcRegex.exec(svcBody)) !== null) {
      const methodName = rpcMatch[1]
      const isClientStreaming = !!rpcMatch[2]
      const inputType = rpcMatch[3]
      const isServerStreaming = !!rpcMatch[4]
      const outputType = rpcMatch[5]
      
      const methodType = 
        !isClientStreaming && !isServerStreaming ? 'unary' :
        !isClientStreaming && isServerStreaming ? 'server_streaming' :
        isClientStreaming && !isServerStreaming ? 'client_streaming' :
        'bidirectional_streaming'
      
      methods.push({ 
        name: methodName, 
        inputType, 
        outputType,
        isClientStreaming,
        isServerStreaming,
        methodType
      })
    }

    services.push({ name: svcName, methods })
  }

  return services
}
