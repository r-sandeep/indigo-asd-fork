-- ============================================================
-- Indigo Migration 007: Client Selections
-- selection_categories, selection_options, client_selections
-- FKs to BB's customers, jobs tables
-- ============================================================

create type selection_status as enum (
  'pending', 'client_choosing', 'selected', 'approved',
  'ordered', 'received', 'installed'
);

-- ── Selection Categories ───────────────────────────────────────
-- Each category = one decision the client must make.
-- e.g. "Master Bath Floor Tile", "Kitchen Faucet", "Cabinet Hardware"

create table selection_categories (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  phase_id          uuid references project_phases(id),
  budget_line_item_id uuid references budget_line_items(id),
  name              text not null,
  description       text,
  allowance_cents   bigint not null default 0,
  status            selection_status not null default 'pending',
  due_date          date,
  sequence          integer not null default 0,
  is_client_visible boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Selection Options ──────────────────────────────────────────
-- PM-curated list of choices for each category.

create table selection_options (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references selection_categories(id) on delete cascade,
  name              text not null,
  description       text,
  sku               text,
  vendor            text,
  vendor_url        text,
  unit_cost_cents   bigint not null default 0,    -- cost to GGB
  unit_price_cents  bigint not null default 0,    -- price to client (vs. allowance)
  lead_time_days    integer,
  image_urls        text[] not null default '{}',
  is_active         boolean not null default true,
  sequence          integer not null default 0,
  created_at        timestamptz not null default now()
);

-- ── Client Selections ──────────────────────────────────────────
-- The client's actual choice per category.
-- One row per category (unique constraint).
-- Overages link to BB's job_change_orders for billing.

create table client_selections (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references selection_categories(id) on delete cascade,
  option_id           uuid references selection_options(id),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  project_id          uuid not null references projects(id),
  customer_id         uuid not null references customers(id),   -- BB customers table
  -- Custom item (client brings their own)
  custom_description  text,
  custom_sku          text,
  custom_vendor       text,
  custom_price_cents  bigint,
  -- Overage handling
  overage_cents       bigint,
  -- Link to BB change order when overage is billed
  job_change_order_id uuid references job_change_orders(id),
  notes               text,
  selected_at         timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references user_profiles(id),
  created_at          timestamptz not null default now(),
  unique (category_id)              -- one selection per category
);

-- ── Indexes ───────────────────────────────────────────────────

create index on selection_categories(project_id, status);
create index on selection_categories(phase_id);
create index on selection_options(category_id);
create index on client_selections(project_id);
create index on client_selections(customer_id);

create trigger set_updated_at before update on selection_categories
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table selection_categories enable row level security;
alter table selection_options     enable row level security;
alter table client_selections     enable row level security;

create policy "tenant members view categories" on selection_categories
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view their selection categories" on selection_categories
  for select using (
    is_client_visible = true and project_id in (
      select p.id from projects p where is_client_on_job(p.job_id)
    )
  );

create policy "pm and above manage categories" on selection_categories
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "project access to options" on selection_options
  for select using (
    category_id in (
      select id from selection_categories
      where tenant_id in (select get_user_tenant_ids())
        or (is_client_visible and project_id in (
          select p.id from projects p where is_client_on_job(p.job_id)
        ))
    )
  );

create policy "pm and above manage options" on selection_options
  for all using (
    category_id in (
      select id from selection_categories
      where tenant_id in (select get_user_tenant_ids())
    )
  );

create policy "tenant members view client selections" on client_selections
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view and make their own selections" on client_selections
  for all using (
    customer_id in (
      select id from customers where portal_user_id = auth.uid()
    )
  );
