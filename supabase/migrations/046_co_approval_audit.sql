-- ============================================================================
-- 046_co_approval_audit.sql
--
-- Adds an audit trail for change order approvals:
--
--   1. approved_by_user_id on job_change_orders — records which Supabase
--      auth user approved the CO (portal user OR PM).
--
--   2. Updates portal_approve_change_order() to stamp approved_by_user_id
--      = auth.uid() and write a row to audit_log.
--
--   3. Adds pm_approve_change_order() security-definer RPC so PM-side
--      approvals also stamp approved_by_user_id and write to audit_log,
--      rather than doing a raw UPDATE that bypasses the audit trail.
-- ============================================================================

-- ── 1. Add approved_by_user_id to job_change_orders ──────────────────────

alter table job_change_orders
  add column if not exists approved_by_user_id uuid references auth.users(id);

-- ── 2. Update portal_approve_change_order() ───────────────────────────────

create or replace function portal_approve_change_order(p_co_id uuid)
returns void language plpgsql security definer as $$
declare
  v_job_id    uuid;
  v_tenant_id uuid;
  v_old_row   jsonb;
begin
  -- Find the CO and verify it is pending client approval
  select job_id, tenant_id,
         to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id        = p_co_id
     and co_status = 'pending_approval';

  if not found then
    raise exception 'Change order not found or not pending client approval';
  end if;

  -- is_client_on_job() handles both primary and secondary portal contacts
  if not is_client_on_job(v_job_id) then
    raise exception 'Not authorized to approve this change order';
  end if;

  update job_change_orders
     set co_status            = 'approved',
         approved_at          = now(),
         approved_by_user_id  = auth.uid()
   where id = p_co_id;

  -- Write audit log entry
  insert into audit_log (tenant_id, user_id, table_name, record_id, action, old_values, new_values)
  select v_tenant_id,
         up.id,
         'job_change_orders',
         p_co_id,
         'update',
         v_old_row,
         jsonb_build_object(
           'co_status',           'approved',
           'approved_at',         now(),
           'approved_by_user_id', auth.uid(),
           '_approved_via',       'portal'
         )
    from user_profiles up
   where up.auth_user_id = auth.uid()
   limit 1;
end;
$$;

-- ── 3. Add pm_approve_change_order() for PM-side approvals ───────────────

create or replace function pm_approve_change_order(p_co_id uuid)
returns void language plpgsql security definer as $$
declare
  v_job_id    uuid;
  v_tenant_id uuid;
  v_old_row   jsonb;
begin
  -- Find the CO
  select job_id, tenant_id,
         to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id = p_co_id;

  if not found then
    raise exception 'Change order not found';
  end if;

  -- Verify caller is a PM+ member of the tenant
  if not exists (
    select 1 from tenant_members
     where user_id   = (select id from user_profiles where auth_user_id = auth.uid() limit 1)
       and tenant_id = v_tenant_id
       and role in ('project_manager', 'admin', 'owner')
  ) then
    raise exception 'PM+ role required to approve change orders';
  end if;

  update job_change_orders
     set co_status           = 'approved',
         approved_at         = now(),
         approved_by_user_id = auth.uid()
   where id = p_co_id;

  -- Write audit log entry
  insert into audit_log (tenant_id, user_id, table_name, record_id, action, old_values, new_values)
  select v_tenant_id,
         up.id,
         'job_change_orders',
         p_co_id,
         'update',
         v_old_row,
         jsonb_build_object(
           'co_status',           'approved',
           'approved_at',         now(),
           'approved_by_user_id', auth.uid(),
           '_approved_via',       'pm'
         )
    from user_profiles up
   where up.auth_user_id = auth.uid()
   limit 1;
end;
$$;
