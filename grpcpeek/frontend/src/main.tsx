import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ModalProvider } from './contexts/ModalContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { ModalRenderer } from './components/ModalRenderer'

// ============================================================================
// Tauri App Security & Native Feel Enhancements
// ============================================================================

// Disable browser context menu (right-click) for a native app feel
// This prevents "Save As", "Print", "Inspect" etc. from appearing
document.addEventListener('contextmenu', (e) => {
  e.preventDefault()
})

// Disable drag and drop of files into the app (security best practice)
// This prevents accidentally loading external content
document.addEventListener('dragover', (e) => {
  e.preventDefault()
})
document.addEventListener('drop', (e) => {
  e.preventDefault()
})

// Block browser-specific keyboard shortcuts in production
// (keeps our app shortcuts working but prevents browser actions)
document.addEventListener('keydown', (e) => {
  // Block Ctrl+P (Print)
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault()
  }
  // Block F7 (Caret browsing)
  if (e.key === 'F7') {
    e.preventDefault()
  }
})

// ============================================================================

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ModalProvider>
    <ToastProvider>
      <App />
      <ToastContainer />
      <ModalRenderer />
    </ToastProvider>
  </ModalProvider>,
)
