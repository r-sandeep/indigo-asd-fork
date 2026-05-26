-- ============================================================================
-- 017_time_tracking.sql
-- Employee clock-in / clock-out with GPS geofencing, break tracking, and
-- California daily overtime rules.
--
-- New tables:   employee_wages, work_sessions, work_session_breaks,
--               geofence_violations
-- Extensions:   tenants.default_geofence_radius_meters
--               projects.site_lat, projects.site_lng,
--               projects.geofence_radius_meters
-- New enum:     session_status
-- Functions:    haversine_meters()
--               set_project_location()    (PM+ only, SECURITY DEFINER)
--               clock_in()                (SECURITY DEFINER)
--               clock_out()               (SECURITY DEFINER)
--               start_break()             (SECURITY DEFINER)
--               end_break()               (SECURITY DEFINER)
--               _compute_ca_ot()          (internal helper, IMMUTABLE)
--               auto_clockout_stale_sessions()  (cron / service call)
--
-- Business rules:
--   • Only tenant members with role NOT IN ('subcontractor','client') can clock in
--   • Geofence default 300 m (tenant-wide); overridable per project
--   • GPS accuracy > radius/2 → allow but flag (can't prove outside)
--   • Precise GPS outside fence → reject clock-in (log violation)
--   • Clock-out outside fence → log violation but NEVER block (can't trap workers)
--   • Auto-deduct 30-min break if session > 5 h and no break taken
--   • Auto clock-out at 12 h (via auto_clockout_stale_sessions cron)
--   • California daily OT:
--       Normal day:   0-8 h regular | 8-12 h @ 1.5× | > 12 h @ 2×
--       7th consec day: 0-8 h @ 1.5× | > 8 h @ 2× (no regular hours)
-- ============================================================================

-- ── 0. Extend tenants with default geofence radius ─────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_geofence_radius_meters int NOT NULL DEFAULT 300;

-- ── 1. Extend projects with site coordinates ───────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_lat               numeric(10,7),
  ADD COLUMN IF NOT EXISTS site_lng               numeric(10,7),
  ADD COLUMN IF NOT EXISTS geofence_radius_meters int;  -- NULL → use tenant default

-- ── 2. Employee Wages ──────────────────────────────────────────────────────

CREATE TABLE employee_wages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES user_profiles(id)  ON DELETE CASCADE,
  effective_date     date NOT NULL,
  hourly_rate_cents  int  NOT NULL CHECK (hourly_rate_cents > 0),
  created_by         uuid REFERENCES user_profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, effective_date)
);

-- ── 3. Session Status Enum ─────────────────────────────────────────────────

CREATE TYPE session_status AS ENUM ('active', 'on_break', 'completed', 'auto_closed');

-- ── 4. Work Sessions ───────────────────────────────────────────────────────

CREATE TABLE work_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES projects(id)       ON DELETE CASCADE,
  job_id                  uuid NOT NULL REFERENCES jobs(id),
  user_id                 uuid NOT NULL REFERENCES user_profiles(id),

  -- Clock-in
  clocked_in_at           timestamptz NOT NULL DEFAULT now(),
  clock_in_lat            numeric(10,7),
  clock_in_lng            numeric(10,7),
  clock_in_accuracy_m     numeric(8,2),
  clock_in_geofence_ok    boolean NOT NULL DEFAULT true,

  -- Clock-out (all NULL until clocked out)
  clocked_out_at          timestamptz,
  clock_out_lat           numeric(10,7),
  clock_out_lng           numeric(10,7),
  clock_out_accuracy_m    numeric(8,2),
  clock_out_geofence_ok   boolean,

  -- Break totals (populated at clock-out)
  total_break_minutes     int NOT NULL DEFAULT 0,
  auto_break_deducted     boolean NOT NULL DEFAULT false,

  -- Computed hours (populated at clock-out)
  gross_hours             numeric(6,2),
  net_hours               numeric(6,2),
  regular_hours           numeric(6,2),
  ot_1_5_hours            numeric(6,2),
  ot_2_0_hours            numeric(6,2),
  is_seventh_day          boolean NOT NULL DEFAULT false,

  -- Labor cost (populated at clock-out)
  wage_snapshot_cents     int,       -- hourly rate used for calculation
  labor_cost_cents        bigint,

  -- Status and linkage
  status                  session_status NOT NULL DEFAULT 'active',
  time_entry_id           uuid REFERENCES time_entries(id),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Work Session Breaks ─────────────────────────────────────────────────

