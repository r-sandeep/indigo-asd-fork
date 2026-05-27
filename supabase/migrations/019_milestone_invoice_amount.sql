-- ============================================================
-- Migration 019 — Milestone invoice amount
-- Adds invoice_amount_cents to milestones so PMs can specify
-- the billing amount for each invoice-trigger milestone.
-- No structural changes to invoices — the existing
-- invoices.milestone_id FK is used to derive "invoiced" state.
-- ============================================================

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS invoice_amount_cents int;

COMMENT ON COLUMN milestones.invoice_amount_cents IS
  'PM-configured billing amount for this milestone when it triggers an invoice. '
  'NULL means no amount has been set yet.';
