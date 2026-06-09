import * as React from 'react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

const Toast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'pointer-events-auto flex w-full items-center gap-3 rounded-lg border p-4 shadow-lg',
      variant === 'default' && 'bg-background text-foreground',
      variant === 'destructive' && 'border-destructive/50 bg-destructive/10 text-destructive',
      className,
    )}
    {...props}
  />
))
Toast.displayName = 'Toast'

const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant} className="animate-in slide-in-from-right-full">
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <span className="sr-only">Close</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col gap-1">
            {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
            {toast.description && <div className="text-sm text-muted-foreground">{toast.description}</div>}
          </div>
        </Toast>
      ))}
    </div>
  )
}

export { Toast, Toaster, ToastProvider, useToast }
