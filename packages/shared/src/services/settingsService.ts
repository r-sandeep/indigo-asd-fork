import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemberRole } from '@indigo/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string           // tenant_members.id
  user_id: string
  tenant_id: string
  role: MemberRole
  is_active: boolean
  invited_at: string | null
  accepted_at: string | null
  invited_by_name: string | null
  profile: {
    first_name: string
    last_name: string
    email: string
    phone: string | null
    avatar_url: string | null
    title: string | null
  }
}

export interface InviteResult {
  success: boolean
  /** 'added' = new member row created; 'already_member' = already in tenant */
  action?: 'added' | 'already_member'
  member?: TeamMember
  /** Returned when the email doesn't match any user_profiles row */
  notFound?: true
}

export interface UpdateMemberRoleResult {
  success: boolean
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Fetch all team members for a tenant (active + inactive), ordered by role then name. */
export async function getTeamMembers(
  client: SupabaseClient,
  tenantId: string,
): Promise<TeamMember[]> {
  const { data, error } = await (client as any)
    .from('tenant_members')
    .select(`
      id,
      user_id,
      tenant_id,
      role,
      is_active,
      invited_at,
      accepted_at,
      inviter:invited_by ( first_name, last_name ),
      profile:user_profiles!tenant_members_user_id_fkey (
        first_name,
        last_name,
        email,
        phone,
        avatar_url,
        title
      )
    `)
    .eq('tenant_id', tenantId)
    .order('role', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id:             row.id,
    user_id:        row.user_id,
    tenant_id:      row.tenant_id,
    role:           row.role as MemberRole,
    is_active:      row.is_active,
    invited_at:     row.invited_at,
    accepted_at:    row.accepted_at,
    invited_by_name: row.inviter
      ? `${row.inviter.first_name} ${row.inviter.last_name}`
      : null,
    profile: {
      first_name: row.profile?.first_name ?? '',
      last_name:  row.profile?.last_name ?? '',
      email:      row.profile?.email ?? '',
      phone:      row.profile?.phone ?? null,
      avatar_url: row.profile?.avatar_url ?? null,
      title:      row.profile?.title ?? null,
    },
  }))
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Invite a user to the tenant by email.
 *
 * Strategy (no service-role key available client-side):
 *   1. Look up user_profiles by email.
 *   2. If not found → return { notFound: true } so UI can tell the user.
 *   3. If found but already in tenant_members → return { action: 'already_member' }.
 *   4. Otherwise insert a new tenant_members row.
 *
 * The invited user will see the new tenant on their next login.
 */
export async function inviteTeamMember(
  client: SupabaseClient,
  tenantId: string,
  invitedByUserId: string,
  email: string,
  role: MemberRole,
): Promise<InviteResult> {
  // 1. Find profile
  const { data: profiles, error: profErr } = await (client as any)
    .from('user_profiles')
    .select('id, first_name, last_name, email, phone, avatar_url, title')
    .eq('email', email.trim().toLowerCase())
    .limit(1)

  if (profErr) throw profErr

  if (!profiles || profiles.length === 0) {
    return { success: false, notFound: true }
  }

  const profile = profiles[0]

  // 2. Check if already a member
  const { data: existing, error: existErr } = await (client as any)
    .from('tenant_members')
    .select('id, role, is_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', profile.id)
    .limit(1)

  if (existErr) throw existErr

  if (existing && existing.length > 0) {
    return { success: true, action: 'already_member' }
  }

  // 3. Insert
  const now = new Date().toISOString()
  const { data: inserted, error: insertErr } = await (client as any)
    .from('tenant_members')
    .insert({
      tenant_id:   tenantId,
      user_id:     profile.id,
      role,
      is_active:   true,
      invited_by:  invitedByUserId,
      invited_at:  now,
    })
    .select('id, user_id, tenant_id, role, is_active, invited_at, accepted_at')
    .single()

  if (insertErr) throw insertErr

  return {
    success: true,
    action: 'added',
    member: {
      id:             inserted.id,
      user_id:        inserted.user_id,
      tenant_id:      inserted.tenant_id,
      role:           inserted.role,
      is_active:      inserted.is_active,
      invited_at:     inserted.invited_at,
      accepted_at:    inserted.accepted_at,
      invited_by_name: null,
      profile: {
        first_name: profile.first_name,
        last_name:  profile.last_name,
        email:      profile.email,
        phone:      profile.phone ?? null,
        avatar_url: profile.avatar_url ?? null,
        title:      profile.title ?? null,
      },
    },
  }
}

/** Change a team member's role. Only owner/admin should call this. */
export async function updateTeamMemberRole(
  client: SupabaseClient,
  memberId: string,
  tenantId: string,
  newRole: MemberRole,
): Promise<void> {
  const { error } = await Promise.resolve(
    (client as any)
      .from('tenant_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('tenant_id', tenantId),
  )
  if (error) throw error
}

/** Deactivate a team member (soft-delete). */
export async function deactivateTeamMember(
  client: SupabaseClient,
  memberId: string,
  tenantId: string,
): Promise<void> {
  const { error } = await Promise.resolve(
    (client as any)
      .from('tenant_members')
      .update({ is_active: false })
      .eq('id', memberId)
      .eq('tenant_id', tenantId),
  )
  if (error) throw error
}

/** Re-activate a previously deactivated team member. */
export async function reactivateTeamMember(
  client: SupabaseClient,
  memberId: string,
  tenantId: string,
): Promise<void> {
  const { error } = await Promise.resolve(
    (client as any)
      .from('tenant_members')
      .update({ is_active: true })
      .eq('id', memberId)
      .eq('tenant_id', tenantId),
  )
  if (error) throw error
}
