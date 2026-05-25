import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuthListener() {
  const { setAuth, setProfile, setTenantMemberships, clearAuth } = useAuthStore()

  useEffect(() => {
    // Hydrate existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user ?? null, session)
      if (session?.user) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ?? null, session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        clearAuth()
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile(userId: string) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, avatar_url, phone, created_at, updated_at')
      .eq('id', userId)
      .single()

    if (profile) setProfile(profile)

    const { data: memberships } = await supabase
      .from('tenant_members')
      .select('*, tenant:tenants(id, name, slug, logo_url, created_at, updated_at)')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (memberships) setTenantMemberships(memberships as Parameters<typeof setTenantMemberships>[0])
  }
}

export function useAuth() {
  return useAuthStore()
}
