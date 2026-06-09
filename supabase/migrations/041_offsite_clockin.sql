-- ============================================================================
-- 041_offsite_clockin.sql
--
-- Supports off-site clock-in overrides for scenarios like material pickups.
-- When an employee is outside the geofence with precise GPS (normally a hard
-- block), a PM-authorized override lets them clock in and records both the
-- stated reason and whether they attested to having PM approval.
--
-- Changes:
--   1. work_sessions        — add offsite_reason, pm_purchase_approved
--   2. geofence_violations  — add offsite_reason, pm_purchase_approved
--   3. clock_in()           — new p_offsite_reason / p_pm_purchase_approved
--                             params; override converts the hard reject into
--                             a flagged-but-allowed entry
-- ============================================================================

-- ── 1. work_sessions ─────────────────────────────────────────────────────────

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS offsite_reason       text,
  ADD COLUMN IF NOT EXISTS pm_purchase_approved boolean;

-- ── 2. geofence_violations ───────────────────────────────────────────────────

ALTER TABLE geofence_violations
  ADD COLUMN IF NOT EXISTS offsite_reason       text,
  ADD COLUMN IF NOT EXISTS pm_purchase_approved boolean;

-- ── 3. clock_in() — override-aware replacement ───────────────────────────────
--
-- New optional params:
--   p_offsite_reason       — non-null signals an intentional off-site override
--   p_pm_purchase_approved — employee's self-attestation of PM authorization
--
-- Behaviour when outside the fence with precise GPS:
--   Override absent  → same as before: insert rejected violation + raise error
--   Override present → insert allowed violation (was_rejected=false) with
--                      reason/approval, create session flagged geofence_ok=false

CREATE OR REPLACE FUNCTION clock_in(
  p_project_id            uuid,
  p_lat                   float8,
  p_lng                   float8,
  p_accuracy_m            float8,
  p_offsite_reason        text    DEFAULT NULL,
  p_pm_purchase_approved  boolean DEFAULT NULL
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
           geofence_radius_m, was_rejected,
           offsite_reason, pm_purchase_approved)
        VALUES
          (v_tenant_id, v_user_id, p_project_id, 'clock_in',
           p_lat, p_lng, p_accuracy_m,
           round(v_distance::numeric, 2), v_radius, false,
           p_offsite_reason, p_pm_purchase_approved);

      ELSIF p_offsite_reason IS NOT NULL THEN
        -- Precise GPS, employee confirmed outside fence, but override supplied.
        -- Allow the clock-in; record as an approved off-site entry.
        v_geofence_ok := false;
        v_warning     := 'offsite_override';

        INSERT INTO geofence_violations
          (tenant_id, user_id, project_id, attempt_type,
           latitude, longitude, accuracy_m, distance_from_site_m,
           geofence_radius_m, was_rejected,
           offsite_reason, pm_purchase_approved)
        VALUES
          (v_tenant_id, v_user_id, p_project_id, 'clock_in',
           p_lat, p_lng, p_accuracy_m,
           round(v_distance::numeric, 2), v_radius, false,
           p_offsite_reason, p_pm_purchase_approved);

      ELSE
        -- Precise GPS, user outside fence, no override — reject
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

  -- ── Create session ───────────────────────────────────────────────────────
  INSERT INTO work_sessions
    (tenant_id, project_id, job_id, user_id,
     clock_in_lat, clock_in_lng, clock_in_accuracy_m, clock_in_geofence_ok,
     offsite_reason, pm_purchase_approved)
  VALUES
    (v_tenant_id, p_project_id, v_job_id, v_user_id,
     p_lat, p_lng, p_accuracy_m, v_geofence_ok,
     p_offsite_reason, p_pm_purchase_approved)
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id',  v_session_id,
    'geofence_ok', v_geofence_ok,
    'warning',     v_warning
  );
END;
$$;
