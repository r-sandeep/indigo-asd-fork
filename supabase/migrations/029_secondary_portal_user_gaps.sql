-- ============================================================================
-- 029_secondary_portal_user_gaps.sql
--
-- Fixes three places where secondary portal users (customer_portal_users)
-- were missed when migration 024 introduced the secondary-contact model.
-- Every RLS policy and RPC that previously used `customers.portal_user_id =
-- auth.uid()` directly was updated then — except these three.
--
-- 1. client_selections  — ALL policy blocks secondary users from viewing
--                         or submitting selections
-- 2. warranty_claims    — ALL policy blocks secondary users from submitting
--                         or viewing warranty claims (portal UI not yet built,
--                         but fixing now to avoid a future surprise)
-- 3. portal_approve_milestone() — authorization guard uses portal_user_id
--                         directly; secondary users always get "not authorized"
-- ============================================================================


-- ── 1. client_selections ─────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename  = 'client_selections'
      and policyname = 'clients view and make their own selections'
  ) then
    execute $p$ drop policy "clients view and make their own selections" on client_selections $p$;
  end if;
end $$;

create policy "clients view and make their own selections"
  on client_selections for all
  using (
    -- Primary portal contact
    customer_id in (
      select id from customers where portal_user_id = auth.uid()
    )
    or
    -- Secondary portal contact
    customer_id in (
      select customer_id from customer_portal_users where user_id = auth.uid()
    )
  );


-- ── 2. warranty_claims ────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename  = 'warranty_claims'
      and policyname = 'clients manage own warranty claims'
  ) then
    execute $p$ drop policy "clients manage own warranty claims" on warranty_claims $p$;
  end if;
end $$;

create policy "clients manage own warranty claims"
  on warranty_claims for all
  using (
    -- Primary portal contact
    customer_id in (
      select id from customers where portal_user_id = auth.uid()
    )
    or
    -- Secondary portal contact
    customer_id in (
      select customer_id from customer_portal_users where user_id = auth.uid()
    )
  );


-- ── 3. portal_approve_milestone() ────────────────────────────────────────────
--
-- Old version checked c.portal_user_id = auth.uid() directly.
-- New version delegates to is_client_on_job() which already handles both
-- primary and secondary contacts (updated in migration 024).

create or replace function portal_approve_milestone(p_milestone_id uuid)
returns void language plpgsql security definer as $$
declare
  v_project_id uuid;
  v_job_id     uuid;
begin
  -- Resolve the milestone's project and job
  select m.project_id, pr.job_id
    into v_project_id, v_job_id
    from milestones m
    join projects   pr on pr.id = m.project_id
   where m.id                    = p_milestone_id
     and m.requires_client_approval = true
     and m.client_approved_at    is null;

  if not found then
    raise exception 'Milestone not found, does not require approval, or is already approved';
  end if;

  -- is_client_on_job() accepts both primary (customers.portal_user_id)
  -- and secondary (customer_portal_users.user_id) contacts
  if not is_client_on_job(v_job_id) then
    raise exception 'Not authorized to approve this milestone';
  end if;

  update milestones
     set client_approved_at = now()
   where id = p_milestone_id;
end;
$$;