CREATE TABLE work_session_breaks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_minutes  int,   -- computed when break ends
  break_type        text NOT NULL DEFAULT 'meal',  -- 'meal' | 'rest' | 'other'
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Geofence Violations (immutable audit log) ───────────────────────────

CREATE TABLE geofence_violations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES user_profiles(id),
  project_id            uuid NOT NULL REFERENCES projects(id),
  attempt_type          text NOT NULL,       -- 'clock_in' | 'clock_out'
  latitude              numeric(10,7) NOT NULL,
  longitude             numeric(10,7) NOT NULL,
  accuracy_m            numeric(8,2),
  distance_from_site_m  numeric(10,2) NOT NULL,
  geofence_radius_m     int NOT NULL,
  was_rejected          boolean NOT NULL DEFAULT true,
  attempted_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX ON employee_wages      (tenant_id, user_id, effective_date DESC);
CREATE INDEX ON work_sessions       (project_id, status);
CREATE INDEX ON work_sessions       (user_id, clocked_in_at DESC);
CREATE INDEX ON work_sessions       (status) WHERE status IN ('active', 'on_break');
CREATE INDEX ON work_session_breaks (session_id);
CREATE INDEX ON geofence_violations (user_id, attempted_at DESC);
CREATE INDEX ON geofence_violations (project_id, attempted_at DESC);

-- ── 8. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE employee_wages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_session_breaks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_violations  ENABLE ROW LEVEL SECURITY;

-- employee_wages: PM+ manage all; employees view their own
CREATE POLICY "pm and above manage wages" ON employee_wages
  FOR ALL USING (user_has_role(tenant_id, 'project_manager'));

CREATE POLICY "employees view own wage" ON employee_wages
  FOR SELECT USING (user_id = auth.uid());

-- work_sessions: tenant members view all; employees own sessions
CREATE POLICY "tenant members view work sessions" ON work_sessions
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "employees manage own sessions" ON work_sessions
  FOR ALL USING (user_id = auth.uid());

-- work_session_breaks: follow session ownership
CREATE POLICY "employees manage own breaks" ON work_session_breaks
  FOR ALL USING (
    session_id IN (
      SELECT id FROM work_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant members view breaks" ON work_session_breaks
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM work_sessions
      WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

-- geofence_violations: read-only for tenant members; no direct writes from clients
CREATE POLICY "tenant members view violations" ON geofence_violations
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- ── 9. haversine_meters() ──────────────────────────────────────────────────
-- Pure SQL haversine distance in metres. No PostGIS required.

CREATE OR REPLACE FUNCTION haversine_meters(
  lat1 float8, lng1 float8,
  lat2 float8, lng2 float8
) RETURNS float8 LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 2.0 * 6371000.0 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2.0), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lng2 - lng1) / 2.0), 2)
    )
  )
$$;

-- ── 10. _compute_ca_ot() ───────────────────────────────────────────────────
-- Internal helper: splits net_hours into CA overtime tiers.
-- Normal day:    0-8 h regular | 8-12 h @ 1.5× | >12 h @ 2×
-- 7th consec day: 0-8 h @ 1.5× | >8 h @ 2×   (zero regular)

