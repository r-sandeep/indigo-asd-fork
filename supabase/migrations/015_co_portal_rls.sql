-- ============================================================================
-- 015_co_portal_rls.sql
-- Add RLS on job_change_orders for portal client access.
-- BB's table has no Indigo RLS yet — add tenant-member policy (maintains
-- existing staff behaviour) + portal-client policy (new).
-- ============================================================================

-- Enable RLS (idempotent)
alter table job_change_orders enable row level security;

-- Tenant members can view all COs for their tenant's jobs
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'job_change_orders'
      and policyname = 'tenant members view change orders'
  ) then
    execute $p$
      create policy "tenant members view change orders" on job_change_orders
        for select using (
          tenant_id in (select get_user_tenant_ids())
        )
    $p$;
  end if;
end $$;

-- PM and above can manage COs for their tenant
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'job_change_orders'
      and policyname = 'pm and above manage change orders'
  ) then
    execute $p$
      create policy "pm and above manage change orders" on job_change_orders
        for all using (
          user_has_role(tenant_id, 'project_manager')
        )
    $p$;
  end if;
end $$;

-- Portal clients can view pending-approval and approved COs on their job.
-- Draft and void COs are not shown to clients.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'job_change_orders'
      and policyname = 'clients view their change orders'
  ) then
    execute $p$
      create policy "clients view their change orders" on job_change_orders
        for select using (
          is_client_on_job(job_id)
          and co_status in ('pending_approval', 'approved')
        )
    $p$;
  end if;
end $$;
