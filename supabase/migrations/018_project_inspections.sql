-- ============================================================
-- Migration 018 — Project Inspections
-- Adds a project_inspections table so field staff and PMs can
-- log scheduled and completed building inspections per project.
-- Permit fields already live on jobs (migration 001); this table
-- captures the individual inspection events.
-- ============================================================

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_inspections (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  project_id           uuid        NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,

  inspection_type      text        NOT NULL,        -- e.g. 'Foundation', 'Framing', 'Electrical Rough', 'Final'
  scheduled_date       date,
  completed_date       date,
  result               text        NOT NULL DEFAULT 'pending'
                                   CHECK (result IN ('pending', 'passed', 'failed', 'cancelled')),

  inspector_name       text,
  certificate_number   text,                         -- issued on pass (final / partial final)

  correction_required  boolean     NOT NULL DEFAULT false,
  correction_resolved  boolean     NOT NULL DEFAULT false,

  notes                text,

  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Index ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS project_inspections_project_id_idx
  ON project_inspections (project_id);

CREATE INDEX IF NOT EXISTS project_inspections_tenant_id_idx
  ON project_inspections (tenant_id);

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_project_inspections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_inspections_updated_at
  BEFORE UPDATE ON project_inspections
  FOR EACH ROW EXECUTE FUNCTION update_project_inspections_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE project_inspections ENABLE ROW LEVEL SECURITY;

-- Tenant members can read all inspections for their tenant
CREATE POLICY "tenant members read inspections"
  ON project_inspections FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- PM / field_super / owner / admin can insert
CREATE POLICY "pm+ insert inspections"
  ON project_inspections FOR INSERT
  WITH CHECK (
    user_has_role(tenant_id, 'field_super')
  );

-- PM / field_super / owner / admin can update
CREATE POLICY "pm+ update inspections"
  ON project_inspections FOR UPDATE
  USING (
    user_has_role(tenant_id, 'field_super')
  );

-- PM+ can delete
CREATE POLICY "pm+ delete inspections"
  ON project_inspections FOR DELETE
  USING (
    user_has_role(tenant_id, 'project_manager')
  );

-- ── Grant ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON project_inspections TO authenticated;
