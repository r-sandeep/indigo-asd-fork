-- ============================================================
-- Indigo Migration 005: Estimates & Budgets
-- line_item_templates, estimates, estimate_sections,
-- estimate_line_items, budgets, budget_line_items
-- FKs to BB's jobs, accounts tables
-- All money: bigint cents
-- ============================================================

create type estimate_status as enum (
  'draft', 'internal_review', 'sent', 'viewed',
  'approved', 'rejected', 'expired', 'superseded'
);

create type budget_status as enum (
  'draft', 'active', 'locked', 'closed'
);

-- ── Line Item Template Library ─────────────────────────────────
-- Pre-built line items; AI uses these to auto-populate estimates.
-- FKs to BB's accounts table for GL coding.

create table line_item_templates (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references tenants(id) on delete cascade,  -- null = system default
  name                text not null,
  description         text,
  unit                text not null default 'ls',
  default_unit_cost   bigint not null default 0,    -- cents (cost to GGB)
  default_markup_pct  numeric(5,2) not null default 0,
  csi_division        text,                          -- '03_concrete', '22_plumbing', etc.
  trade               text,
  -- Link to BB chart of accounts for auto-coding
  default_account_id  uuid references accounts(id),
  tags                text[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Estimates ─────────────────────────────────────────────────
-- Pre-contract pricing documents. FK to BB's jobs (nullable —
-- estimates can also exist at the lead stage before a job is created).
-- FK to BB's customers.

create table estimates (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  job_id            uuid references jobs(id),          -- BB job (set when estimate is for active job)
  customer_id       uuid references customers(id),     -- BB customers table
  number            text not null,
  name              text not null,
  status            estimate_status not null default 'draft',
  version           integer not null default 1,
  parent_id         uuid references estimates(id),

  -- Financials — cents; recomputed from line items, cached here for fast reads
  subtotal_cents    bigint not null default 0,
  overhead_pct      numeric(5,2) not null default 0,
  overhead_cents    bigint not null default 0,
  profit_pct        numeric(5,2) not null default 0,
  profit_cents      bigint not null default 0,
  tax_pct           numeric(5,2) not null default 0,
  tax_cents         bigint not null default 0,
  total_cents       bigint not null default 0,
  margin_pct        numeric(5,2),

  valid_until       date,
  sent_at           timestamptz,
  viewed_at         timestamptz,
  approved_at       timestamptz,
  rejected_at       timestamptz,

  signature_document_id uuid references documents(id),
  notes             text,
  internal_notes    text,
  created_by        uuid references user_profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Estimate Sections ──────────────────────────────────────────

create table estimate_sections (
  id              uuid primary key default gen_random_uuid(),
  estimate_id     uuid not null references estimates(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  csi_division    text,
  sequence        integer not null default 0,
  subtotal_cents  bigint not null default 0,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ── Estimate Line Items ────────────────────────────────────────

create table estimate_line_items (
  id                uuid primary key default gen_random_uuid(),
  estimate_id       uuid not null references estimates(id) on delete cascade,
  section_id        uuid references estimate_sections(id),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  template_id       uuid references line_item_templates(id),
  -- GL coding via BB's accounts table
  account_id        uuid references accounts(id),
  description       text not null,
  quantity          numeric(12,4) not null default 1,
  unit              text not null default 'ls',
  unit_cost_cents   bigint not null default 0,     -- cost to GGB
  markup_pct        numeric(5,2) not null default 0,
  unit_price_cents  bigint not null default 0,     -- price to client
  total_cents       bigint not null default 0,
  csi_division      text,
  trade             text,
  is_allowance      boolean not null default false,
  is_optional       boolean not null default false,
  sequence          integer not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Budgets ───────────────────────────────────────────────────
-- Created from an approved estimate. Tracks budgeted vs committed vs actual.
-- The "actual" column is updated by triggers when BB expense_items are posted.

create table budgets (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  job_id                uuid not null references jobs(id) on delete cascade,
  estimate_id           uuid references estimates(id),
  name                  text not null,
  status                budget_status not null default 'active',
  total_budgeted_cents  bigint not null default 0,
  total_committed_cents bigint not null default 0,
  total_actual_cents    bigint not null default 0,
  notes                 text,
  created_by            uuid references user_profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Budget Line Items ──────────────────────────────────────────

create table budget_line_items (
  id                      uuid primary key default gen_random_uuid(),
  budget_id               uuid not null references budgets(id) on delete cascade,
  estimate_line_item_id   uuid references estimate_line_items(id),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  job_id                  uuid not null references jobs(id),
  -- GL coding via BB's accounts table
  account_id              uuid references accounts(id),
  description             text not null,
  csi_division            text,
  trade                   text,
  budgeted_cents          bigint not null default 0,
  committed_cents         bigint not null default 0,   -- from linked purchase_orders
  actual_cost_cents       bigint not null default 0,   -- from BB expense_items posted to this job
  billed_to_client_cents  bigint not null default 0,   -- from BB invoice_items
  sequence                integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── Change Order Line Items ────────────────────────────────────
-- Extends BB's job_change_orders with line-item detail.

create table change_order_line_items (
  id                    uuid primary key default gen_random_uuid(),
  -- FK to BB's job_change_orders
  job_change_order_id   uuid not null references job_change_orders(id) on delete cascade,
  budget_line_item_id   uuid references budget_line_items(id),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  account_id            uuid references accounts(id),
  description           text not null,
  quantity              numeric(12,4) not null default 1,
  unit                  text not null default 'ls',
  unit_cost_cents       bigint not null default 0,
  markup_pct            numeric(5,2) not null default 0,
  total_cents           bigint not null default 0,
  csi_division          text,
  sequence              integer not null default 0,
  created_at            timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on line_item_templates(tenant_id);
create index on estimates(tenant_id, status);
create index on estimates(job_id);
create index on estimates(customer_id);
create index on estimate_sections(estimate_id);
create index on estimate_line_items(estimate_id);
create index on estimate_line_items(section_id);
create index on budgets(tenant_id, job_id);
create index on budget_line_items(budget_id);
create index on budget_line_items(job_id);
create index on change_order_line_items(job_change_order_id);

create trigger set_updated_at before update on estimates
  for each row execute function set_updated_at();
create trigger set_updated_at before update on estimate_line_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on budgets
  for each row execute function set_updated_at();
create trigger set_updated_at before update on budget_line_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on line_item_templates
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table line_item_templates       enable row level security;
alter table estimates                  enable row level security;
alter table estimate_sections          enable row level security;
alter table estimate_line_items        enable row level security;
alter table budgets                    enable row level security;
alter table budget_line_items          enable row level security;
alter table change_order_line_items    enable row level security;

create policy "tenant members view templates" on line_item_templates
  for select using (tenant_id in (select get_user_tenant_ids()) or tenant_id is null);

create policy "pm and above manage templates" on line_item_templates
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view estimates" on estimates
  for select using (tenant_id in (select get_user_tenant_ids()));

-- Clients can view sent/approved estimates for their job
create policy "clients view approved estimates" on estimates
  for select using (
    status in ('sent','viewed','approved')
    and job_id in (select id from jobs where is_client_on_job(id))
  );

create policy "pm and above manage estimates" on estimates
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view budgets" on budgets
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage budgets" on budgets
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view budget lines" on budget_line_items
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage budget lines" on budget_line_items
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view co lines" on change_order_line_items
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage co lines" on change_order_line_items
  for all using (user_has_role(tenant_id, 'project_manager'));
