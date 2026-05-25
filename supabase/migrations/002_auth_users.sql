-- ============================================================
-- Indigo Migration 002: Auth & Users
-- user_profiles, organization_members (tenant-scoped).
-- Uses `tenant_id` → `tenants` to match BuildersBooks convention.
-- Does NOT create an `organizations` table — `tenants` IS that table.
-- ============================================================

create type member_role as enum (
  'owner',
  'admin',
  'project_manager',
  'field_super',
  'accountant',
  'subcontractor',
  'client'
);

-- ── User Profiles ─────────────────────────────────────────────
-- Extends Supabase auth.users. One row per authenticated user.

create table user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  avatar_url      text,
  title           text,
  twilio_opt_in   boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Tenant Members ────────────────────────────────────────────
-- Which users belong to which tenants (GGB Custom, GGB Express, etc.)
-- and what role they have.

create table tenant_members (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  user_id         uuid not null references user_profiles(id) on delete cascade,
  role            member_role not null,
  is_active       boolean not null default true,
  invited_by      uuid references user_profiles(id),
  invited_at      timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ── Notification Templates ─────────────────────────────────────

create table notification_templates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,  -- null = system default
  slug            text not null,
  channel         text not null,   -- 'sms' | 'email' | 'in_app'
  subject         text,
  body            text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (tenant_id, slug, channel)
);

-- ── Audit Log ─────────────────────────────────────────────────

create table audit_log (
  id              bigserial primary key,
  tenant_id       uuid references tenants(id),
  user_id         uuid references user_profiles(id),
  table_name      text not null,
  record_id       uuid not null,
  action          text not null,   -- 'insert' | 'update' | 'delete'
  old_values      jsonb,
  new_values      jsonb,
  ip_address      inet,
  created_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on tenant_members(tenant_id);
create index on tenant_members(user_id);
create index on audit_log(tenant_id, table_name, record_id);
create index on audit_log(created_at desc);

-- Triggers
create trigger set_updated_at before update on user_profiles
  for each row execute function set_updated_at();

-- ── RLS Helper Functions ───────────────────────────────────────
-- These functions are used by all subsequent RLS policies.
-- They use `tenants` / `tenant_id` to match BuildersBooks.

alter table user_profiles enable row level security;
alter table tenant_members enable row level security;
alter table notification_templates enable row level security;
alter table audit_log enable row level security;

-- Returns all tenant IDs the current user belongs to
create or replace function get_user_tenant_ids()
returns setof uuid language sql security definer stable as $$
  select tenant_id from tenant_members
  where user_id = auth.uid() and is_active = true;
$$;

-- Returns the current user's role in a specific tenant
create or replace function get_user_role(t_id uuid)
returns member_role language sql security definer stable as $$
  select role from tenant_members
  where tenant_id = t_id and user_id = auth.uid() and is_active = true;
$$;

-- Returns true if the current user has at least `min_role` in a tenant
create or replace function user_has_role(t_id uuid, min_role member_role)
returns boolean language plpgsql security definer stable as $$
declare
  user_role member_role;
  role_order text[] := array[
    'client','subcontractor','field_super','accountant',
    'project_manager','admin','owner'
  ];
begin
  select role into user_role from tenant_members
  where tenant_id = t_id and user_id = auth.uid() and is_active = true;
  if user_role is null then return false; end if;
  return array_position(role_order, user_role::text)
      >= array_position(role_order, min_role::text);
end;
$$;

-- Returns true if the current user is a client contact on a specific job
create or replace function is_client_on_job(j_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from jobs j
    join customers c on c.id = j.customer_id
    where j.id = j_id
      and c.portal_user_id = auth.uid()
  );
$$;

-- ── RLS Policies ──────────────────────────────────────────────

-- user_profiles: users can view their own and tenant-mates' profiles
create policy "users can view own profile" on user_profiles
  for select using (id = auth.uid());

create policy "tenant members can view each other" on user_profiles
  for select using (
    id in (
      select user_id from tenant_members
      where tenant_id in (select get_user_tenant_ids())
    )
  );

create policy "users can update own profile" on user_profiles
  for update using (id = auth.uid());

-- tenant_members: visible to members of the same tenant
create policy "members can view tenant roster" on tenant_members
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "admins can manage tenant members" on tenant_members
  for all using (user_has_role(tenant_id, 'admin'));

-- audit_log: admins can read
create policy "admins can view audit log" on audit_log
  for select using (user_has_role(tenant_id, 'admin'));
