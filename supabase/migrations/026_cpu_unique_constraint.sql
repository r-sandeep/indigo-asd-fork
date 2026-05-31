-- ============================================================================
-- 026_cpu_unique_constraint.sql
--
-- Replaces the functional unique index on customer_portal_users(customer_id,
-- lower(email)) with a plain unique CONSTRAINT on (customer_id, email).
--
-- The functional index was correct for DB-level case-insensitive enforcement
-- but PostgREST's ON CONFLICT upsert cannot resolve it — it requires a
-- plain unique constraint keyed on the literal columns.
--
-- This is safe because the application always lowercases email before writing
-- (portal-invite.ts and the Vite dev proxy both do email.trim().toLowerCase()),
-- so a case-sensitive constraint on the stored value is equivalent.
-- ============================================================================

-- Drop the old functional index
drop index if exists cpu_customer_email_uniq;

-- Add a plain unique constraint with the same logical name
alter table customer_portal_users
  add constraint cpu_customer_email_uniq unique (customer_id, email);
