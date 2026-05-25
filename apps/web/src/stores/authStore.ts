import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile, TenantMember, Tenant } from '@indigo/db'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  tenantMemberships: (TenantMember & { tenant: Tenant })[]
  activeTenantId: string | null
  /** True until the first getSession() response has been processed. */
  isLoading: boolean

  setAuth: (user: User | null, session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setTenantMemberships: (memberships: (TenantMember & { tenant: Tenant })[]) => void
  setActiveTenant: (tenantId: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  tenantMemberships: [],
  activeTenantId: null,
  isLoading: true,

  setAuth: (user, session) => set({ user, session, isLoading: false }),
  setProfile: (profile) => set({ profile }),
  setTenantMemberships: (tenantMemberships) =>
    set((state) => ({
      tenantMemberships,
      activeTenantId:
        state.activeTenantId ?? tenantMemberships[0]?.tenant_id ?? null,
    })),
  setActiveTenant: (activeTenantId) => set({ activeTenantId }),
  clearAuth: () =>
    set({ user: null, session: null, profile: null, tenantMemberships: [], activeTenantId: null, isLoading: false }),
}))
