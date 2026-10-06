'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'

export type ToastVariant = 'success' | 'error'

type ToastState = {
  id: number
  message: string
  variant: ToastVariant
  leaving: boolean
}

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { showToast: () => {} }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [mounted, setMounted] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const idRef = useRef(0)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    }
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    const id = ++idRef.current
    setToast({ id, message, variant, leaving: false })
    hideTimer.current = window.setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? { ...prev, leaving: true } : prev))
      leaveTimer.current = window.setTimeout(() => {
        setToast((prev) => (prev && prev.id === id ? null : prev))
      }, 280)
    }, 3400)
  }, [])

  const dismiss = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    setToast((prev) => (prev ? { ...prev, leaving: true } : prev))
    leaveTimer.current = window.setTimeout(() => setToast(null), 280)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && toast
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 z-[160] flex justify-center px-4"
              style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
              role="status"
              aria-live="polite"
            >
              <button
                type="button"
                onClick={dismiss}
                className={`pointer-events-auto flex max-w-[min(520px,100%)] items-center gap-2.5 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.16)] ${
                  toast.variant === 'error' ? 'bg-[#DC2626]' : 'bg-[#166534]'
                } ${toast.leaving ? 'anidocs-toast-out' : 'anidocs-toast-in'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    toast.variant === 'error' ? 'bg-white/15' : 'bg-white/20'
                  }`}
                  aria-hidden
                >
                  <FontAwesomeIcon icon={toast.variant === 'error' ? faXmark : faCheck} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 leading-snug">{toast.message}</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}
