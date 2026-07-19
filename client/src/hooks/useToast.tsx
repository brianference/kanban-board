import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Kind = 'info' | 'success' | 'error'
type Toast = { id: string; message: string; kind: Kind }

const Ctx = createContext<{
  push: (message: string, kind?: Kind) => void
} | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const push = useCallback(
    (message: string, kind: Kind = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setToasts((t) => [...t, { id, message, kind }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ push }), [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-soft ${
              t.kind === 'success'
                ? 'border-green-200'
                : t.kind === 'error'
                  ? 'border-red-200'
                  : 'border-slate-200'
            }`}
          >
            <span className="text-sm font-medium">{t.message}</span>
            <button type="button" className="text-ink-500" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast requires ToastProvider')
  return ctx
}
