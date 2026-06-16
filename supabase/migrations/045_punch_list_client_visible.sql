-- Migration 045: Client-visible punch list items
-- Adds is_client_visible flag and client_notes to punch_list_items,
-- a portal SELECT policy, and a security-definer RPC for client note writes.

ALTER TABLE punch_list_items
  ADD COLUMN is_client_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN client_notes       text;

-- ── Portal RLS ──────────────────────────────────────────────────────────────
-- Allows portal customers to read items the PM has flagged as client-facing.

CREATE POLICY "portal clients view client punch items" ON punch_list_items
  FOR SELECT USING (
    is_client_visible = true
    AND project_id IN (
      SELECT p.id FROM projects p WHERE is_client_on_job(p.job_id)
    )
  );

-- ── Portal update RPC ───────────────────────────────────────────────────────
-- Security-definer so clients can only write client_notes, nothing else.

CREATE OR REPLACE FUNCTION portal_update_punch_notes(
  p_item_id uuid,
  p_notes   text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job_id uuid;
BEGIN
  SELECT p.job_id INTO v_job_id
  FROM punch_list_items pli
  JOIN projects p ON p.id = pli.project_id
  WHERE pli.id = p_item_id AND pli.is_client_visible = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or not client-visible';
  END IF;

  IF NOT is_client_on_job(v_job_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE punch_list_items
  SET client_notes = p_notes, updated_at = now()
  WHERE id = p_item_id;
END;
$$;
