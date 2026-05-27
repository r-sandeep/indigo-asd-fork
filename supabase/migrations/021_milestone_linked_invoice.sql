-- ============================================================
-- Migration 021 — Milestone → Invoice forward linkage
--
-- ROOT CAUSE FIX: migration 001 added invoices.milestone_id so BB
-- could write the link when creating an invoice. In practice BB's
-- workflow never populates that column (BB has no knowledge of
-- Indigo milestone UUIDs), so getInvoiceTriggerMilestones always
-- returned invoice_id = null and milestones were permanently stuck
-- in the 'ready' state.
--
-- SOLUTION: add milestones.linked_invoice_id — a forward FK that
-- Indigo PMs set manually after BB creates and sends the invoice.
-- Indigo owns this column; BB never touches it.
--
-- The old invoices.milestone_id column is left in place (BB may
-- use it for future automations), but Indigo no longer queries
-- through it.
-- ============================================================

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS linked_invoice_id uuid
    REFERENCES invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN milestones.linked_invoice_id IS
  'Indigo-managed FK to the BB invoice that was raised for this '
  'invoice-trigger milestone. Set by PM after BB creates the invoice. '
  'Drives the Invoiced state in the Invoice Milestones section.';

CREATE INDEX IF NOT EXISTS milestones_linked_invoice_id_idx
  ON milestones (linked_invoice_id)
  WHERE linked_invoice_id IS NOT NULL;
