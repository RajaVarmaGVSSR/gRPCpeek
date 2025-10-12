import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Service {
  name: string
  methods: Method[]
}

interface Method {
  name: string
  inputType: string
  outputType: string
}

// Check if running in Tauri context
function checkTauriAvailable(): boolean {
  try {
    // In Tauri v2, the window protocol is tauri://
    const isTauriProtocol = window.location.protocol === 'tauri:' || 
                           window.location.hostname === 'tauri.localhost'
    
    // Check multiple ways Tauri might be available
    const hasTauriGlobal = typeof window !== 'undefined' && 
                          typeof (window as any).__TAURI__ !== 'undefined' &&
                          (window as any).__TAURI__ !== null
    
    const hasTauriIpc = typeof window !== 'undefined' &&
                       typeof (window as any).__TAURI_IPC__ !== 'undefined'
    
    return isTauriProtocol || hasTauriGlobal || hasTauriIpc
  } catch {
    return false
  }
}

// No longer need dynamic import wrapper - just use invoke directly
// The import at the top will handle it

function App() {
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [requestData, setRequestData] = useState<string>('')
  const [response, setResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [endpoint, setEndpoint] = useState<string>('http://localhost:50051')
  const [isTauriMode, setIsTauriMode] = useState<boolean>(false)
  const [protoContent, setProtoContent] = useState<string>('')

  // Check Tauri availability on mount
  useEffect(() => {
    const checkMode = () => {
      const available = checkTauriAvailable()
      console.log('=== Tauri Detection Debug ===')
      console.log('Tauri available:', available)
      console.log('window.location.protocol:', window.location.protocol)
      console.log('window.location.hostname:', window.location.hostname)
      console.log('window.location.href:', window.location.href)
      console.log('window.__TAURI__:', (window as any).__TAURI__)
      console.log('window.__TAURI_IPC__:', (window as any).__TAURI_IPC__)
      console.log('============================')
      setIsTauriMode(available)
    }
    
    // Check immediately
    checkMode()
    
    // Also check after delays in case Tauri loads asynchronously
    const timer1 = setTimeout(checkMode, 100)
    const timer2 = setTimeout(checkMode, 500)
    const timer3 = setTimeout(checkMode, 1000)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const content = await file.text()

      // If running inside Tauri, use the backend parser, otherwise use a lightweight
      // browser fallback parser so the dev server can load proto files without Tauri.
      console.log('Tauri available:', isTauriMode)
      console.log('Proto content length:', content.length)
      
      if (isTauriMode) {
        try {
          const parsedServices = await invoke<Service[]>('parse_proto_file', { protoContent: content })
          console.log('Parsed services (Tauri):', parsedServices)
          setServices(parsedServices)
          setProtoContent(content) // Store proto content for gRPC calls
          setSelectedService('')
          setSelectedMethod('')
          setResponse('') // Clear any previous errors
        } catch (error) {
          console.error('Failed to parse proto file via Tauri:', error)
          setResponse(`Error parsing proto file (tauri): ${error}`)
        }
      } else {
        try {
          const parsedServices = parseProtoLocal(content)
          console.log('Parsed services (local):', parsedServices)
          setServices(parsedServices)
          setProtoContent(content) // Store proto content for gRPC calls
          setSelectedService('')
          setSelectedMethod('')
          setResponse(`✓ Parsed ${parsedServices.length} service(s) in browser mode`) // Success message
        } catch (error) {
          console.error('Failed to parse proto file locally:', error)
          setResponse(`Error parsing proto file: ${error}`)
        }
      }
    }
  }

  // Lightweight proto parser used only in the browser for dev (NOT a full proto parser).
  // It extracts service names and rpc method signatures (method name, input, output).
  function parseProtoLocal(protoText: string): Service[] {
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
        const inputType = rpcMatch[3]
        const outputType = rpcMatch[5]
        methods.push({ name: methodName, inputType, outputType })
      }

      services.push({ name: svcName, methods })
    }

    return services
  }

  const handleGrpcCall = async () => {
    if (!selectedService || !selectedMethod) return

    setIsLoading(true)
    try {
      if (isTauriMode) {
        const result = await invoke<string>('call_grpc_method', {
          service: selectedService,
          method: selectedMethod,
          requestData: requestData,
          endpoint: endpoint,
          protoContent: protoContent
        })
        setResponse(result)
      } else {
        // Browser mode: Show a helpful message
        const mockResponse = {
          note: 'Browser mode detected - gRPC calls require the desktop app',
          reason: 'gRPC uses HTTP/2 which requires native support',
          solution: 'Run with: cargo tauri dev (from grpcpeek folder)',
          mock_data: {
            service: selectedService,
            method: selectedMethod,
            endpoint: endpoint,
            request: requestData,
            status: 'Not sent - run in Tauri desktop app for real gRPC calls'
          }
        }
        setResponse(JSON.stringify(mockResponse, null, 2))
      }
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen bg-gray-100 overflow-auto">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">gRPCpeek</h1>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isTauriMode 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isTauriMode ? '🖥️ Desktop Mode' : '🌐 Browser Mode (Proto parsing only)'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Request */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Request</h2>

            {/* Proto File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proto File
              </label>
              <input
                type="file"
                accept=".proto"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* gRPC Endpoint */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                gRPC Endpoint
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:50051"
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Service Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a service</option>
                {services.map((service) => (
                  <option key={service.name} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Method Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a method</option>
                {services
                  .find(s => s.name === selectedService)
                  ?.methods.map((method) => (
                    <option key={method.name} value={method.name}>
                      {method.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Request Data */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Data (JSON)
              </label>
              <textarea
                value={requestData}
                onChange={(e) => setRequestData(e.target.value)}
                placeholder='{"field": "value"}'
                rows={10}
                className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
              />
            </div>

            {/* Call Button */}
            <button
              onClick={handleGrpcCall}
              disabled={isLoading || !selectedService || !selectedMethod}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Calling...' : 'Call gRPC Method'}
            </button>
          </div>

          {/* Right Panel - Response */}
          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Response</h2>
            <div className="bg-gray-50 rounded-md p-4 flex-1 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {response || 'Response will appear here...'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
