-- ============================================================
-- Indigo Migration 003: Projects
-- `projects` extends BB's `jobs` with the Indigo operational layer.
-- Rule: every Indigo project links to exactly one BB job.
-- BB `jobs` remains the financial source of truth.
-- Indigo `projects` holds the construction management data.
-- ============================================================

-- ── Projects ──────────────────────────────────────────────────
-- One-to-one extension of jobs. The job_id FK is the bridge.
-- When creating a project in Indigo, a job is first created (or
-- linked) in BB, then this row is created.

create table projects (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  job_id          uuid not null unique references jobs(id),
  -- All financial data (contract value, status, customer) lives on jobs.
  -- All construction management data lives here.
  created_by      uuid references user_profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- NOTE: The following columns that were on Indigo's `projects` in the
-- original design now live directly on `jobs` (via migration 001):
--   address, city, state, zip, apn, project_type, target_completion,
--   permit_number, has_construction_loan, lender_name, pm_user_id,
--   superintendent_user_id, package_name, tags, internal_notes
--
-- Indigo queries the full project picture by joining:
--   projects JOIN jobs ON jobs.id = projects.job_id
--   JOIN customers ON customers.id = jobs.customer_id

-- ── Project Members ────────────────────────────────────────────

create table project_members (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  user_id         uuid not null references user_profiles(id),
  role            text not null,    -- 'foreman', 'estimator', 'designer', 'inspector'
  created_at      timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ── Project Phases ─────────────────────────────────────────────

create type phase_status as enum (
  'not_started', 'in_progress', 'complete', 'approved', 'blocked'
);

create table project_phases (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  sequence        integer not null,
  start_date      date,
  end_date        date,
  status          phase_status not null default 'not_started',
  color           text,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Milestones ─────────────────────────────────────────────────

create table milestones (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references projects(id) on delete cascade,
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  phase_id                  uuid references project_phases(id),
  name                      text not null,
  description               text,
  due_date                  date,
  completed_date            date,
  status                    phase_status not null default 'not_started',
  sequence                  integer not null default 0,
  is_client_visible         boolean not null default true,
  requires_client_approval  boolean not null default false,
  client_approved_at        timestamptz,
  client_approved_by        uuid references user_profiles(id),
  triggers_draw_request     boolean not null default false,
  triggers_invoice          boolean not null default false,
  linked_draw_id            uuid,   -- FK added after draw_requests (migration 009)
  linked_invoice_id         uuid,   -- FK to invoices.id (BB table — add as nullable)
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Backfill invoices.milestone_id FK constraint now that milestones table exists
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_milestone_id_fkey'
  ) then
    alter table invoices
      add constraint invoices_milestone_id_fkey
      foreign key (milestone_id) references milestones(id);
  end if;
end $$;

-- ── Schedule Items (Gantt) ─────────────────────────────────────

create type schedule_item_type as enum (
  'task', 'milestone', 'phase_summary', 'procurement'
);

create type task_status as enum (
  'not_started', 'in_progress', 'complete', 'blocked', 'cancelled'
);

create table schedule_items (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  tenant_id           uuid not null references tenants(id) on delete cascade,
  phase_id            uuid references project_phases(id),
  milestone_id        uuid references milestones(id),
  type                schedule_item_type not null default 'task',
  name                text not null,
  description         text,
  planned_start       date,
  planned_end         date,
  actual_start        date,
  actual_end          date,
  duration_days       integer,
  assigned_to         uuid references user_profiles(id),
  assigned_trade      text,
  -- Link to BB's subcontractors table
  subcontractor_id    uuid references subcontractors(id),
  status              task_status not null default 'not_started',
  percent_complete    integer not null default 0
                      check (percent_complete between 0 and 100),
  sequence            integer not null default 0,
  indent_level        integer not null default 0,
  is_collapsed        boolean not null default false,
  color               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table task_dependencies (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  task_id         uuid not null references schedule_items(id) on delete cascade,
  depends_on_id   uuid not null references schedule_items(id) on delete cascade,
  lag_days        integer not null default 0,
  constraint no_self_dependency check (task_id != depends_on_id),
  unique (task_id, depends_on_id)
);

-- ── Project Templates ──────────────────────────────────────────

create table project_templates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,  -- null = system default
  name            text not null,
  project_type    text not null,
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table template_phases (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references project_templates(id) on delete cascade,
  name            text not null,
  sequence        integer not null,
  duration_days   integer not null
);

create table template_tasks (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references project_templates(id) on delete cascade,
  phase_id              uuid references template_phases(id),
  name                  text not null,
  duration_days         integer not null,
  assigned_trade        text,
  sequence              integer not null,
  indent_level          integer not null default 0,
  depends_on_sequence   integer
);

-- ── Indexes ───────────────────────────────────────────────────

create index on projects(tenant_id);
create index on projects(job_id);
create index on project_phases(project_id);
create index on milestones(project_id, status);
create index on milestones(due_date);
create index on schedule_items(project_id, status);
create index on schedule_items(phase_id);
create index on schedule_items(assigned_to);
create index on schedule_items(planned_start, planned_end);
create index on task_dependencies(task_id);
create index on task_dependencies(depends_on_id);

-- Triggers
create trigger set_updated_at before update on projects for each row execute function set_updated_at();
create trigger set_updated_at before update on project_phases for each row execute function set_updated_at();
create trigger set_updated_at before update on milestones for each row execute function set_updated_at();
create trigger set_updated_at before update on schedule_items for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_phases enable row level security;
alter table milestones enable row level security;
alter table schedule_items enable row level security;
alter table task_dependencies enable row level security;
alter table project_templates enable row level security;
alter table template_phases enable row level security;
alter table template_tasks enable row level security;

-- Helper: can the current user access this project?
-- (tenant member OR client whose portal_user_id matches the job's customer)
create or replace function can_access_project(proj_id uuid)
returns boolean language plpgsql security definer stable as $$
declare
  t_id uuid;
  j_id uuid;
begin
  select tenant_id, job_id into t_id, j_id
  from projects where id = proj_id;

  if t_id in (select get_user_tenant_ids()) then return true; end if;
  if is_client_on_job(j_id) then return true; end if;
  return false;
end;
$$;

create policy "tenant members view projects" on projects
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "clients view their project" on projects
  for select using (is_client_on_job(job_id));

create policy "pm and above manage projects" on projects
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "project access for phases" on project_phases
  for select using (can_access_project(project_id));

create policy "pm and above manage phases" on project_phases
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "project access for milestones" on milestones
  for select using (can_access_project(project_id));

create policy "pm and above manage milestones" on milestones
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "project access for schedule" on schedule_items
  for select using (can_access_project(project_id));

create policy "pm and above manage schedule" on schedule_items
  for all using (user_has_role(tenant_id, 'project_manager'));

create policy "field supers update schedule items" on schedule_items
  for update using (user_has_role(tenant_id, 'field_super'));
