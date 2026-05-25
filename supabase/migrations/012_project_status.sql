-- ============================================================
-- Indigo Migration 012: Add project_status to jobs
-- ADDITIVE ONLY — safe to run on production.
--
-- jobs.status is owned by BuildersBooks and has a check constraint
-- restricting it to BB's own status vocabulary (default 'Estimate').
-- Indigo needs its own status field (active/bidding/on_hold/complete)
-- that the BB constraint cannot touch — exactly the same pattern as
-- project_type vs job_type.
-- ============================================================

alter table jobs
  add column if not exists project_status text;
  -- Indigo values: 'active' | 'bidding' | 'on_hold' | 'complete' |
  --               'cancelled' | 'pending'
  -- NULL means not yet assigned an Indigo status (BB-only jobs).

comment on column jobs.project_status is
  'Indigo project lifecycle status. Separate from BB jobs.status to avoid '
  'the jobs_status_check constraint. Values: active, bidding, on_hold, '
  'complete, cancelled, pending.';

create index if not exists jobs_project_status_idx on jobs(project_status);
