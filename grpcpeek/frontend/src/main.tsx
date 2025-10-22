import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ModalProvider } from './contexts/ModalContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { ModalRenderer } from './components/ModalRenderer'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ModalProvider>
      <ToastProvider>
        <App />
        <ToastContainer />
        <ModalRenderer />
      </ToastProvider>
    </ModalProvider>
  </React.StrictMode>,
)
