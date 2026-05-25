import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { PortalCustomer } from '@indigo/shared'

interface PortalAuthState {
  user:      User | null
  session:   Session | null
  customer:  PortalCustomer | null
  isLoading: boolean

  setAuth:     (user: User | null, session: Session | null) => void
  setCustomer: (customer: PortalCustomer | null) => void
  setLoading:  (isLoading: boolean) => void
  clearAuth:   () => void
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  user:      null,
  session:   null,
  customer:  null,
  isLoading: true,

  setAuth:     (user, session) => set({ user, session }),
  setCustomer: (customer)      => set({ customer }),
  setLoading:  (isLoading)     => set({ isLoading }),
  clearAuth:   ()              => set({ user: null, session: null, customer: null, isLoading: false }),
}))
