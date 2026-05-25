-- ============================================================
-- Indigo Migration 004: Documents & Storage
-- document_folders, documents, document_signatures, lien_waivers
-- tenant_id → tenants (BB convention)
-- ============================================================

create type document_type as enum (
  'plan', 'permit', 'contract', 'change_order', 'invoice', 'lien_waiver',
  'w9', 'insurance_cert', 'photo', 'video', 'submittal', 'rfi',
  'specification', 'warranty', 'report', 'other'
);

create type signature_status as enum (
  'pending', 'viewed', 'signed', 'declined', 'expired'
);

-- ── Document Folders ───────────────────────────────────────────

create table document_folders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  parent_id         uuid references document_folders(id),
  name              text not null,
  type              document_type,
  sequence          integer not null default 0,
  is_client_visible boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ── Documents ─────────────────────────────────────────────────

create table documents (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  folder_id         uuid references document_folders(id),
  type              document_type not null default 'other',
  name              text not null,
  description       text,
  storage_bucket    text not null default 'documents',
  storage_path      text not null,
  mime_type         text,
  file_size_bytes   bigint,
  version           integer not null default 1,
  parent_id         uuid references documents(id),
  is_client_visible boolean not null default false,
  tags              text[] not null default '{}',
  ai_summary        text,
  uploaded_by       uuid references user_profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Resolve forward FKs from migration 001
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_pdf_document_fkey'
  ) then
    alter table invoices
      add constraint invoices_pdf_document_fkey
      foreign key (pdf_document_id) references documents(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'jco_signature_document_fkey'
  ) then
    alter table job_change_orders
      add constraint jco_signature_document_fkey
      foreign key (signature_document_id) references documents(id);
  end if;
end $$;

-- ── Document Signatures ────────────────────────────────────────

create table document_signatures (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references documents(id) on delete cascade,
  tenant_id         uuid not null references tenants(id) on delete cascade,
  signer_id         uuid references user_profiles(id),
  signer_email      text,
  signer_name       text,
  status            signature_status not null default 'pending',
  token             text unique,
  token_expires_at  timestamptz,
  signed_at         timestamptz,
  declined_at       timestamptz,
  declined_reason   text,
  signature_data    text,
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

-- ── Lien Waivers ──────────────────────────────────────────────

create type lien_waiver_type as enum (
  'conditional_progress', 'unconditional_progress',
  'conditional_final',    'unconditional_final'
);

create table lien_waivers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  subcontractor_id  uuid not null references subcontractors(id),
  type              lien_waiver_type not null,
  amount_cents      bigint not null,
  through_date      date not null,
  received_at       timestamptz,
  document_id       uuid references documents(id),
  purchase_order_id uuid,           -- FK to purchase_orders added in migration 007
  created_at        timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on document_folders(tenant_id);
create index on document_folders(project_id);
create index on documents(tenant_id);
create index on documents(project_id);
create index on documents(folder_id);
create index on documents(type);
create index on documents using gin(tags);
create index on document_signatures(document_id, status);
create index on document_signatures(token);
create index on lien_waivers(project_id);
create index on lien_waivers(subcontractor_id);

create trigger set_updated_at before update on documents
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table document_folders   enable row level security;
alter table documents           enable row level security;
alter table document_signatures enable row level security;
alter table lien_waivers        enable row level security;

create policy "tenant members view folders" on document_folders
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view client-visible folders" on document_folders
  for select using (
    is_client_visible = true and project_id in (
      select p.id from projects p where is_client_on_job(p.job_id)
    )
  );

create policy "pm and above manage folders" on document_folders
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view documents" on documents
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view client-visible docs" on documents
  for select using (
    is_client_visible = true and project_id in (
      select p.id from projects p where is_client_on_job(p.job_id)
    )
  );

create policy "field supers can upload" on documents
  for insert with check (user_has_role(tenant_id, 'field_super'));

create policy "pm and above manage documents" on documents
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "signers view their requests" on document_signatures
  for select using (
    signer_id = auth.uid()
    or tenant_id in (select get_user_tenant_ids())
  );

create policy "pm and above manage lien waivers" on lien_waivers
  for all using (tenant_id in (select get_user_tenant_ids()));
