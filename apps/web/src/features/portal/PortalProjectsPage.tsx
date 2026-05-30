import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPortalProjects, getStaffPortalProjects } from '@indigo/shared'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { Skeleton } from '@/components/ui/Skeleton'

export function PortalProjectsPage() {
  const { customer, isStaffPreview } = usePortalAuth()

  const { data: projects, isLoading } = useQuery({
    queryKey:  isStaffPreview
      ? ['staff-portal-projects']
      : ['portal-projects', customer?.id],
    queryFn:   isStaffPreview
      ? () => getStaffPortalProjects(supabase)
      : () => getPortalProjects(supabase, customer!.id),
    enabled:   isStaffPreview || !!customer?.id,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    )
  }

  // If customer only has one project, go straight there
  if (!isStaffPreview && projects && projects.length === 1) {
    return <Navigate to={`/portal/projects/${projects[0].id}`} replace />
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="mt-12 text-center">
        <div className="text-4xl">🏗️</div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">
          {isStaffPreview ? 'No projects found' : 'No projects yet'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isStaffPreview
            ? 'No projects exist in this tenant yet.'
            : 'Your builder hasn\'t linked any projects to your portal account yet. Contact them for access.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">
        {isStaffPreview ? 'All Projects' : 'Your Projects'}
      </h1>
      <div className="space-y-3">
        {projects.map((project) => {
          const job = project.job
          const location = [job?.city, job?.state].filter(Boolean).join(', ')
          return (
            <a
              key={project.id}
              href={`/portal/projects/${project.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-base font-semibold text-gray-900">{job?.job_name ?? 'Project'}</h2>
              {location && <p className="mt-0.5 text-sm text-gray-500">📍 {location}</p>}
              {job?.project_status && (
                <span className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700">
                  {job.project_status.replace('_', ' ')}
                </span>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}
