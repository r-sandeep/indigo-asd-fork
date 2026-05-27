import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MemberRole } from '@indigo/db'
import type { TeamMember } from '@indigo/shared'
import {
  getTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  deactivateTeamMember,
  reactivateTeamMember,
} from '@indigo/shared'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/stores/toastStore'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  GearIcon,
  UsersIcon,
  UserPlusIcon,
  EnvelopeIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@/components/ui/Icons'

// ── Constants ─────────────────────────────────────────────────────────────────

// Roles that can be assigned when inviting / editing (client + subcontractor
// are managed elsewhere through the portal / subcontract flows)
const ASSIGNABLE_ROLES: { value: MemberRole; label: string }[] = [
  { value: 'owner',           label: 'Owner' },
  { value: 'admin',           label: 'Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'field_super',     label: 'Field Supervisor' },
  { value: 'field_associate', label: 'Field Associate' },
  { value: 'accountant',      label: 'Accountant' },
  { value: 'subcontractor',   label: 'Subcontractor' },
  { value: 'client',          label: 'Client' },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_ROLES.map(({ value, label }) => [value, label]),
)

const ROLE_COLOR: Record<string, string> = {
  owner:           'bg-purple-50  text-purple-700',
  admin:           'bg-indigo-50  text-indigo-700',
  project_manager: 'bg-brand-50   text-brand-700',
  field_super:     'bg-blue-50    text-blue-700',
  field_associate: 'bg-sky-50     text-sky-700',
  accountant:      'bg-emerald-50 text-emerald-700',
  subcontractor:   'bg-amber-50   text-amber-700',
  client:          'bg-gray-100   text-gray-600',
}

// Roles that grant access to the Settings page (owner or admin)
const ADMIN_ROLES: MemberRole[] = ['owner', 'admin']

// ── Shared input style ─────────────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:bg-white focus:border-brand-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-brand-100 transition-colors'

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-9 w-9 rounded-full object-cover" />
  }
  return (
    <div className="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
      {initials}
    </div>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({
  tenantId,
  invitedByUserId,
  onClose,
  onInvited,
}: {
  tenantId: string
  invitedByUserId: string
  onClose: () => void
  onInvited: () => void
}) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole]   = useState<MemberRole>('field_associate')

  const mutation = useMutation({
    mutationFn: () =>
      inviteTeamMember(supabase, tenantId, invitedByUserId, email, role),
    onSuccess: (result) => {
      if (result.notFound) {
        toast.warning(
          `No account found for ${email}. They'll need to sign up first, then you can add them.`,
        )
        return
      }
      if (result.action === 'already_member') {
        toast.info(`${email} is already a member of this workspace.`)
        onClose()
        return
      }
      toast.success('Team member added successfully.')
      onInvited()
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add team member.')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserPlusIcon className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-900">Add Team Member</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-500">
            Enter the email address of the person you'd like to add. They must have already
            created an Indigo account.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Email address</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={`${inputCls} pl-8`}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className={inputCls}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
            <strong>Note:</strong> If the email isn't found, the person needs to sign up first.
            Share the app URL and ask them to create an account, then add them here.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!email.trim() || mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Role Modal ────────────────────────────────────────────────────────────

function EditRoleModal({
  member,
  tenantId,
  onClose,
  onSaved,
}: {
  member: TeamMember
  tenantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const fullName = `${member.profile.first_name} ${member.profile.last_name}`
  const [role, setRole] = useState<MemberRole>(member.role)

  const mutation = useMutation({
    mutationFn: () => updateTeamMemberRole(supabase, member.id, tenantId, role),
    onSuccess: () => {
      toast.success(`${fullName}'s role updated.`)
      onSaved()
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update role.')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Change Role</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={fullName} avatarUrl={member.profile.avatar_url} />
            <div>
              <p className="text-sm font-medium text-gray-900">{fullName}</p>
              <p className="text-xs text-gray-500">{member.profile.email}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">New role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className={inputCls}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={role === member.role || mutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Member Row ─────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  tenantId,
  canManage,
  currentUserId,
  onEdit,
  onRefresh,
}: {
  member: TeamMember
  tenantId: string
  canManage: boolean
  currentUserId: string
  onEdit: (m: TeamMember) => void
  onRefresh: () => void
}) {
  const toast     = useToast()
  const isSelf    = member.user_id === currentUserId
  const fullName  = `${member.profile.first_name} ${member.profile.last_name}`

  const deactivate = useMutation({
    mutationFn: () => deactivateTeamMember(supabase, member.id, tenantId),
    onSuccess: () => { toast.success(`${fullName} deactivated.`); onRefresh() },
    onError:   (err: Error) => toast.error(err.message),
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateTeamMember(supabase, member.id, tenantId),
    onSuccess: () => { toast.success(`${fullName} reactivated.`); onRefresh() },
    onError:   (err: Error) => toast.error(err.message),
  })

  return (
    <div className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
      member.is_active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
    }`}>
      <Avatar name={fullName} avatarUrl={member.profile.avatar_url} />

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{fullName}</p>
          {isSelf && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              You
            </span>
          )}
          {!member.is_active && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
              Inactive
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-500">{member.profile.email}</p>
        {member.profile.title && (
          <p className="text-xs text-gray-400">{member.profile.title}</p>
        )}
      </div>

      {/* Role badge */}
      <RoleBadge role={member.role} />

      {/* Actions */}
      {canManage && !isSelf && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(member)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Change role"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          {member.is_active ? (
            <button
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
              title="Deactivate member"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50"
              title="Reactivate member"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Team Tab ───────────────────────────────────────────────────────────────────

function TeamTab() {
  const { user, tenantMemberships, activeTenantId } = useAuth()
  const qc          = useQueryClient()
  const [search, setSearch]         = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)

  const tenantId = activeTenantId ?? ''

  const myRole = tenantMemberships.find((m) => m.tenant_id === tenantId)?.role
  const canManage = !!myRole && ADMIN_ROLES.includes(myRole as MemberRole)

  const { data: members = [], isLoading } = useQuery({
    queryKey:  ['team-members', tenantId],
    queryFn:   () => getTeamMembers(supabase, tenantId),
    enabled:   !!tenantId,
    staleTime: 30_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['team-members', tenantId] })

  const filtered = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.profile.first_name.toLowerCase().includes(q) ||
      m.profile.last_name.toLowerCase().includes(q) ||
      m.profile.email.toLowerCase().includes(q) ||
      (ROLE_LABEL[m.role] ?? m.role).toLowerCase().includes(q)
    )
  })

  const active   = filtered.filter((m) => m.is_active)
  const inactive = filtered.filter((m) => !m.is_active)

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className={`${inputCls} pl-8`}
          />
        </div>

        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <UserPlusIcon className="h-4 w-4" />
            Add member
          </button>
        )}
      </div>

      {/* Summary chips */}
      {!isLoading && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
            {members.filter((m) => m.is_active).length} active
          </span>
          {members.filter((m) => !m.is_active).length > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-600">
              {members.filter((m) => !m.is_active).length} inactive
            </span>
          )}
        </div>
      )}

      {/* Active members */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          {search ? 'No members match your search.' : 'No team members yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              tenantId={tenantId}
              canManage={canManage}
              currentUserId={user?.id ?? ''}
              onEdit={setEditMember}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Inactive members (collapsible section) */}
      {inactive.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
            <span className="rounded-full bg-gray-100 px-2 py-0.5">{inactive.length}</span>
            Inactive members
            <span className="ml-auto text-gray-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-3 space-y-2">
            {inactive.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                tenantId={tenantId}
                canManage={canManage}
                currentUserId={user?.id ?? ''}
                onEdit={setEditMember}
                onRefresh={refresh}
              />
            ))}
          </div>
        </details>
      )}

      {/* Modals */}
      {showInvite && user && (
        <InviteModal
          tenantId={tenantId}
          invitedByUserId={user.id}
          onClose={() => setShowInvite(false)}
          onInvited={refresh}
        />
      )}
      {editMember && (
        <EditRoleModal
          member={editMember}
          tenantId={tenantId}
          onClose={() => setEditMember(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

// ── Roles Reference Tab ────────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: { role: MemberRole; label: string; description: string }[] = [
  {
    role: 'owner',
    label: 'Owner',
    description: 'Full access to all features and settings. Can manage billing, team members, and all projects.',
  },
  {
    role: 'admin',
    label: 'Admin',
    description: 'Can manage team members, projects, budgets, and all operational features. Cannot access billing.',
  },
  {
    role: 'project_manager',
    label: 'Project Manager',
    description: 'Full project access — budgets, schedules, change orders, invoices, and subcontracts. Cannot manage team.',
  },
  {
    role: 'field_super',
    label: 'Field Supervisor',
    description: 'Can log work sessions, manage inspections, update field data, and view project details.',
  },
  {
    role: 'field_associate',
    label: 'Field Associate',
    description: 'Can clock in/out and view their own work history. Designed for field tradespeople.',
  },
  {
    role: 'accountant',
    label: 'Accountant',
    description: 'Read and write access to financials — budgets, invoices, draw schedules, and reports.',
  },
  {
    role: 'subcontractor',
    label: 'Subcontractor',
    description: 'Can view their subcontracts and submit lien waivers. Limited project visibility.',
  },
  {
    role: 'client',
    label: 'Client',
    description: 'Portal access only — can view project progress, approve selections, and sign documents.',
  },
]

function RolesTab() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Each team member has a role that controls what they can see and do in Indigo.
      </p>
      <div className="space-y-2">
        {ROLE_DESCRIPTIONS.map(({ role, description }) => (
          <div key={role} className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3">
            <RoleBadge role={role} />
            <p className="flex-1 text-sm text-gray-600">{description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page Shell ─────────────────────────────────────────────────────────────────

type Tab = 'team' | 'roles'

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'team',  label: 'Team',  Icon: UsersIcon },
  { id: 'roles', label: 'Roles', Icon: GearIcon },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('team')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
          <GearIcon className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your workspace and team</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'team'  && <TeamTab />}
      {activeTab === 'roles' && <RolesTab />}
    </div>
  )
}
