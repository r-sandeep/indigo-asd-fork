-- migration: 036_worker_daily_reports
--
-- Extends daily_logs to support a three-tier daily reporting workflow:
--
--   field_associate / field_super → submit an INTERNAL work report at clock-out
--   subcontractor                 → submit their own INTERNAL work report
--   project_manager+              → review all internal reports and author a
--                                   client-facing SUMMARY with selected photos
--
-- Key changes:
--   1. Add log_type column (summary | field_associate | subcontractor)
--   2. Replace the single UNIQUE(project_id, date) constraint with two partial
--      unique indexes so multiple workers can log on the same date
--   3. Tighten RLS so workers only see their own internal reports
--      (PM+ still see everything via the existing field_super policy)
--   4. Allow field_associate and subcontractor to INSERT documents of type='photo'

-- ── 1. log_type column ────────────────────────────────────────────────────────

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS log_type text NOT NULL DEFAULT 'summary'
  CHECK (log_type IN ('summary', 'field_associate', 'subcontractor'));

-- Back-fill: every row created before this migration is a PM summary
UPDATE daily_logs SET log_type = 'summary' WHERE log_type = 'summary'; -- no-op, satisfies NOT NULL

COMMENT ON COLUMN daily_logs.log_type IS
  'summary = PM-authored client-facing log; '
  'field_associate / subcontractor = internal worker report (not client-visible)';

-- ── 2. Unique constraints ─────────────────────────────────────────────────────

-- Drop the old single-log-per-day constraint.
-- Wrapped in a DO block to guarantee Postgres executes ALTER TABLE … DROP CONSTRAINT
-- (not DROP INDEX) even if the migration runner reinterprets bare DDL statements.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname    = 'daily_logs_project_id_date_key'
       AND conrelid   = 'daily_logs'::regclass
  ) THEN
    ALTER TABLE daily_logs DROP CONSTRAINT daily_logs_project_id_date_key;
  END IF;
END $$;

-- One SUMMARY per project per day (client-facing log)
CREATE UNIQUE INDEX IF NOT EXISTS daily_logs_one_summary_per_day
  ON daily_logs (project_id, date)
  WHERE log_type = 'summary';

-- One INTERNAL REPORT per worker per project per day
CREATE UNIQUE INDEX IF NOT EXISTS daily_logs_one_report_per_worker_per_day
  ON daily_logs (project_id, date, author_id)
  WHERE log_type IN ('field_associate', 'subcontractor');

-- ── 3. RLS: daily_logs ────────────────────────────────────────────────────────

-- Drop the old broad policy that let all tenant members see ALL logs
DROP POLICY IF EXISTS "tenant members view daily logs" ON daily_logs;

-- Summary logs are visible to all tenant members (read-only for non-PM)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_logs'
      AND policyname = 'tenant members view summary logs'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "tenant members view summary logs" ON daily_logs
        FOR SELECT USING (
          log_type = 'summary'
          AND tenant_id IN (SELECT get_user_tenant_ids())
        )
    $p$;
  END IF;
END $$;

-- Workers can see ONLY their own internal reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_logs'
      AND policyname = 'workers view own reports'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "workers view own reports" ON daily_logs
        FOR SELECT USING (
          log_type IN ('field_associate', 'subcontractor')
          AND author_id = auth.uid()
          AND tenant_id IN (SELECT get_user_tenant_ids())
        )
    $p$;
  END IF;
END $$;

-- Workers can insert/update/delete their OWN internal reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_logs'
      AND policyname = 'workers submit own daily reports'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "workers submit own daily reports" ON daily_logs
        FOR ALL USING (
          log_type IN ('field_associate', 'subcontractor')
          AND author_id = auth.uid()
          AND tenant_id IN (SELECT get_user_tenant_ids())
        )
    $p$;
  END IF;
END $$;

-- ── 4. RLS: documents — allow workers to upload photos ────────────────────────
-- The existing "field supers can upload" policy covers field_super+.
-- This new policy extends upload rights to field_associate and subcontractor
-- for documents of type='photo' only (daily-report photos).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents'
      AND policyname = 'workers upload report photos'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "workers upload report photos" ON documents
        FOR INSERT WITH CHECK (
          type = 'photo'
          AND tenant_id IN (SELECT get_user_tenant_ids())
        )
    $p$;
  END IF;
END $$;
