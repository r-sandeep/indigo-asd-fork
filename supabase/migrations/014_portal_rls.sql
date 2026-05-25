-- ============================================================================
-- 014_portal_rls.sql
-- Fixes and additions for the customer portal:
--   1. Enable RLS + add access policies on BB-owned invoices table
--   2. portal_link_self()        — security-definer, lets a portal user auto-link
--                                   their auth.uid() to a customers row by email
--   3. portal_approve_milestone() — security-definer, lets a portal client approve
--                                   milestones that require client approval
-- ============================================================================

-- ── 1. Invoices: RLS + portal access ─────────────────────────────────────────

-- Enable row-level security on invoices (idempotent — safe even if already on)
alter table invoices enable row level security;

-- Tenant members can view invoices for their jobs
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invoices'
      and policyname = 'tenant members view invoices'
  ) then
    execute $p$
      create policy "tenant members view invoices" on invoices
        for select using (
          exists (
            select 1 from jobs j
            where j.id = invoices.job_id
              and j.tenant_id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;

-- Portal clients can view invoices for their own job
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invoices'
      and policyname = 'clients view their invoices'
  ) then
    execute $p$
      create policy "clients view their invoices" on invoices
        for select using (
          is_client_on_job(job_id)
        )
    $p$;
  end if;
end $$;

-- Tenant members (PM and above) can manage invoices
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invoices'
      and policyname = 'pm and above manage invoices'
  ) then
    execute $p$
      create policy "pm and above manage invoices" on invoices
        for all using (
          exists (
            select 1 from jobs j
            where j.id = invoices.job_id
              and user_has_role(j.tenant_id, 'project_manager')
          )
        )
    $p$;
  end if;
end $$;


-- ── 2. portal_link_self() ─────────────────────────────────────────────────────
-- Called from the portal app after a user logs in and is not yet linked.
-- Matches customers.email (case-insensitive) to the authenticated user's email,
-- then sets portal_user_id = auth.uid() only where it is still null.
-- Returns the number of rows updated (0 = no matching customer found).

create or replace function portal_link_self()
returns int language plpgsql security definer as $$
declare
  v_updated int;
begin
  update customers
     set portal_user_id = auth.uid()
   where lower(email) = lower((select email from auth.users where id = auth.uid()))
     and portal_user_id is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


-- ── 3. portal_approve_milestone() ────────────────────────────────────────────
-- Called from the portal UI when a client approves a milestone.
-- Validates: caller is the client on the milestone's project, milestone
-- requires approval, and has not already been approved.

create or replace function portal_approve_milestone(p_milestone_id uuid)
returns void language plpgsql security definer as $$
declare
  v_project_id uuid;
begin
  -- Resolve the milestone's project
  select project_id into v_project_id
    from milestones
   where id = p_milestone_id
     and requires_client_approval = true
     and client_approved_at is null;

  if not found then
    raise exception 'Milestone not found, does not require approval, or is already approved';
  end if;

  -- Verify the calling portal user is the client on this job
  if not exists (
    select 1
      from projects pr
      join jobs      j  on j.id  = pr.job_id
      join customers c  on c.id  = j.customer_id
     where pr.id = v_project_id
       and c.portal_user_id = auth.uid()
  ) then
    raise exception 'Not authorized to approve this milestone';
  end if;

  -- Stamp the approval
  update milestones
     set client_approved_at = now()
   where id = p_milestone_id;
end;
$$;
