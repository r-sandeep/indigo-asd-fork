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
  -- Atomically find & lock the CO row and verify it is pending client approval
  -- Accept both Indigo pending rows and legacy BB rows (co_status IS NULL and status = 'Pending')
  select job_id, tenant_id, to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id = p_co_id
     and (co_status = 'pending_approval' or (co_status is null and status = 'Pending'))
   for update;

  if not found then
    -- Not pending client approval (or not found); be a no-op to mirror PM behavior
    return;
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

  -- Write audit log entry using the locked/updated old_row; use auth.uid() as the acting user id
  insert into audit_log (tenant_id, user_id, table_name, record_id, action, old_values, new_values)
  select v_tenant_id,
         auth.uid(),
         'job_change_orders',
         p_co_id,
         'update',
         v_old_row,
         jsonb_build_object(
           'co_status',           'approved',
           'approved_at',         now(),
           'approved_by_user_id', auth.uid(),
           '_approved_via',       'portal'
         );
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
  -- Atomically find & lock the CO row
  select job_id, tenant_id, to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id = p_co_id
   for update;

  if not found then
    raise exception 'Change order not found';
  end if;

  -- Verify caller is a PM+ member of the tenant (use auth.uid() mapped to user_profiles.id)
  if not exists (
    select 1 from tenant_members
     where user_id   = auth.uid()
       and tenant_id = v_tenant_id
       and role in ('project_manager', 'admin', 'owner')
  ) then
    raise exception 'PM+ role required to approve change orders';
  end if;

  if v_old_row ->> 'co_status' = 'approved' then
    return;
  end if;

  update job_change_orders
     set co_status            = 'approved',
         approved_at          = now(),
         approved_by_user_id  = auth.uid()
   where id = p_co_id;

  -- Write audit log entry
  insert into audit_log (tenant_id, user_id, table_name, record_id, action, old_values, new_values)
  select v_tenant_id,
         auth.uid(),
         'job_change_orders',
         p_co_id,
         'update',
         v_old_row,
         jsonb_build_object(
           'co_status',           'approved',
           'approved_at',         now(),
           'approved_by_user_id', auth.uid(),
           '_approved_via',       'pm'
         );
end;
$$;
