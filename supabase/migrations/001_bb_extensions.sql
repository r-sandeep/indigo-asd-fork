-- ============================================================
-- Indigo Migration 001: BuildersBooks Table Extensions
-- ADDITIVE ONLY — no existing columns modified, no data touched.
-- Adds Indigo-specific columns to live BuildersBooks tables.
-- Safe to run on production BB database.
-- ============================================================

-- ── Extend: jobs ──────────────────────────────────────────────
-- BB's `jobs` is the central project entity. Indigo adds operational
-- and project-management fields on top of BB's financial fields.

alter table jobs
  add column if not exists project_type           text,
    -- 'custom_build' | 'major_remodel' | 'adu' | 'express_bathroom' |
    -- 'express_kitchen' | 'express_other' | 'commercial' | 'service_job'
  add column if not exists address_line1          text,
  add column if not exists address_line2          text,
  add column if not exists city                   text,
  add column if not exists state                  text default 'CA',
  add column if not exists zip                    text,
  add column if not exists apn                    text,           -- Assessor's Parcel Number
  add column if not exists target_completion      date,
  add column if not exists actual_completion      date,
  add column if not exists contract_value_cents   bigint,         -- original signed contract
  add column if not exists current_contract_cents bigint,         -- contract + approved COs
  add column if not exists permit_number          text,
  add column if not exists permit_issued_date     date,
  add column if not exists permit_expiry_date     date,
  add column if not exists has_construction_loan  boolean not null default false,
  add column if not exists lender_name            text,
  add column if not exists loan_amount_cents      bigint,
  add column if not exists pm_user_id             uuid,           -- references user_profiles(id)
  add column if not exists superintendent_user_id uuid,           -- references user_profiles(id)
  add column if not exists package_name           text,           -- GGB Express: 'Essential' | 'Premium' | 'Luxury'
  add column if not exists tags                   text[] not null default '{}',
  add column if not exists internal_notes         text,
  add column if not exists updated_at             timestamptz;    -- BB didn't have this on jobs

-- Backfill updated_at for existing jobs rows
update jobs set updated_at = created_at where updated_at is null;

-- ── Extend: invoices ───────────────────────────────────────────
-- BB's invoices table is well-structured. Indigo adds linkage columns
-- for milestone-triggered and draw-triggered invoices.

alter table invoices
  add column if not exists milestone_id             uuid,
    -- Will FK to milestones(id) after that table is created (migration 005)
  add column if not exists draw_request_id          uuid,
    -- Will FK to draw_requests(id) after that table is created (migration 009)
  add column if not exists stripe_payment_intent_id text,
    -- BB has stripe_session_id (Checkout Session); this is the PaymentIntent ID
    -- for direct charges. Both may be populated depending on payment flow.
  add column if not exists payment_instructions     text,
  add column if not exists pdf_document_id          uuid;
    -- Will FK to documents(id) after that table is created (migration 006)

-- ── Extend: customers ─────────────────────────────────────────
-- Add portal access and Stripe customer linkage.

alter table customers
  add column if not exists portal_user_id     uuid unique,
    -- Supabase auth.users ID — set when client is invited to the portal.
    -- Magic-link auth; this is how RLS identifies "this customer = this login".
  add column if not exists stripe_customer_id text;
    -- Stripe Customer object ID for payment links and saved payment methods.

-- ── Extend: vendors ───────────────────────────────────────────
-- Add Indigo vendor management fields.

alter table vendors
  add column if not exists contact_name      text,
  add column if not exists phone             text,
  add column if not exists website           text,
  add column if not exists payment_terms     text default 'Net 30',
  add column if not exists notes             text,
  add column if not exists is_active         boolean not null default true,
  add column if not exists updated_at        timestamptz;

update vendors set updated_at = now() where updated_at is null;

-- ── Extend: subcontractors ────────────────────────────────────
-- BB's subcontractors table likely has basic info. Indigo adds
-- compliance and rating fields needed for sub management.
-- (If BB's subcontractors columns are already different, only
--  the if not exists guard makes this safe.)

alter table subcontractors
  add column if not exists license_number    text,
  add column if not exists license_state     text default 'CA',
  add column if not exists license_expiry    date,
  add column if not exists insurance_carrier text,
  add column if not exists insurance_policy  text,
  add column if not exists insurance_expiry  date,
  add column if not exists w9_on_file        boolean not null default false,
  add column if not exists rating            numeric(3,2) check (rating between 1 and 5),
  add column if not exists rating_count      integer not null default 0,
  add column if not exists is_preferred      boolean not null default false,
  add column if not exists updated_at        timestamptz;

update subcontractors set updated_at = now() where updated_at is null;

-- ── Extend: job_change_orders ─────────────────────────────────
-- BB's CO table is intentionally simple. Indigo adds fields for
-- the richer CO workflow without breaking BB's existing queries.

alter table job_change_orders
  add column if not exists title                  text,     -- short title (BB only has description)
  add column if not exists reason                 text,     -- 'client_request' | 'unforeseen' | 'design_change'
  add column if not exists markup_pct             numeric(5,2) default 0,
  add column if not exists schedule_impact_days   integer default 0,
  add column if not exists client_viewed_at       timestamptz,
  add column if not exists approved_at            timestamptz,  -- BB has date_approved (date); this is timestamptz
  add column if not exists rejected_at            timestamptz,
  add column if not exists requested_by_user_id   uuid,     -- references user_profiles(id)
  add column if not exists approved_by_user_id    uuid,     -- references user_profiles(id)
  add column if not exists signature_document_id  uuid,     -- references documents(id)
  add column if not exists ai_drafted             boolean not null default false,
  add column if not exists updated_at             timestamptz;

update job_change_orders set updated_at = created_at where updated_at is null;

-- ── updated_at trigger function ───────────────────────────────
-- Create or replace so this is safe whether BB defined it already or not.

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Apply updated_at triggers to extended BB tables ────────────
-- Wrapped in a DO block so each trigger is only created if absent.

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_jobs_updated_at'
  ) then
    create trigger set_jobs_updated_at
      before update on jobs
      for each row execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_vendors_updated_at'
  ) then
    create trigger set_vendors_updated_at
      before update on vendors
      for each row execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_subcontractors_updated_at'
  ) then
    create trigger set_subcontractors_updated_at
      before update on subcontractors
      for each row execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_job_change_orders_updated_at'
  ) then
    create trigger set_job_change_orders_updated_at
      before update on job_change_orders
      for each row execute function set_updated_at();
  end if;
end $$;

-- ── Indexes for new columns ───────────────────────────────────

create index if not exists jobs_project_type_idx on jobs(project_type);
create index if not exists jobs_tags_idx on jobs using gin(tags);
create index if not exists customers_portal_user_id_idx on customers(portal_user_id);
create index if not exists invoices_milestone_id_idx on invoices(milestone_id);
create index if not exists invoices_draw_request_id_idx on invoices(draw_request_id);
