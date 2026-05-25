import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile, TenantMember, Tenant } from '@indigo/db'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  tenantMemberships: (TenantMember & { tenant: Tenant })[]
  activeTenantId: string | null

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

  setAuth: (user, session) => set({ user, session }),
  setProfile: (profile) => set({ profile }),
  setTenantMemberships: (tenantMemberships) =>
    set((state) => ({
      tenantMemberships,
      activeTenantId:
        state.activeTenantId ?? tenantMemberships[0]?.tenant_id ?? null,
    })),
  setActiveTenant: (activeTenantId) => set({ activeTenantId }),
  clearAuth: () =>
    set({ user: null, session: null, profile: null, tenantMemberships: [], activeTenantId: null }),
}))
