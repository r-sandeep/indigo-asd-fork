-- ============================================================================
-- 039_customers_staff_select.sql
--
-- Adds a SELECT policy on the customers table for authenticated tenant staff.
--
-- Root cause: migration 027 added a portal-user policy on customers but no
-- staff-facing equivalent. The staff ClientTab calls getJobCustomer() which
-- does a direct SELECT on customers. Without a matching policy the query
-- returns null, causing the tab to show "No customer linked" for any role
-- below admin/owner (i.e. project_manager and below).
--
-- Policy logic:
--   A staff user may read a customer if that customer is linked to a job
--   that belongs to a project in one of their tenant(s). Mirrors the same
--   subquery pattern used in migration 038 for the jobs table.
--
-- Safe to run whether or not customers has RLS enabled:
--   - RLS enabled  → policy takes effect for all tenant staff
--   - RLS disabled → policy exists but is never evaluated (open reads remain)
-- ============================================================================

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'customers'
      and policyname = 'tenant staff view customers'
  ) then
    execute $p$
      create policy "tenant staff view customers"
        on customers for select
        using (
          id in (
            select j.customer_id
            from   jobs     j
            join   projects p on p.job_id = j.id
            where  p.tenant_id in (select get_user_tenant_ids())
              and  j.customer_id is not null
          )
        )
    $p$;
  end if;
end $$;
