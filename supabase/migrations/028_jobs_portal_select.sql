-- ============================================================================
-- 028_jobs_portal_select.sql
--
-- Adds a SELECT policy on the jobs table for portal users so that:
--   1. The embedded job:jobs(...) join in portal project queries returns data
--      (PostgREST respects RLS on joined tables)
--   2. Any future direct jobs reads from portal context work correctly
--
-- Only runs if RLS is enabled on jobs. If jobs has no RLS (BB-managed with
-- open reads), this policy is additive and harmless.
--
-- Uses is_client_on_job(id) — already security-definer, handles both primary
-- portal_user_id and secondary customer_portal_users paths.
-- ============================================================================

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'jobs'
      and policyname = 'portal clients view their job'
  ) then
    execute $p$
      create policy "portal clients view their job"
        on jobs for select
        using (is_client_on_job(id))
    $p$;
  end if;
end $$;