CREATE OR REPLACE FUNCTION _compute_ca_ot(
  p_net_hours   numeric,
  p_seventh_day boolean
) RETURNS TABLE(regular_hours numeric, ot_1_5_hours numeric, ot_2_0_hours numeric)
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    -- Regular
    CASE WHEN p_seventh_day THEN 0::numeric
         ELSE LEAST(p_net_hours, 8.0)
    END,
    -- 1.5× overtime
    CASE WHEN p_seventh_day THEN LEAST(p_net_hours, 8.0)
         ELSE GREATEST(0, LEAST(p_net_hours, 12.0) - 8.0)
    END,
    -- 2× overtime
    CASE WHEN p_seventh_day THEN GREATEST(0, p_net_hours - 8.0)
         ELSE GREATEST(0, p_net_hours - 12.0)
    END
$$;

-- ── 11. set_project_location() ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_project_location(
  p_project_id    uuid,
  p_lat           float8,
  p_lng           float8,
  p_radius_meters int  DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  IF NOT user_has_role(v_tenant_id, 'project_manager') THEN
    RAISE EXCEPTION 'insufficient_permissions';
  END IF;

  UPDATE projects
  SET site_lat               = p_lat,
      site_lng               = p_lng,
      geofence_radius_meters = p_radius_meters   -- NULL = keep using tenant default
  WHERE id = p_project_id;
END;
$$;

-- ── 12. clock_in() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clock_in(
  p_project_id  uuid,
  p_lat         float8,
  p_lng         float8,
  p_accuracy_m  float8
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_job_id      uuid;
  v_site_lat    numeric(10,7);
  v_site_lng    numeric(10,7);
  v_radius      int;
  v_distance    float8;
  v_geofence_ok boolean := true;
  v_warning     text;
  v_session_id  uuid;
  v_user_role   member_role;
BEGIN
  -- Load project + tenant defaults
  SELECT p.tenant_id, p.job_id, p.site_lat, p.site_lng,
         COALESCE(p.geofence_radius_meters, t.default_geofence_radius_meters, 300)
  INTO   v_tenant_id, v_job_id, v_site_lat, v_site_lng, v_radius
  FROM   projects p
  JOIN   tenants  t ON t.id = p.tenant_id
  WHERE  p.id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  -- Verify caller is an active tenant member (not sub / client)
  SELECT role INTO v_user_role
  FROM   tenant_members
  WHERE  tenant_id = v_tenant_id
    AND  user_id   = v_user_id
    AND  is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_tenant_member';
  END IF;

  IF v_user_role IN ('subcontractor', 'client') THEN
    RAISE EXCEPTION 'not_eligible_to_clock_in';
  END IF;

  -- No concurrent active session on this project
  IF EXISTS (
    SELECT 1 FROM work_sessions
    WHERE  user_id    = v_user_id
      AND  project_id = p_project_id
      AND  status     IN ('active', 'on_break')
  ) THEN
    RAISE EXCEPTION 'already_clocked_in';
  END IF;

  -- ── Geofence check ──────────────────────────────────────────────────────
  IF v_site_lat IS NOT NULL AND v_site_lng IS NOT NULL THEN
    v_distance := haversine_meters(p_lat, p_lng,
                                   v_site_lat::float8, v_site_lng::float8);

    IF v_distance > v_radius THEN
      IF p_accuracy_m > (v_radius::float8 / 2.0) THEN
        -- GPS too imprecise to be certain — allow but flag
        v_geofence_ok := false;
        v_warning     := 'gps_accuracy_low';

        INSERT INTO geofence_violations
          (tenant_id, user_id, project_id, attempt_type,
           latitude, longitude, accuracy_m, distance_from_site_m,
           geofence_radius_m, was_rejected)
        VALUES
          (v_tenant_id, v_user_id, p_project_id, 'clock_in',
           p_lat, p_lng, p_accuracy_m,
           round(v_distance::numeric, 2), v_radius, false);

      ELSE
        -- Precise GPS, user confirmed outside fence — reject
        INSERT INTO geofence_violations
          (tenant_id, user_id, project_id, attempt_type,
           latitude, longitude, accuracy_m, distance_from_site_m,
           geofence_radius_m, was_rejected)
        VALUES
          (v_tenant_id, v_user_id, p_project_id, 'clock_in',
           p_lat, p_lng, p_accuracy_m,
           round(v_distance::numeric, 2), v_radius, true);

        RAISE EXCEPTION 'outside_geofence'
          USING HINT = format('distance_m=%.0f,radius_m=%s', v_distance, v_radius);
      END IF;
    END IF;
  END IF;

  -- Create session
  INSERT INTO work_sessions
    (tenant_id, project_id, job_id, user_id,
     clock_in_lat, clock_in_lng, clock_in_accuracy_m, clock_in_geofence_ok)
  VALUES
    (v_tenant_id, p_project_id, v_job_id, v_user_id,
     p_lat, p_lng, p_accuracy_m, v_geofence_ok)
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id',  v_session_id,
    'geofence_ok', v_geofence_ok,
    'warning',     v_warning
  );
END;
$$;

-- ── 13. start_break() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION start_break(
  p_session_id uuid,
  p_break_type text DEFAULT 'meal'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_break_id uuid;
BEGIN
  -- Session must belong to caller and be actively clocked in
  IF NOT EXISTS (
    SELECT 1 FROM work_sessions
    WHERE id = p_session_id AND user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'session_not_active';
  END IF;

  -- No concurrent open break
  IF EXISTS (
    SELECT 1 FROM work_session_breaks
    WHERE session_id = p_session_id AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'break_already_active';
  END IF;

  UPDATE work_sessions SET status = 'on_break' WHERE id = p_session_id;

  INSERT INTO work_session_breaks (session_id, break_type)
  VALUES (p_session_id, p_break_type)
  RETURNING id INTO v_break_id;

  RETURN jsonb_build_object('break_id', v_break_id);
END;
$$;

-- ── 14. end_break() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION end_break(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_break_id     uuid;
  v_started_at   timestamptz;
  v_duration_min int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM work_sessions
    WHERE id = p_session_id AND user_id = v_user_id AND status = 'on_break'
  ) THEN
    RAISE EXCEPTION 'session_not_on_break';
  END IF;

  SELECT id, started_at INTO v_break_id, v_started_at
  FROM   work_session_breaks
  WHERE  session_id = p_session_id AND ended_at IS NULL
  ORDER  BY started_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_open_break';
  END IF;

  v_duration_min := GREATEST(0,
    EXTRACT(EPOCH FROM (now() - v_started_at))::int / 60
  );

  UPDATE work_session_breaks
  SET    ended_at = now(), duration_minutes = v_duration_min
  WHERE  id = v_break_id;

  UPDATE work_sessions SET status = 'active' WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'break_id',         v_break_id,
    'duration_minutes', v_duration_min
  );
END;
$$;

-- ── 15. clock_out() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clock_out(
  p_session_id  uuid,
  p_lat         float8,
  p_lng         float8,
  p_accuracy_m  float8
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_session         work_sessions%ROWTYPE;
  v_site_lat        numeric(10,7);
  v_site_lng        numeric(10,7);
  v_radius          int;
  v_distance        float8;
  v_geofence_ok     boolean := true;
  v_total_break     int;
  v_auto_deducted   boolean := false;
  v_gross_hours     numeric;
  v_net_hours       numeric;
  v_is_seventh      boolean := false;
  v_consec_count    int;
  v_all_six         boolean;
  v_ot              record;
  v_wage            int;
  v_labor_cents     bigint;
  v_time_entry_id   uuid;
  v_session_date    date;
  v_now             timestamptz := now();
BEGIN
  -- ── Load session ────────────────────────────────────────────────────────
  SELECT * INTO v_session
  FROM   work_sessions
  WHERE  id = p_session_id AND user_id = v_user_id
    AND  status IN ('active', 'on_break');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  -- ── Auto-close any open break (clock-out ends the break too) ────────────
  IF v_session.status = 'on_break' THEN
    UPDATE work_session_breaks
    SET    ended_at          = v_now,
           duration_minutes  = GREATEST(0,
             EXTRACT(EPOCH FROM (v_now - started_at))::int / 60
           )
    WHERE  session_id = p_session_id AND ended_at IS NULL;

    UPDATE work_sessions SET status = 'active' WHERE id = p_session_id;
  END IF;

  -- ── Geofence check at clock-out (log, never reject) ─────────────────────
  SELECT p.site_lat, p.site_lng,
         COALESCE(p.geofence_radius_meters, t.default_geofence_radius_meters, 300)
  INTO   v_site_lat, v_site_lng, v_radius
  FROM   projects p
  JOIN   tenants  t ON t.id = p.tenant_id
  WHERE  p.id = v_session.project_id;

  IF v_site_lat IS NOT NULL AND v_site_lng IS NOT NULL THEN
    v_distance := haversine_meters(p_lat, p_lng,
                                   v_site_lat::float8, v_site_lng::float8);
    IF v_distance > v_radius THEN
      v_geofence_ok := false;
      INSERT INTO geofence_violations
        (tenant_id, user_id, project_id, attempt_type,
         latitude, longitude, accuracy_m, distance_from_site_m,
         geofence_radius_m, was_rejected)
      VALUES
        (v_session.tenant_id, v_user_id, v_session.project_id, 'clock_out',
         p_lat, p_lng, p_accuracy_m,
         round(v_distance::numeric, 2), v_radius, false);
      -- was_rejected = false: we NEVER block clock-out
    END IF;
  END IF;

  -- ── Break totals ─────────────────────────────────────────────────────────
  SELECT COALESCE(SUM(duration_minutes), 0) INTO v_total_break
  FROM   work_session_breaks
  WHERE  session_id = p_session_id AND ended_at IS NOT NULL;

  -- ── Gross hours ──────────────────────────────────────────────────────────
  v_gross_hours := ROUND(
    EXTRACT(EPOCH FROM (v_now - v_session.clocked_in_at))::numeric / 3600.0,
    2
  );

  -- ── Auto-deduct 30-min lunch if >5 h worked and no break taken ───────────
  IF v_gross_hours > 5 AND v_total_break = 0 THEN
    v_total_break   := 30;
    v_auto_deducted := true;
  END IF;

  -- ── Net hours ────────────────────────────────────────────────────────────
  v_net_hours := GREATEST(0,
    ROUND(v_gross_hours - (v_total_break::numeric / 60.0), 2)
  );

  -- ── 7th consecutive day check (Pacific Time) ─────────────────────────────
  v_session_date := (v_session.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date;

  -- Count distinct worked days in the 6 calendar days immediately before today
  SELECT COUNT(DISTINCT (ws.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date)
  INTO   v_consec_count
  FROM   work_sessions ws
  WHERE  ws.user_id = v_user_id
    AND  ws.status  IN ('completed', 'auto_closed')
    AND  (ws.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date
         BETWEEN v_session_date - 6 AND v_session_date - 1;

  -- Only 7th day if each of those 6 prior calendar days has at least one session
  IF v_consec_count = 6 THEN
    SELECT bool_and(
      EXISTS (
        SELECT 1 FROM work_sessions ws2
        WHERE  ws2.user_id = v_user_id
          AND  ws2.status  IN ('completed', 'auto_closed')
          AND  (ws2.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date
               = (v_session_date - n)
      )
    ) INTO v_is_seventh
    FROM generate_series(1, 6) AS t(n);
  END IF;

  v_is_seventh := COALESCE(v_is_seventh, false);

  -- ── California OT breakdown ──────────────────────────────────────────────
  SELECT * INTO v_ot FROM _compute_ca_ot(v_net_hours, v_is_seventh);

  -- ── Wage lookup (most recent rate effective on or before session date) ────
  SELECT hourly_rate_cents INTO v_wage
  FROM   employee_wages
  WHERE  user_id       = v_user_id
    AND  tenant_id     = v_session.tenant_id
    AND  effective_date <= v_session_date
  ORDER  BY effective_date DESC
  LIMIT  1;

  -- ── Labor cost ───────────────────────────────────────────────────────────
  IF v_wage IS NOT NULL THEN
    v_labor_cents := ROUND(
      (v_ot.regular_hours  * v_wage)
      + (v_ot.ot_1_5_hours * v_wage * 1.5)
      + (v_ot.ot_2_0_hours * v_wage * 2.0)
    )::bigint;
  END IF;

  -- ── Write time_entries row (feeds BB job costing) ────────────────────────
  INSERT INTO time_entries
    (tenant_id, job_id, project_id, user_id, date, hours, description, is_billable)
  VALUES
    (v_session.tenant_id, v_session.job_id, v_session.project_id,
     v_user_id, v_session_date, v_net_hours,
     'Work session clock-out', false)
  RETURNING id INTO v_time_entry_id;

  -- ── Close the work session ───────────────────────────────────────────────
  UPDATE work_sessions
  SET    clocked_out_at        = v_now,
         clock_out_lat         = p_lat,
         clock_out_lng         = p_lng,
         clock_out_accuracy_m  = p_accuracy_m,
         clock_out_geofence_ok = v_geofence_ok,
         total_break_minutes   = v_total_break,
         auto_break_deducted   = v_auto_deducted,
         gross_hours           = v_gross_hours,
         net_hours             = v_net_hours,
         regular_hours         = v_ot.regular_hours,
         ot_1_5_hours          = v_ot.ot_1_5_hours,
         ot_2_0_hours          = v_ot.ot_2_0_hours,
         is_seventh_day        = v_is_seventh,
         wage_snapshot_cents   = v_wage,
         labor_cost_cents      = v_labor_cents,
         status                = 'completed',
         time_entry_id         = v_time_entry_id
  WHERE  id = p_session_id;

  RETURN jsonb_build_object(
    'session_id',         p_session_id,
    'net_hours',          v_net_hours,
    'regular_hours',      v_ot.regular_hours,
    'ot_1_5_hours',       v_ot.ot_1_5_hours,
    'ot_2_0_hours',       v_ot.ot_2_0_hours,
    'labor_cost_cents',   v_labor_cents,
    'auto_break_deducted',v_auto_deducted,
    'is_seventh_day',     v_is_seventh,
    'geofence_ok',        v_geofence_ok
  );
END;
$$;

-- ── 16. auto_clockout_stale_sessions() ─────────────────────────────────────
-- Closes sessions that have been active for > 12 hours.
-- Intended to be called by a Supabase cron job or Edge Function schedule.
-- Uses clocked_in_at + 12 h as the effective clock-out time (not now()).
-- Returns the count of sessions auto-closed.

CREATE OR REPLACE FUNCTION auto_clockout_stale_sessions(
  p_project_id uuid DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session         work_sessions%ROWTYPE;
  v_closed          int := 0;
  v_effective_out   timestamptz;
  v_total_break     int;
  v_auto_deducted   boolean;
  v_gross_hours     numeric;
  v_net_hours       numeric;
  v_is_seventh      boolean;
  v_consec_count    int;
  v_all_six         boolean;
  v_ot              record;
  v_wage            int;
  v_labor_cents     bigint;
  v_time_entry_id   uuid;
  v_session_date    date;
BEGIN
  FOR v_session IN
    SELECT *
    FROM   work_sessions
    WHERE  status IN ('active', 'on_break')
      AND  clocked_in_at < now() - interval '12 hours'
      AND  (p_project_id IS NULL OR project_id = p_project_id)
  LOOP
    v_effective_out := v_session.clocked_in_at + interval '12 hours';
    v_session_date  := (v_session.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date;

    -- Close any open break (cap at effective_out)
    UPDATE work_session_breaks
    SET    ended_at          = LEAST(v_effective_out, now()),
           duration_minutes  = GREATEST(0,
             EXTRACT(EPOCH FROM (LEAST(v_effective_out, now()) - started_at))::int / 60
           )
    WHERE  session_id = v_session.id AND ended_at IS NULL;

    -- Sum break minutes
    SELECT COALESCE(SUM(duration_minutes), 0) INTO v_total_break
    FROM   work_session_breaks
    WHERE  session_id = v_session.id AND ended_at IS NOT NULL;

    -- Gross hours = exactly 12 h (the cap)
    v_gross_hours   := 12.0;
    v_auto_deducted := false;

    IF v_total_break = 0 THEN
      -- Auto-deduct always applies on a 12-h session
      v_total_break   := 30;
      v_auto_deducted := true;
    END IF;

    v_net_hours := GREATEST(0,
      ROUND(v_gross_hours - (v_total_break::numeric / 60.0), 2)
    );

    -- 7th day check
    v_is_seventh := false;

    SELECT COUNT(DISTINCT (ws.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date)
    INTO   v_consec_count
    FROM   work_sessions ws
    WHERE  ws.user_id = v_session.user_id
      AND  ws.status  IN ('completed', 'auto_closed')
      AND  (ws.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date
           BETWEEN v_session_date - 6 AND v_session_date - 1;

    IF v_consec_count = 6 THEN
      SELECT bool_and(
        EXISTS (
          SELECT 1 FROM work_sessions ws2
          WHERE  ws2.user_id = v_session.user_id
            AND  ws2.status  IN ('completed', 'auto_closed')
            AND  (ws2.clocked_in_at AT TIME ZONE 'America/Los_Angeles')::date
                 = (v_session_date - n)
        )
      ) INTO v_all_six
      FROM generate_series(1, 6) AS t(n);
      v_is_seventh := COALESCE(v_all_six, false);
    END IF;

    -- OT breakdown
    SELECT * INTO v_ot FROM _compute_ca_ot(v_net_hours, v_is_seventh);

    -- Wage
    SELECT hourly_rate_cents INTO v_wage
    FROM   employee_wages
    WHERE  user_id       = v_session.user_id
      AND  tenant_id     = v_session.tenant_id
      AND  effective_date <= v_session_date
    ORDER  BY effective_date DESC
    LIMIT  1;

    IF v_wage IS NOT NULL THEN
      v_labor_cents := ROUND(
        (v_ot.regular_hours  * v_wage)
        + (v_ot.ot_1_5_hours * v_wage * 1.5)
        + (v_ot.ot_2_0_hours * v_wage * 2.0)
      )::bigint;
    ELSE
      v_labor_cents := NULL;
    END IF;

    -- Write time_entry
    INSERT INTO time_entries
      (tenant_id, job_id, project_id, user_id, date, hours, description, is_billable)
    VALUES
      (v_session.tenant_id, v_session.job_id, v_session.project_id,
       v_session.user_id, v_session_date, v_net_hours,
       'Auto clock-out: exceeded 12-hour limit', false)
    RETURNING id INTO v_time_entry_id;

    -- Close session
    UPDATE work_sessions
    SET    clocked_out_at        = v_effective_out,
           total_break_minutes   = v_total_break,
           auto_break_deducted   = v_auto_deducted,
           gross_hours           = v_gross_hours,
           net_hours             = v_net_hours,
           regular_hours         = v_ot.regular_hours,
           ot_1_5_hours          = v_ot.ot_1_5_hours,
           ot_2_0_hours          = v_ot.ot_2_0_hours,
           is_seventh_day        = v_is_seventh,
           wage_snapshot_cents   = v_wage,
           labor_cost_cents      = v_labor_cents,
           status                = 'auto_closed',
           time_entry_id         = v_time_entry_id
    WHERE  id = v_session.id;

    v_closed := v_closed + 1;
  END LOOP;

  RETURN v_closed;
END;
$$;
