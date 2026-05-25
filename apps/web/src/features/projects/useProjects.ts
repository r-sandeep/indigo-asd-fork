import { useQuery } from '@tanstack/react-query'
import { getProjects } from '@indigo/shared'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useProjects() {
  const { activeTenantId } = useAuth()

  return useQuery({
    queryKey: ['projects', activeTenantId],
    queryFn:  () => getProjects(supabase, activeTenantId!),
    enabled:  !!activeTenantId,
    staleTime: 30_000,
  })
}
