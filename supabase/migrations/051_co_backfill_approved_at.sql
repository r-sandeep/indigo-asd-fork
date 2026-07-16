-- ============================================================================
-- 051_co_backfill_approved_at.sql
--
-- Idempotent migration to ensure job_change_orders.approved_at (timestamptz)
-- exists and to backfill it from the legacy date_approved (date) column
-- when present. This preserves the legacy date_approved column and is safe
-- to run multiple times.
-- ============================================================================

-- Add the timestamptz column if the deployment doesn't already have it.
alter table job_change_orders
  add column if not exists approved_at timestamptz;

-- Backfill approved_at from legacy date_approved where appropriate.
-- Cast the date (without timezone) to timestamptz at midnight UTC to
-- preserve the original date semantics.
update job_change_orders
   set approved_at = (date_approved::timestamptz)
 where approved_at is null
   and date_approved is not null;

-- No-op if columns/values already present; safe to run repeatedly.
