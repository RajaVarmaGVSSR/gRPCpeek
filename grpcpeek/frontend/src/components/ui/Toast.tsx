import { useEffect, useState } from 'react'
import { useToast, type Toast as ToastType } from '../../contexts/ToastContext'

interface ToastProps {
  toast: ToastType
}

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const colors = {
  success: 'bg-green-500/90 border-green-600/50 text-white',
  error: 'bg-red-500/90 border-red-600/50 text-white',
  warning: 'bg-yellow-500/90 border-yellow-600/50 text-white',
  info: 'bg-blue-500/90 border-blue-600/50 text-white',
}

function Toast({ toast }: ToastProps) {
  const { dismissToast } = useToast()
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      dismissToast(toast.id)
    }, 300)
  }

  useEffect(() => {
    // Auto-dismiss animation
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, toast.duration - 300)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-in-out
        ${colors[toast.type]}
        ${
          isExiting
            ? 'translate-x-full opacity-0'
            : 'translate-x-0 opacity-100'
        }
      `}
      role="alert"
    >
      <span className="text-xl font-bold">{icons[toast.type]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="rounded p-1 transition-colors hover:bg-white/20"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  )
}
