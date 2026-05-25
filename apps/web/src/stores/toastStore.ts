import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration)
    }
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}))

/** Convenience hook */
export function useToast() {
  const add = useToastStore((s) => s.add)
  return {
    success: (title: string, description?: string) => add({ type: 'success', title, description }),
    error:   (title: string, description?: string) => add({ type: 'error',   title, description }),
    info:    (title: string, description?: string) => add({ type: 'info',    title, description }),
    warning: (title: string, description?: string) => add({ type: 'warning', title, description }),
  }
}
