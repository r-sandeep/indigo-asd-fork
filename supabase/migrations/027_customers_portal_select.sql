-- ============================================================================
-- 027_customers_portal_select.sql
--
-- Adds a SELECT policy on the customers table so that a portal user can read
-- their own customer row directly.
--
-- Background:
--   getCustomerByUserId() does a direct SELECT on customers filtered by
--   portal_user_id = auth.uid(). All other portal queries reach customers
--   indirectly via is_client_on_job() (security definer, bypasses RLS), so
--   they worked fine. But this direct read had no matching policy, causing
--   the query to silently return null even after portal_link_self() correctly
--   set portal_user_id.
--
-- Also covers secondary portal contacts: they reach their customer row via
-- a customer_portal_users → customers join, which requires SELECT on customers.
-- ============================================================================

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename  = 'customers'
      and policyname = 'portal users read own customer'
  ) then
    execute $p$
      create policy "portal users read own customer"
        on customers for select
        using (
          -- Primary contact
          portal_user_id = auth.uid()
          or
          -- Secondary contact (joined via customer_portal_users)
          exists (
            select 1
              from customer_portal_users cpu
             where cpu.customer_id = customers.id
               and cpu.user_id     = auth.uid()
          )
        )
    $p$;
  end if;
end $$;
