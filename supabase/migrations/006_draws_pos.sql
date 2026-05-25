-- ============================================================
-- Indigo Migration 006: Draw Schedules & Purchase Orders
-- draw_schedules, draw_requests, purchase_orders, retainage_releases
-- FKs to BB's jobs, subcontractors, subcontracts, vendors
-- ============================================================

create type draw_status as enum (
  'draft', 'submitted', 'lender_reviewing', 'approved', 'funded', 'rejected'
);

create type po_status as enum (
  'draft', 'sent', 'acknowledged', 'partially_received', 'complete', 'void'
);

-- ── Draw Schedules ─────────────────────────────────────────────

create table draw_schedules (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  job_id            uuid not null unique references jobs(id) on delete cascade,
  lender_name       text,
  lender_contact    text,
  lender_email      text,
  loan_amount_cents bigint,
  holdback_pct      numeric(5,2) not null default 10,
  created_at        timestamptz not null default now()
);

-- ── Draw Requests ──────────────────────────────────────────────

create table draw_requests (
  id                       uuid primary key default gen_random_uuid(),
  draw_schedule_id         uuid not null references draw_schedules(id) on delete cascade,
  tenant_id                uuid not null references tenants(id) on delete cascade,
  job_id                   uuid not null references jobs(id),
  number                   integer not null,
  status                   draw_status not null default 'draft',
  amount_requested_cents   bigint not null default 0,
  amount_approved_cents    bigint not null default 0,
  amount_funded_cents      bigint not null default 0,
  percent_complete_at_draw integer,
  submitted_at             timestamptz,
  approved_at              timestamptz,
  funded_at                timestamptz,
  lender_reference         text,
  notes                    text,
  pdf_document_id          uuid references documents(id),
  created_by               uuid references user_profiles(id),
  created_at               timestamptz not null default now(),
  unique (draw_schedule_id, number)
);

-- Resolve forward FK from milestones (migration 003)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'milestones_linked_draw_fkey'
  ) then
    alter table milestones
      add constraint milestones_linked_draw_fkey
      foreign key (linked_draw_id) references draw_requests(id);
  end if;
end $$;

-- Resolve forward FK on invoices (migration 001 added the column)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_draw_request_fkey'
  ) then
    alter table invoices
      add constraint invoices_draw_request_fkey
      foreign key (draw_request_id) references draw_requests(id);
  end if;
end $$;

-- ── Purchase Orders ────────────────────────────────────────────
-- budget_line_item_id FK is deferred to a DO block below so this
-- migration succeeds even if 005 had a partial failure.

create table purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  subcontractor_id    uuid references subcontractors(id),
  vendor_id           uuid references vendors(id),
  subcontract_id      uuid references subcontracts(id),
  budget_line_item_id uuid,                            -- FK added below via DO block
  number              text not null,
  status              po_status not null default 'draft',
  description         text not null,
  scope_of_work       text,
  total_cents         bigint not null default 0,
  retention_pct       numeric(5,2) not null default 0,
  start_date          date,
  end_date            date,
  issued_at           timestamptz,
  acknowledged_at     timestamptz,
  notes               text,
  document_id         uuid references documents(id),
  created_by          uuid references user_profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Add FK to budget_line_items only if that table exists (migration 005)
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'budget_line_items'
  ) then
    if not exists (
      select 1 from pg_constraint where conname = 'purchase_orders_budget_line_item_fkey'
    ) then
      alter table purchase_orders
        add constraint purchase_orders_budget_line_item_fkey
        foreign key (budget_line_item_id) references budget_line_items(id);
    end if;
  end if;
end $$;

-- Resolve forward FK on lien_waivers (migration 004 added the column)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'lien_waivers_po_fkey'
  ) then
    alter table lien_waivers
      add constraint lien_waivers_po_fkey
      foreign key (purchase_order_id) references purchase_orders(id);
  end if;
end $$;

-- ── Retainage Releases ─────────────────────────────────────────

create table retainage_releases (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id),
  amount_cents      bigint not null,
  released_at       date not null,
  expense_id        uuid references expenses(id),
  notes             text,
  created_at        timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on draw_schedules(tenant_id);
create index on draw_schedules(job_id);
create index on draw_requests(job_id, status);
create index on draw_requests(draw_schedule_id);
create index on purchase_orders(tenant_id, status);
create index on purchase_orders(job_id);
create index on purchase_orders(subcontractor_id);
create index on purchase_orders(vendor_id);
create index on retainage_releases(purchase_order_id);

create trigger set_updated_at before update on purchase_orders
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table draw_schedules     enable row level security;
alter table draw_requests      enable row level security;
alter table purchase_orders    enable row level security;
alter table retainage_releases enable row level security;

create policy "tenant members view draw schedules" on draw_schedules
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage draw schedules" on draw_schedules
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view draw requests" on draw_requests
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage draw requests" on draw_requests
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view pos" on purchase_orders
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage pos" on purchase_orders
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "pm and above manage retainage" on retainage_releases
  for all using (user_has_role(tenant_id, 'project_manager'));
