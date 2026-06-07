-- ============================================================================
-- 038_jobs_staff_select.sql
--
-- Adds a SELECT policy on the jobs table for authenticated tenant staff so
-- that the embedded job:jobs(...) join in getProjects() returns data.
--
-- Root cause: migration 028 added a portal-client policy on jobs but no
-- staff-facing equivalent. PostgREST enforces RLS on joined tables, so any
-- staff user whose role doesn't satisfy an existing jobs SELECT policy gets
-- job: null on every project row. ProjectsPage filters out null-job projects,
-- producing an empty list even though the user can insert/update projects.
--
-- Policy logic:
--   A staff user may read a job if that job is linked to a project in one
--   of their tenant(s). Uses get_user_tenant_ids() (security definer) so
--   the subquery is not constrained by projects RLS.
--
-- Safe to run whether or not jobs has RLS enabled:
--   - RLS enabled  → policy takes effect, staff can read their tenant's jobs
--   - RLS disabled → policy exists but is never evaluated (open reads remain)
-- ============================================================================

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'jobs'
      and policyname = 'tenant staff view jobs'
  ) then
    execute $p$
      create policy "tenant staff view jobs"
        on jobs for select
        using (
          id in (
            select job_id from projects
            where  tenant_id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;
