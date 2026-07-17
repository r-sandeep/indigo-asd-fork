-- ============================================================================
-- 052_co_approval_fix.sql
--
-- Add/backfill approved_at and make portal/PM approval RPCs concurrency-safe
-- and compatible with legacy BB rows; fix user_profiles lookup to use id.
-- ============================================================================

-- 1) Ensure approved_at exists (timestamptz) and backfill from legacy
--    date_approved (date) without dropping the legacy column.

alter table job_change_orders
  add column if not exists approved_at timestamptz;

-- Backfill approved_at from date_approved where present and approved_at is null.
update job_change_orders
   set approved_at = (date_approved::timestamp at time zone 'UTC')
 where approved_at is null
   and date_approved is not null;


-- 2) portal_approve_change_order: accept Indigo pending rows OR legacy
--    BB rows where co_status IS NULL and status = 'Pending'. Authorization
--    is checked before mutation. Concurrent callers will only create a
--    single audit_log row because the UPDATE only succeeds when
--    approved_at IS NULL and the insert is executed only when the update
--    actually modified a row.

create or replace function portal_approve_change_order(p_co_id uuid)
returns void language plpgsql security definer as $$
declare
  v_job_id    uuid;
  v_tenant_id uuid;
  v_old_row   jsonb;
begin
  -- Find the CO and verify it is pending client approval (Indigo or legacy BB)
  select job_id, tenant_id,
         to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id = p_co_id
     and approved_at is null
     and (
       co_status = 'pending_approval'
       or (co_status is null and status = 'Pending')
     );

  if not found then
    raise exception 'Change order not found or not pending client approval';
  end if;

  -- is_client_on_job() handles both primary and secondary portal contacts
  if not is_client_on_job(v_job_id) then
    raise exception 'Not authorized to approve this change order';
  end if;

  -- Attempt to apply approval only if not already approved; this prevents
  -- races from generating duplicate audit_log rows because only one caller
  -- will actually update a row.
  update job_change_orders
     set co_status           = 'approved',
         approved_at         = now(),
         approved_by_user_id = auth.uid()
   where id = p_co_id
     and approved_at is null;

  if not found then
    -- Another concurrent approver already completed approval; nothing to do
    return;
  end if;

  -- Write audit log entry (only if the update above affected a row)
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
   where up.id = auth.uid()
   limit 1;
end;
$$;


-- 3) pm_approve_change_order: PM-side approval; preserves PM baseline
--    ability to approve any CO that is not already approved. Authorization
--    is checked before mutation and the update is guarded by approved_at IS NULL
--    to avoid duplicate audit rows under concurrency.

create or replace function pm_approve_change_order(p_co_id uuid)
returns void language plpgsql security definer as $$
declare
  v_job_id    uuid;
  v_tenant_id uuid;
  v_old_row   jsonb;
begin
  -- Find the CO and ensure it is not already approved
  select job_id, tenant_id,
         to_jsonb(job_change_orders.*) - 'id'
    into v_job_id, v_tenant_id, v_old_row
    from job_change_orders
   where id = p_co_id
     and approved_at is null;

  if not found then
    raise exception 'Change order not found or already approved';
  end if;

  -- Verify caller is a PM+ member of the tenant.
  -- tenant_members.user_id references user_profiles.id which equals auth.uid()
  if not exists (
    select 1 from tenant_members
     where user_id   = auth.uid()
       and tenant_id = v_tenant_id
       and role in ('project_manager', 'admin', 'owner')
  ) then
    raise exception 'PM+ role required to approve change orders';
  end if;

  -- Apply approval only if still unapproved
  update job_change_orders
     set co_status           = 'approved',
         approved_at         = now(),
         approved_by_user_id = auth.uid()
   where id = p_co_id
     and approved_at is null;

  if not found then
    -- Race detected: another approver already completed approval
    return;
  end if;

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
   where up.id = auth.uid()
   limit 1;
end;
$$;
