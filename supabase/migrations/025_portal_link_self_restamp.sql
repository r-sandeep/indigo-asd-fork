-- ============================================================================
-- 025_portal_link_self_restamp.sql
--
-- Makes portal_link_self() tolerant of stale auth references.
--
-- Previously, both the primary-contact (customers.portal_user_id) and
-- secondary-contact (customer_portal_users.user_id) paths were guarded by
-- "IS NULL", which meant:
--
--   * A customer whose portal account was deleted and re-invited would get a
--     new Supabase auth UUID, but portal_link_self() would find the column
--     non-null and silently skip the update → "No portal access".
--
-- Fix: allow re-linking if the stored UUID no longer exists in auth.users
-- (i.e. the old account was deleted). An active, live auth account is never
-- overwritten — that would let user B hijack user A's customer record.
-- ============================================================================

create or replace function portal_link_self()
returns int language plpgsql security definer as $$
declare
  v_updated    int := 0;
  v_auth_email text;
begin
  select email into v_auth_email
    from auth.users
   where id = auth.uid();

  -- 1. Secondary contact path: match email in customer_portal_users.
  --    Re-link if user_id is null OR points to a deleted auth account.
  update customer_portal_users
     set user_id   = auth.uid(),
         linked_at = now()
   where lower(email) = lower(v_auth_email)
     and (
       user_id is null
       or user_id not in (select id from auth.users)
     );

  get diagnostics v_updated = row_count;

  -- 2. Primary contact path: match customers.email.
  --    Re-link if portal_user_id is null OR points to a deleted auth account.
  if v_updated = 0 then
    update customers
       set portal_user_id = auth.uid()
     where lower(email) = lower(v_auth_email)
       and (
         portal_user_id is null
         or portal_user_id not in (select id from auth.users)
       );
    get diagnostics v_updated = row_count;
  end if;

  return v_updated;
end;
$$;
