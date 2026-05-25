import { useQuery } from '@tanstack/react-query'
import { getProject, getProjectPhases } from '@indigo/shared'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey:  ['project', projectId],
    queryFn:   () => getProject(supabase, projectId!),
    enabled:   !!projectId,
    staleTime: 30_000,
  })
}

export function useProjectPhases(projectId: string | undefined) {
  const { activeTenantId } = useAuth()

  return useQuery({
    queryKey:  ['project-phases', projectId],
    queryFn:   () => getProjectPhases(supabase, projectId!, activeTenantId!),
    enabled:   !!projectId && !!activeTenantId,
    staleTime: 30_000,
  })
}
