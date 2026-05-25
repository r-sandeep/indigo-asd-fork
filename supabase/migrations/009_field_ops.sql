-- ============================================================
-- Indigo Migration 009: Field Operations
-- subcontractor_trades, time_entries, gps_checkins,
-- punch_list_items, warranty_claims
-- FKs to BB's subcontractors, jobs, customers
-- ============================================================

create type punch_priority as enum ('low', 'normal', 'high', 'blocking');
create type punch_status   as enum ('open', 'in_progress', 'ready_for_review', 'closed', 'void');
create type warranty_status as enum (
  'submitted', 'acknowledged', 'scheduled', 'in_progress',
  'resolved', 'denied', 'escalated'
);

-- ── Subcontractor Trades ───────────────────────────────────────
-- Extends BB's subcontractors with trade specialization detail.

create table subcontractor_trades (
  id                  uuid primary key default gen_random_uuid(),
  subcontractor_id    uuid not null references subcontractors(id) on delete cascade,
  tenant_id           uuid not null references tenants(id) on delete cascade,
  trade               text not null,
  is_primary          boolean not null default false,
  hourly_rate_cents   bigint,
  notes               text,
  unique (subcontractor_id, trade)
);

-- ── Time Entries ───────────────────────────────────────────────
-- Field labor hours per job. Linked to BB jobs (not Indigo projects)
-- because labor cost flows to BB's job costing via expense_items.

create table time_entries (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  job_id          uuid not null references jobs(id) on delete cascade,
  project_id      uuid references projects(id),
  user_id         uuid not null references user_profiles(id),
  date            date not null,
  hours           numeric(6,2) not null,
  trade           text,
  description     text,
  is_billable     boolean not null default true,
  -- Link to BB expense_items when this labor is billed
  expense_item_id uuid references expense_items(id),
  approved_by     uuid references user_profiles(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ── GPS Check-ins ──────────────────────────────────────────────

create table gps_checkins (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  job_id           uuid not null references jobs(id),
  project_id       uuid references projects(id),
  user_id          uuid not null references user_profiles(id),
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  accuracy_meters  numeric(8,2),
  checked_in_at    timestamptz not null default now(),
  checked_out_at   timestamptz,
  device_id        text,
  note             text
);

-- ── Punch List ────────────────────────────────────────────────

create table punch_list_items (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  project_id          uuid not null references projects(id) on delete cascade,
  title               text not null,
  description         text,
  location            text,
  trade               text,
  assigned_to         uuid references user_profiles(id),
  subcontractor_id    uuid references subcontractors(id),
  priority            punch_priority not null default 'normal',
  status              punch_status not null default 'open',
  due_date            date,
  closed_at           timestamptz,
  photo_ids           uuid[] not null default '{}',
  created_by          uuid references user_profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Warranty Claims ────────────────────────────────────────────
-- Post-completion. Clients submit via portal; PM dispatches.
-- FK to BB's customers (not Indigo contacts).

create table warranty_claims (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  project_id            uuid not null references projects(id) on delete cascade,
  customer_id           uuid not null references customers(id),   -- BB customers table
  title                 text not null,
  description           text not null,
  category              text,
  location              text,
  status                warranty_status not null default 'submitted',
  priority              punch_priority not null default 'normal',
  assigned_to           uuid references user_profiles(id),
  subcontractor_id      uuid references subcontractors(id),
  submitted_at          timestamptz not null default now(),
  scheduled_date        date,
  resolved_at           timestamptz,
  resolution_notes      text,
  cost_to_repair_cents  bigint,
  is_billable_to_sub    boolean not null default false,
  photo_ids             uuid[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on subcontractor_trades(subcontractor_id);
create index on subcontractor_trades(tenant_id, trade);
create index on time_entries(tenant_id, job_id);
create index on time_entries(user_id, date desc);
create index on gps_checkins(job_id, checked_in_at desc);
create index on gps_checkins(user_id);
create index on punch_list_items(project_id, status);
create index on punch_list_items(assigned_to);
create index on warranty_claims(project_id, status);
create index on warranty_claims(customer_id);

create trigger set_updated_at before update on punch_list_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on warranty_claims
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table subcontractor_trades enable row level security;
alter table time_entries          enable row level security;
alter table gps_checkins          enable row level security;
alter table punch_list_items      enable row level security;
alter table warranty_claims       enable row level security;

create policy "tenant members view sub trades" on subcontractor_trades
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage sub trades" on subcontractor_trades
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view time entries" on time_entries
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "field supers log time" on time_entries
  for insert with check (user_has_role(tenant_id, 'field_super'));

create policy "users view own time entries" on time_entries
  for select using (user_id = auth.uid());

create policy "pm and above manage time entries" on time_entries
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view checkins" on gps_checkins
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant members view punch list" on punch_list_items
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and field supers manage punch list" on punch_list_items
  for all using (user_has_role(tenant_id, 'field_super'));

create policy "tenant members view warranty claims" on warranty_claims
  for select using (tenant_id in (select get_user_tenant_ids()));

-- Clients can submit and track their own warranty claims
create policy "clients manage own warranty claims" on warranty_claims
  for all using (
    customer_id in (select id from customers where portal_user_id = auth.uid())
  );

create policy "pm and above manage all warranty claims" on warranty_claims
  for all using (user_has_role(tenant_id, 'project_manager'));
