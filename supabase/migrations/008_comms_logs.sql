-- ============================================================
-- Indigo Migration 008: Communication & Daily Logs
-- message_threads, messages, daily_logs, daily_log_photos,
-- notifications, rfis, submittals
-- ============================================================

create type thread_type as enum (
  'general', 'rfi', 'submittal', 'selection', 'change_order',
  'daily_log', 'warranty', 'admin'
);

create type rfi_status as enum (
  'draft', 'submitted', 'under_review', 'answered', 'closed', 'void'
);

create type submittal_status as enum (
  'draft', 'submitted', 'under_review', 'approved', 'approved_as_noted',
  'revise_and_resubmit', 'rejected', 'void'
);

-- ── Message Threads ────────────────────────────────────────────

create table message_threads (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  type              thread_type not null default 'general',
  subject           text not null,
  participant_ids   uuid[] not null default '{}',   -- user_profile IDs
  is_client_visible boolean not null default false,
  linked_record_id  uuid,             -- CO ID, RFI ID, selection ID, etc.
  created_by        uuid references user_profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references message_threads(id) on delete cascade,
  tenant_id         uuid not null references tenants(id) on delete cascade,
  sender_id         uuid not null references user_profiles(id),
  body              text not null,
  attachment_ids    uuid[] not null default '{}',   -- document IDs
  read_by           jsonb not null default '{}',    -- {user_id: iso_timestamp}
  is_system_message boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ── Daily Logs ────────────────────────────────────────────────

create table daily_logs (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  project_id            uuid not null references projects(id) on delete cascade,
  date                  date not null,
  author_id             uuid not null references user_profiles(id),
  weather               text,
  temperature_f         integer,
  crew_count            integer,
  hours_worked          numeric(6,2),
  work_performed        text not null,
  materials_delivered   text,
  equipment_used        text,
  issues_or_delays      text,
  visitors              text,
  safety_incidents      text,
  -- AI-generated client-facing summary
  ai_client_summary     text,
  ai_drafted_at         timestamptz,
  is_client_visible     boolean not null default false,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (project_id, date)
);

create table daily_log_photos (
  id                uuid primary key default gen_random_uuid(),
  daily_log_id      uuid not null references daily_logs(id) on delete cascade,
  document_id       uuid not null references documents(id),
  caption           text,
  ai_caption        text,
  sequence          integer not null default 0,
  is_client_visible boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ── Notifications ─────────────────────────────────────────────

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  user_id         uuid not null references user_profiles(id),
  type            text not null,
  title           text not null,
  body            text,
  data            jsonb not null default '{}',
  action_url      text,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  sms_sent_at     timestamptz,
  email_sent_at   timestamptz,
  created_at      timestamptz not null default now()
);

-- ── RFIs ──────────────────────────────────────────────────────

create table rfis (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  project_id            uuid not null references projects(id) on delete cascade,
  number                integer not null,
  subject               text not null,
  question              text not null,
  answer                text,
  status                rfi_status not null default 'draft',
  priority              text not null default 'normal',
  submitted_by          uuid references user_profiles(id),
  assigned_to           uuid references user_profiles(id),
  due_date              date,
  submitted_at          timestamptz,
  answered_at           timestamptz,
  cost_impact_cents     bigint,
  schedule_impact_days  integer,
  document_ids          uuid[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (project_id, number)
);

-- ── Submittals ────────────────────────────────────────────────

create table submittals (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  number          text not null,
  title           text not null,
  type            text,          -- 'shop_drawing' | 'product_data' | 'sample' | 'certificate'
  spec_section    text,
  status          submittal_status not null default 'draft',
  revision        integer not null default 0,
  submitted_by    uuid references user_profiles(id),
  reviewed_by     uuid references user_profiles(id),
  submitted_at    timestamptz,
  required_by     date,
  reviewed_at     timestamptz,
  review_notes    text,
  document_ids    uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on message_threads(project_id);
create index on message_threads(tenant_id);
create index on messages(thread_id, created_at desc);
create index on daily_logs(project_id, date desc);
create index on daily_logs(tenant_id);
create index on notifications(user_id, read_at) where read_at is null;
create index on rfis(project_id, status);
create index on rfis(due_date) where status not in ('answered','closed','void');
create index on submittals(project_id, status);

create trigger set_updated_at before update on message_threads
  for each row execute function set_updated_at();
create trigger set_updated_at before update on daily_logs
  for each row execute function set_updated_at();
create trigger set_updated_at before update on rfis
  for each row execute function set_updated_at();
create trigger set_updated_at before update on submittals
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table message_threads  enable row level security;
alter table messages          enable row level security;
alter table daily_logs        enable row level security;
alter table daily_log_photos  enable row level security;
alter table notifications     enable row level security;
alter table rfis              enable row level security;
alter table submittals        enable row level security;

create policy "thread participants can view" on message_threads
  for select using (
    tenant_id in (select get_user_tenant_ids())
    or auth.uid() = any(participant_ids)
  );

create policy "clients view client-visible threads" on message_threads
  for select using (
    is_client_visible = true and project_id in (
      select p.id from projects p where is_client_on_job(p.job_id)
    )
  );

create policy "pm and above manage threads" on message_threads
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "participants can view messages" on messages
  for select using (
    thread_id in (
      select id from message_threads
      where tenant_id in (select get_user_tenant_ids())
        or auth.uid() = any(participant_ids)
    )
  );

create policy "participants can send messages" on messages
  for insert with check (sender_id = auth.uid());

create policy "tenant members view daily logs" on daily_logs
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view published logs" on daily_logs
  for select using (
    is_client_visible = true and published_at is not null
    and project_id in (
      select p.id from projects p where is_client_on_job(p.job_id)
    )
  );

create policy "field supers manage daily logs" on daily_logs
  for all using (user_has_role(tenant_id, 'field_super'));

create policy "users view own notifications" on notifications
  for select using (user_id = auth.uid());

create policy "tenant members view rfis" on rfis
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage rfis" on rfis
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "field supers submit rfis" on rfis
  for insert with check (user_has_role(tenant_id, 'field_super'));

create policy "tenant members view submittals" on submittals
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above manage submittals" on submittals
  for all using (user_has_role(tenant_id, 'project_manager'));
