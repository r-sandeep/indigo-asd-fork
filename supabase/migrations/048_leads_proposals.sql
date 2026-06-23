-- ============================================================================
-- 048_leads_proposals.sql
--
-- Sales pipeline:
--   leads                        — potential jobs / opportunities
--   lead_activities              — CRM activity log per lead
--   proposals                    — polished client-facing proposal documents
--   proposal_line_items          — editable line items on a proposal
--   proposal_line_item_templates — reusable pre-configured rows
--
-- Public portal access (no auth) uses security-definer RPC functions rather
-- than permissive RLS policies so that tokens can't be enumerated.
-- ============================================================================

-- Drop in reverse dependency order so re-runs are idempotent
drop table if exists proposal_line_item_templates cascade;
drop table if exists proposal_line_items          cascade;
drop table if exists proposals                    cascade;
drop table if exists lead_activities              cascade;
drop table if exists leads                        cascade;

-- ── Shared trigger function ───────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── leads ─────────────────────────────────────────────────────────────────

create table leads (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             uuid        not null,
  contact_id            uuid        references contacts(id) on delete set null,

  -- Denormalized contact snapshot (editable independently of linked contact)
  client_name           text        not null,
  client_email          text,
  client_phone          text,

  -- Job details
  title                 text        not null,
  job_address           text,
  job_city              text,
  job_state             text,
  job_zip               text,
  job_type              text,       -- remodel | new_construction | addition | adu | other
  description           text,
  estimated_value_cents bigint,

  -- Pipeline
  status                text        not null default 'new',
  -- new | contacted | qualified | proposal_sent | won | lost
  lead_source           text,
  -- referral | website | social | repeat | cold | other

  -- Assignment
  assigned_to           uuid        references auth.users(id),

  -- Dates
  lead_date             date        not null default current_date,
  follow_up_date        date,
  won_date              date,
  lost_date             date,
  lost_reason           text,

  -- Set when lead is converted to a project
  project_id            uuid,

  created_by            uuid        references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table leads enable row level security;

create policy "tenant staff select leads" on leads for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert leads" on leads for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff update leads" on leads for update
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete leads" on leads for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index leads_tenant_id_idx on leads(tenant_id);
create index leads_status_idx     on leads(tenant_id, status);

create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- ── lead_activities ────────────────────────────────────────────────────────

create table lead_activities (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null,
  lead_id       uuid        not null references leads(id) on delete cascade,
  type          text        not null, -- note | call | email | meeting | site_visit
  description   text        not null,
  activity_date timestamptz not null default now(),
  created_by    uuid        references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table lead_activities enable row level security;

create policy "tenant staff select lead_activities" on lead_activities for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert lead_activities" on lead_activities for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete lead_activities" on lead_activities for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index lead_activities_lead_id_idx on lead_activities(lead_id);

-- ── proposals ──────────────────────────────────────────────────────────────

create table proposals (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null,
  lead_id         uuid        references leads(id) on delete cascade,

  title           text        not null,
  proposal_number text,

  -- Client info snapshot (copied from lead, editable)
  client_name     text,
  client_email    text,
  job_address     text,
  job_city        text,
  job_state       text,
  job_zip         text,

  -- Content
  intro_text      text,
  closeout_text   text,

  -- Column visibility for the pricing table
  col_item        boolean     not null default true,
  col_description boolean     not null default true,
  col_unit_price  boolean     not null default false,
  col_quantity    boolean     not null default false,
  col_price       boolean     not null default true,

  -- Lifecycle
  status          text        not null default 'draft',
  -- draft | sent | viewed | signed | declined | expired

  -- Public portal link (256-bit random token)
  portal_token    text        unique default encode(gen_random_bytes(32), 'hex'),

  sent_at         timestamptz,
  viewed_at       timestamptz,
  expires_at      date,
  signed_at       timestamptz,
  signer_name     text,
  signer_email    text,

  created_by      uuid        references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table proposals enable row level security;

create policy "tenant staff select proposals" on proposals for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert proposals" on proposals for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff update proposals" on proposals for update
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete proposals" on proposals for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index proposals_tenant_id_idx    on proposals(tenant_id);
create index proposals_lead_id_idx      on proposals(lead_id);
create index proposals_portal_token_idx on proposals(portal_token);

create trigger proposals_updated_at before update on proposals
  for each row execute function set_updated_at();

-- ── proposal_line_items ────────────────────────────────────────────────────

create table proposal_line_items (
  id               uuid         primary key default gen_random_uuid(),
  proposal_id      uuid         not null references proposals(id) on delete cascade,
  tenant_id        uuid         not null,
  sort_order       int          not null default 0,
  item_name        text         not null default '',
  description      text         not null default '',
  unit_price_cents bigint       not null default 0,
  quantity         numeric(10,2) not null default 1,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

alter table proposal_line_items enable row level security;

create policy "tenant staff select proposal_line_items" on proposal_line_items for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert proposal_line_items" on proposal_line_items for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff update proposal_line_items" on proposal_line_items for update
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete proposal_line_items" on proposal_line_items for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index proposal_line_items_proposal_id_idx on proposal_line_items(proposal_id);

create trigger proposal_line_items_updated_at before update on proposal_line_items
  for each row execute function set_updated_at();

-- ── proposal_line_item_templates ──────────────────────────────────────────

create table proposal_line_item_templates (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null,
  item_name        text        not null,
  description      text        not null default '',
  unit_price_cents bigint      not null default 0,
  sort_order       int         not null default 0,
  category         text        not null default 'custom',
  -- pricing | terms | warranty | legal | custom
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table proposal_line_item_templates enable row level security;

create policy "tenant staff select proposal_line_item_templates" on proposal_line_item_templates for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert proposal_line_item_templates" on proposal_line_item_templates for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff update proposal_line_item_templates" on proposal_line_item_templates for update
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete proposal_line_item_templates" on proposal_line_item_templates for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index proposal_line_item_templates_tenant_id_idx on proposal_line_item_templates(tenant_id);

create trigger proposal_line_item_templates_updated_at before update on proposal_line_item_templates
  for each row execute function set_updated_at();

-- ── Public portal RPCs (security definer — bypass RLS via token) ──────────

-- Fetch a proposal by public token (no auth required)
create or replace function get_proposal_by_token(p_token text)
returns table (
  id              uuid,
  tenant_id       uuid,
  lead_id         uuid,
  title           text,
  proposal_number text,
  client_name     text,
  client_email    text,
  job_address     text,
  job_city        text,
  job_state       text,
  job_zip         text,
  intro_text      text,
  closeout_text   text,
  col_item        boolean,
  col_description boolean,
  col_unit_price  boolean,
  col_quantity    boolean,
  col_price       boolean,
  status          text,
  portal_token    text,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  expires_at      date,
  signed_at       timestamptz,
  signer_name     text,
  signer_email    text,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql security definer as $$
  select id, tenant_id, lead_id, title, proposal_number,
         client_name, client_email, job_address, job_city, job_state, job_zip,
         intro_text, closeout_text,
         col_item, col_description, col_unit_price, col_quantity, col_price,
         status, portal_token, sent_at, viewed_at, expires_at,
         signed_at, signer_name, signer_email, created_at, updated_at
    from proposals
   where portal_token = p_token;
$$;

-- Fetch ordered line items for a proposal by public token
create or replace function get_proposal_line_items_by_token(p_token text)
returns table (
  id               uuid,
  proposal_id      uuid,
  sort_order       int,
  item_name        text,
  description      text,
  unit_price_cents bigint,
  quantity         numeric
)
language sql security definer as $$
  select pli.id, pli.proposal_id, pli.sort_order,
         pli.item_name, pli.description, pli.unit_price_cents, pli.quantity
    from proposal_line_items pli
    join proposals p on p.id = pli.proposal_id
   where p.portal_token = p_token
   order by pli.sort_order;
$$;

-- Mark proposal as viewed on first open
create or replace function record_proposal_view(p_token text)
returns void language plpgsql security definer as $$
begin
  update proposals
     set status    = case when status = 'sent' then 'viewed' else status end,
         viewed_at = coalesce(viewed_at, now())
   where portal_token = p_token
     and status in ('sent', 'viewed');
end;
$$;

-- Sign a proposal by token
create or replace function sign_proposal_by_token(
  p_token        text,
  p_signer_name  text,
  p_signer_email text
) returns void language plpgsql security definer as $$
begin
  update proposals
     set status       = 'signed',
         signed_at    = now(),
         signer_name  = p_signer_name,
         signer_email = p_signer_email
   where portal_token = p_token
     and status in ('sent', 'viewed');

  if not found then
    raise exception 'Proposal not found or not available for signing';
  end if;
end;
$$;
