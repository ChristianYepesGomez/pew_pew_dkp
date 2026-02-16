import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

const TOAST_STYLES = {
  success: {
    bg: 'bg-green-900/80 border-green-500/50',
    icon: 'fa-check-circle text-green-400',
  },
  error: {
    bg: 'bg-red-900/80 border-red-500/50',
    icon: 'fa-exclamation-circle text-red-400',
  },
  warning: {
    bg: 'bg-yellow-900/80 border-yellow-500/50',
    icon: 'fa-exclamation-triangle text-yellow-400',
  },
  info: {
    bg: 'bg-blue-900/80 border-blue-500/50',
    icon: 'fa-info-circle text-blue-400',
  },
}

const Toast = ({ toast, onDismiss }) => {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg ${style.bg} animate-slide-in-right min-w-[280px] max-w-md`}
    >
      <i className={`fas ${style.icon} flex-shrink-0`}></i>
      <span className="text-white text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/50 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <i className="fas fa-times text-xs"></i>
      </button>
    </div>
  )
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const idCounter = useRef(0)

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter.current
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, dismissToast }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
