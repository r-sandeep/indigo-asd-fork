-- ============================================================
-- Migration 020 — Field Associate role
-- Adds 'field_associate' to the member_role enum and updates
-- the user_has_role function's role_order array so hierarchy
-- checks work correctly.
--
-- Placement in hierarchy (lowest → highest):
--   client < subcontractor < field_associate < field_super
--                          < accountant < project_manager < admin < owner
--
-- field_associate is for field tradespeople who track their
-- own hours but do not supervise crew.
-- ============================================================

-- Step 1: Add the new enum value (IF NOT EXISTS guards replay safety)
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'field_associate' AFTER 'subcontractor';

-- Step 2: Re-create user_has_role with the updated role_order array.
-- Must use CREATE OR REPLACE because the function body references the enum.
CREATE OR REPLACE FUNCTION user_has_role(t_id uuid, min_role member_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  user_role  member_role;
  role_order text[] := array[
    'client', 'subcontractor', 'field_associate', 'field_super',
    'accountant', 'project_manager', 'admin', 'owner'
  ];
BEGIN
  SELECT role INTO user_role
  FROM   tenant_members
  WHERE  tenant_id = t_id
    AND  user_id   = auth.uid()
    AND  is_active = true;

  IF user_role IS NULL THEN RETURN false; END IF;

  RETURN array_position(role_order, user_role::text)
      >= array_position(role_order, min_role::text);
END;
$$;
