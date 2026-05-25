-- ============================================================
-- Indigo Migration 010: AI Layer
-- ai_conversations, ai_insights, document_embeddings,
-- ai_generated_content, ai_job_runs
-- tenant_id → tenants (BB convention)
-- ============================================================

create type insight_severity as enum ('info', 'warning', 'critical');

create type insight_type as enum (
  'budget_risk',
  'schedule_risk',
  'scope_creep',
  'margin_alert',
  'overdue_rfi',
  'overdue_milestone',
  'insurance_expiring',
  'lien_waiver_missing',
  'client_approval_needed',
  'draw_request_ready',
  'general'
);

-- ── AI Conversations ───────────────────────────────────────────
-- Full message history for every Claude API call.
-- Used for auditability, replay, and building conversation context.

create table ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  job_id          uuid references jobs(id),          -- BB jobs table
  project_id      uuid references projects(id),
  user_id         uuid references user_profiles(id),
  context_type    text not null,
  -- 'project_assistant' | 'daily_log_summary' | 'change_order_draft'
  -- | 'estimate_builder' | 'schedule_generator'
  messages        jsonb not null default '[]',        -- full conversation history array
  model           text not null default 'claude-sonnet-4-5',
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── AI Insights ────────────────────────────────────────────────
-- Generated nightly by the autonomous PM edge function.
-- Surfaced in the PM dashboard as items requiring attention.

create table ai_insights (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  job_id            uuid references jobs(id),
  project_id        uuid references projects(id),
  type              insight_type not null,
  severity          insight_severity not null default 'info',
  title             text not null,
  body              text not null,
  data              jsonb not null default '{}',
  suggested_action  text,
  acknowledged_at   timestamptz,
  acknowledged_by   uuid references user_profiles(id),
  resolved_at       timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- ── Document Embeddings ────────────────────────────────────────
-- Semantic search over project documents via pgvector.
-- Populated by a background function when documents are uploaded.

create table document_embeddings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  document_id     uuid not null references documents(id) on delete cascade,
  chunk_index     integer not null default 0,
  chunk_text      text not null,
  embedding       vector(1536),     -- OpenAI text-embedding-3-small
  model           text not null default 'text-embedding-3-small',
  created_at      timestamptz not null default now()
);

-- ── AI Generated Content Log ───────────────────────────────────
-- Tracks every piece of AI-drafted content so PMs can review
-- edit rates and we can measure AI quality over time.

create table ai_generated_content (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  job_id          uuid references jobs(id),
  project_id      uuid references projects(id),
  user_id         uuid references user_profiles(id),
  content_type    text not null,
  -- 'daily_log_summary' | 'change_order' | 'estimate'
  -- | 'schedule' | 'message' | 'rfi_answer'
  source_record_id  uuid,           -- ID of the record this was generated for
  prompt_version    text,           -- which prompt template version was used
  ai_draft          text not null,  -- what Claude produced
  final_content     text,           -- what was actually saved (after PM edits)
  was_edited        boolean,
  was_used          boolean,
  conversation_id   uuid references ai_conversations(id),
  created_at        timestamptz not null default now()
);

-- ── AI Job Runs ────────────────────────────────────────────────
-- Tracks nightly autonomous PM pg_cron job executions.

create table ai_job_runs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  job_name            text not null,
  status              text not null,   -- 'running' | 'completed' | 'failed'
  projects_scanned    integer,
  insights_generated  integer,
  error_message       text,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────

create index on ai_conversations(tenant_id, job_id);
create index on ai_conversations(user_id, created_at desc);
create index on ai_insights(tenant_id, severity) where resolved_at is null;
create index on ai_insights(job_id, type) where resolved_at is null;
create index on ai_insights(acknowledged_at) where acknowledged_at is null;
create index on document_embeddings(document_id);

-- pgvector approximate nearest-neighbor index (IVFFlat)
-- Requires at least a small number of rows before it's useful.
-- Run ANALYZE after bulk-inserting embeddings.
create index on document_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index on ai_generated_content(tenant_id, content_type);
create index on ai_job_runs(tenant_id, job_name, started_at desc);

create trigger set_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table ai_conversations      enable row level security;
alter table ai_insights            enable row level security;
alter table document_embeddings    enable row level security;
alter table ai_generated_content   enable row level security;
alter table ai_job_runs            enable row level security;

create policy "tenant members view ai conversations" on ai_conversations
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "tenant members view ai insights" on ai_insights
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "pm and above acknowledge insights" on ai_insights
  for update using (user_has_role(tenant_id, 'project_manager'));

create policy "tenant members view ai content" on ai_generated_content
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "admins view job runs" on ai_job_runs
  for select using (user_has_role(tenant_id, 'admin'));

-- ── pg_cron: Nightly Autonomous PM ────────────────────────────
-- Uncomment once the edge function is deployed.

-- select cron.schedule(
--   'indigo-nightly-pm-scan',
--   '0 6 * * *',   -- 6:00 AM UTC = 10:00 PM PST
--   $$
--     select net.http_post(
--       url    := current_setting('app.edge_function_base_url') || '/autonomous-pm',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'Content-Type', 'application/json'
--       ),
--       body   := '{}'::jsonb
--     );
--   $$
-- );
