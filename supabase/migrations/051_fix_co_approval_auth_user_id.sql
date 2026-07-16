-- ============================================================================
-- 051_fix_co_approval_auth_user_id.sql
--
-- Fixes portal_approve_change_order() and pm_approve_change_order() which
-- were broken by migration 046.
--
-- Migration 046 referenced user_profiles.auth_user_id, but that column does
-- not exist. user_profiles.id IS the Supabase auth UID (primary key references
-- auth.users(id)), so the correct lookup is simply `user_profiles.id = auth.uid()`.
-- PL/pgSQL defers column validation to runtime, so both functions were created
-- successfully but failed on every call with "column auth_user_id does not exist".
-- ============================================================================

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

  -- Write audit log entry (user_profiles.id = auth.uid() for portal users
  -- who have a profile row; portal-only users won't have one so this
  -- inserts 0 rows — acceptable, the update above is the source of truth)
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

  -- Verify caller is a PM+ member of the tenant.
  -- tenant_members.user_id references user_profiles.id which equals auth.uid()
  -- for staff users, so no subquery needed.
  if not exists (
    select 1 from tenant_members
     where user_id   = auth.uid()
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
   where up.id = auth.uid()
   limit 1;
end;
$$;
