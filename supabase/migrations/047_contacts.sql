-- ============================================================================
-- 047_contacts.sql
--
-- Reusable contact records that can be linked to leads and projects.
-- A contact represents a person / company in the pre-sales phase.
-- ============================================================================

-- Drop and recreate cleanly (safe — no data in a fresh deployment)
drop table if exists contacts cascade;

create table contacts (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null,
  first_name  text        not null,
  last_name   text,
  email       text,
  phone       text,
  company     text,
  address     text,
  city        text,
  state       text,
  zip         text,
  notes       text,
  created_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table contacts enable row level security;

create policy "tenant staff select contacts" on contacts for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff insert contacts" on contacts for insert
  with check (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff update contacts" on contacts for update
  using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant staff delete contacts" on contacts for delete
  using (tenant_id in (select get_user_tenant_ids()));

create index contacts_tenant_id_idx on contacts(tenant_id);
create index contacts_email_idx     on contacts(tenant_id, email);
