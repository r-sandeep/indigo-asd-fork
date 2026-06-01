-- migration: 035_milestones_linked_invoice_fk
--
-- Root cause: milestones.linked_invoice_id was declared as a plain uuid in
-- 003_projects.sql.  Migration 021 used ADD COLUMN IF NOT EXISTS, which
-- silently skips the entire statement (including the REFERENCES clause) when
-- the column already exists.  Result: no FK constraint was ever created,
-- so PostgREST cannot resolve the invoices!linked_invoice_id embedded join
-- and the Invoice Milestones query in the Financials tab returns nothing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'milestones_linked_invoice_id_fkey'
  ) THEN
    ALTER TABLE milestones
      ADD CONSTRAINT milestones_linked_invoice_id_fkey
      FOREIGN KEY (linked_invoice_id)
      REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Partial index (only rows that are actually linked need fast lookup).
CREATE INDEX IF NOT EXISTS milestones_linked_invoice_id_idx
  ON milestones (linked_invoice_id)
  WHERE linked_invoice_id IS NOT NULL;
