import { useMemo } from 'react'
import { useProjects } from '@/features/projects/useProjects'

export function useDashboardStats() {
  const { data: projects, isLoading } = useProjects()

  const stats = useMemo(() => {
    if (!projects) return null
    const jobs = projects.map((p) => p.job).filter(Boolean)
    return {
      active:    jobs.filter((j) => j!.status === 'active').length,
      bidding:   jobs.filter((j) => j!.status === 'bidding').length,
      onHold:    jobs.filter((j) => j!.status === 'on_hold').length,
      complete:  jobs.filter((j) => j!.status === 'complete').length,
      total:     jobs.length,
    }
  }, [projects])

  return { stats, isLoading }
}
