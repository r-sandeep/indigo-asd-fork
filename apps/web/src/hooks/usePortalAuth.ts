import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { getCustomerByUserId, linkCustomerByEmail } from '@indigo/shared'

export function usePortalAuthListener() {
  const { setAuth, setCustomer, setLoading, setStaffPreview, clearAuth } = usePortalAuthStore()

  useEffect(() => {
    setLoading(true)

    // Hydrate existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user ?? null, session)
      if (session?.user) {
        loadCustomer(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ?? null, session)
      if (session?.user) {
        loadCustomer(session.user.id)
      } else {
        clearAuth()
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCustomer(userId: string) {
    setLoading(true)
    try {
      let customer = await getCustomerByUserId(supabase, userId)

      // Auto-link on first login: if the user isn't linked yet, try to match
      // their auth email to a customers row and set portal_user_id via RPC.
      if (!customer) {
        customer = await linkCustomerByEmail(supabase, userId)
      }

      if (customer) {
        setCustomer(customer)
        return
      }

      // Not a client — check if they're a tenant admin or owner.
      // Admins and owners get read-only "staff preview" access to all portals.
      const { data: adminMemberships } = await supabase
        .from('tenant_memberships')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'owner'])
        .limit(1)

      if (adminMemberships && adminMemberships.length > 0) {
        setStaffPreview(true)
      } else {
        setCustomer(null) // no access
      }
    } catch {
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }
}

export function usePortalAuth() {
  return usePortalAuthStore()
}
