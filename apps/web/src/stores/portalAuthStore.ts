import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { PortalCustomer } from '@indigo/shared'

interface PortalAuthState {
  user:           User | null
  session:        Session | null
  customer:       PortalCustomer | null
  isLoading:      boolean
  /** True when the logged-in user is a tenant admin/owner browsing the portal as a staff preview. */
  isStaffPreview: boolean

  setAuth:         (user: User | null, session: Session | null) => void
  setCustomer:     (customer: PortalCustomer | null) => void
  setLoading:      (isLoading: boolean) => void
  setStaffPreview: (isStaff: boolean) => void
  clearAuth:       () => void
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  user:           null,
  session:        null,
  customer:       null,
  isLoading:      true,
  isStaffPreview: false,

  setAuth:         (user, session)   => set({ user, session }),
  setCustomer:     (customer)        => set({ customer }),
  setLoading:      (isLoading)       => set({ isLoading }),
  setStaffPreview: (isStaffPreview)  => set({ isStaffPreview }),
  clearAuth:       ()                => set({ user: null, session: null, customer: null, isLoading: false, isStaffPreview: false }),
}))
