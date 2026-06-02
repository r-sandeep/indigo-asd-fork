-- migration: 037_fix_role_order_and_accept_invite
--
-- 1. Fix user_has_role() — field_associate was missing from the role_order
--    array in migration 002, meaning field_associate users always got
--    user_has_role() = false, breaking every RLS policy that calls it.
--
-- 2. Add accept_my_invitations() — called from the WelcomePage after the
--    new user sets their password. Sets accepted_at = now() on every
--    pending (accepted_at IS NULL) tenant_members row for the caller.

-- ── 1. Fix role_order in user_has_role ────────────────────────────────────────

CREATE OR REPLACE FUNCTION user_has_role(t_id uuid, min_role member_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  user_role  member_role;
  role_order text[] := ARRAY[
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

-- ── 2. accept_my_invitations RPC ──────────────────────────────────────────────
-- Called client-side after the new user sets their password on the WelcomePage.
-- SECURITY DEFINER so it can write to tenant_members regardless of RLS.

CREATE OR REPLACE FUNCTION accept_my_invitations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE tenant_members
  SET    accepted_at = now()
  WHERE  user_id    = auth.uid()
    AND  accepted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION accept_my_invitations() IS
  'Sets accepted_at = now() for every pending tenant_members row belonging '
  'to the current user. Called once from the WelcomePage after password setup.';
