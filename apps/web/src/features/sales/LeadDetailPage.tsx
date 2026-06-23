import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { formatMoney } from '@indigo/shared'
import {
  useLead,
  useLeadActivities,
  useUpdateLead,
  useUpdateLeadStatus,
  useAddActivity,
  useDeleteActivity,
  useDeleteLead,
} from './useLeads'
import { useProposalsForLead, useCreateProposal } from './useProposals'
import {
  LEAD_STATUSES,
  LEAD_SOURCES,
  ACTIVITY_TYPES,
  getLeadStatusMeta,
  getProposalStatusMeta,
  type LeadStatus,
  type ActivityType,
} from './types'
import { useToast } from '@/stores/toastStore'
import {
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
} from '@/components/ui/Icons'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const ACTIVITY_ICON: Record<ActivityType, string> = {
  note:       '📝',
  call:       '📞',
  email:      '✉️',
  meeting:    '🤝',
  site_visit: '🏠',
}

// ── Edit lead panel ───────────────────────────────────────────────────────────

function EditLeadPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { data: lead } = useLead(leadId)
  const update = useUpdateLead()
  const toast  = useToast()

  const [form, setForm] = useState({
    client_name:           lead?.client_name ?? '',
    client_email:          lead?.client_email ?? '',
    client_phone:          lead?.client_phone ?? '',
    title:                 lead?.title ?? '',
    job_address:           lead?.job_address ?? '',
    job_city:              lead?.job_city ?? '',
    job_state:             lead?.job_state ?? '',
    job_zip:               lead?.job_zip ?? '',
    job_type:              lead?.job_type ?? '',
    estimated_value_cents: lead?.estimated_value_cents != null
      ? String(lead.estimated_value_cents / 100) : '',
    lead_source:           lead?.lead_source ?? '',
    follow_up_date:        lead?.follow_up_date ?? '',
    description:           lead?.description ?? '',
  })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const inputCls = 'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors'
  const selectCls = 'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors'

  async function save() {
    const valueCents = form.estimated_value_cents
      ? Math.round(parseFloat(form.estimated_value_cents) * 100) : null

    try {
      await update.mutateAsync({
        id: leadId,
        client_name:           form.client_name,
        client_email:          form.client_email || null,
        client_phone:          form.client_phone || null,
        title:                 form.title,
        job_address:           form.job_address || null,
        job_city:              form.job_city || null,
        job_state:             form.job_state || null,
        job_zip:               form.job_zip || null,
        job_type:              form.job_type || null,
        estimated_value_cents: valueCents,
        lead_source:           (form.lead_source || null) as any,
        follow_up_date:        form.follow_up_date || null,
        description:           form.description || null,
      })
      toast.success('Lead updated')
      onClose()
    } catch {
      toast.error('Failed to update lead')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Lead</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto space-y-3 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Client Name</label>
              <input className={inputCls} value={form.client_name} onChange={(e) => set('client_name', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
              <input type="email" className={inputCls} value={form.client_email} onChange={(e) => set('client_email', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
              <input className={inputCls} value={form.client_phone} onChange={(e) => set('client_phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Lead Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Job Address</label>
              <input className={inputCls} value={form.job_address} onChange={(e) => set('job_address', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">City</label>
              <input className={inputCls} value={form.job_city} onChange={(e) => set('job_city', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                <input className={inputCls} maxLength={2} value={form.job_state} onChange={(e) => set('job_state', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Zip</label>
                <input className={inputCls} value={form.job_zip} onChange={(e) => set('job_zip', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Job Type</label>
              <select className={selectCls} value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
                <option value="">—</option>
                <option value="remodel">Remodel</option>
                <option value="new_construction">New Construction</option>
                <option value="addition">Addition</option>
                <option value="adu">ADU</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Estimated Value ($)</label>
              <input type="number" min="0" step="500" className={inputCls} value={form.estimated_value_cents} onChange={(e) => set('estimated_value_cents', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Lead Source</label>
              <select className={selectCls} value={form.lead_source} onChange={(e) => set('lead_source', e.target.value)}>
                <option value="">—</option>
                {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Follow-up Date</label>
              <input type="date" className={inputCls} value={form.follow_up_date} onChange={(e) => set('follow_up_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes / Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={save} disabled={update.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadDetailPage() {
  const { id = '' }  = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const toast        = useToast()

  const { data: lead, isLoading } = useLead(id)
  const { data: activities = [] }  = useLeadActivities(id)
  const { data: proposals = [] }   = useProposalsForLead(id)

  const updateStatus  = useUpdateLeadStatus()
  const addActivity   = useAddActivity()
  const deleteAct     = useDeleteActivity()
  const deleteLead    = useDeleteLead()
  const createProposal = useCreateProposal()

  const [showEdit,    setShowEdit]    = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteType,    setNoteType]    = useState<ActivityType>('note')
  const [noteText,    setNoteText]    = useState('')
  const [showDelete,  setShowDelete]  = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!lead) {
    return <div className="p-8 text-sm text-gray-500">Lead not found.</div>
  }

  const meta = getLeadStatusMeta(lead.status)

  async function handleStatusChange(status: LeadStatus) {
    await updateStatus.mutateAsync({ id, status })
  }

  async function submitActivity() {
    if (!noteText.trim()) return
    await addActivity.mutateAsync({ lead_id: id, type: noteType, description: noteText.trim() })
    setNoteText('')
    setShowAddNote(false)
  }

  async function handleDeleteLead() {
    await deleteLead.mutateAsync(id)
    toast.success('Lead deleted')
    navigate('/sales')
  }

  async function handleNewProposal() {
    const addressParts = [lead.job_address, lead.job_city, lead.job_state].filter(Boolean).join(', ')
    const p = await createProposal.mutateAsync({
      lead_id:     id,
      title:       lead.title,
      client_name: lead.client_name,
      client_email: lead.client_email ?? undefined,
      job_address: lead.job_address ?? undefined,
      job_city:    lead.job_city ?? undefined,
      job_state:   lead.job_state ?? undefined,
      job_zip:     lead.job_zip ?? undefined,
    })
    navigate(`/sales/leads/${id}/proposals/${p.id}`)
  }

  const address = [lead.job_address, lead.job_city, lead.job_state, lead.job_zip]
    .filter(Boolean).join(', ')

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white px-5 py-4 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/sales" className="hover:text-brand-600 transition-colors">Sales Pipeline</Link>
          <ChevronRightIcon className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="truncate font-medium text-gray-900">{lead.title}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Activity feed ────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Activity</h2>
            <button
              onClick={() => setShowAddNote((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add Activity
            </button>
          </div>

          {/* Add activity form */}
          {showAddNote && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex gap-2 flex-wrap">
                {ACTIVITY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setNoteType(t.value)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      noteType === t.value
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
                rows={3}
                placeholder={`Add a ${ACTIVITY_TYPES.find((t) => t.value === noteType)?.label.toLowerCase()}...`}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setShowAddNote(false); setNoteText('') }} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button
                  onClick={submitActivity}
                  disabled={!noteText.trim() || addActivity.isPending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {addActivity.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Activity list */}
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl">📋</div>
              <p className="mt-3 text-sm font-medium text-gray-700">No activity yet</p>
              <p className="mt-1 text-xs text-gray-500">Log calls, emails, meetings, and notes about this lead.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div key={act.id} className="group flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm">
                    {ACTIVITY_ICON[act.type as ActivityType] ?? '📝'}
                  </div>
                  <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{act.description}</p>
                      <button
                        onClick={() => deleteAct.mutate({ id: act.id, leadId: id })}
                        className="shrink-0 rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{formatDatetime(act.activity_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Lead info sidebar ────────────────────────────────── */}
        <div className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white lg:flex">
          <div className="p-5">
            {/* Title + actions */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <h1 className="text-base font-bold text-gray-900 leading-tight">{lead.title}</h1>
              <button
                onClick={() => setShowEdit(true)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Status selector */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Info rows */}
            <dl className="space-y-3 text-sm">
              <InfoRow label="Client"   value={lead.client_name} />
              {lead.client_phone && <InfoRow label="Phone"    value={lead.client_phone} />}
              {lead.client_email && <InfoRow label="Email"    value={lead.client_email} />}
              {address           && <InfoRow label="Address"  value={address} />}
              {lead.job_type     && <InfoRow label="Job Type" value={lead.job_type.replace('_', ' ')} />}
              {lead.estimated_value_cents != null && (
                <InfoRow label="Est. Value" value={formatMoney(lead.estimated_value_cents)} />
              )}
              {lead.lead_source && (
                <InfoRow label="Source" value={
                  LEAD_SOURCES.find((s) => s.value === lead.lead_source)?.label ?? lead.lead_source
                } />
              )}
              <InfoRow label="Lead Date"   value={formatDate(lead.lead_date)} />
              {lead.follow_up_date && (
                <InfoRow label="Follow-up"  value={formatDate(lead.follow_up_date)} />
              )}
              {lead.description && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</dt>
                  <dd className="text-sm text-gray-700 whitespace-pre-wrap">{lead.description}</dd>
                </div>
              )}
            </dl>
          </div>

          <hr className="border-gray-100" />

          {/* Proposals section */}
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Proposals
                {proposals.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                    {proposals.length}
                  </span>
                )}
              </h3>
              <button
                onClick={handleNewProposal}
                disabled={createProposal.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                New
              </button>
            </div>

            {proposals.length === 0 ? (
              <p className="text-xs text-gray-400">No proposals yet.</p>
            ) : (
              <div className="space-y-2">
                {proposals.map((p) => {
                  const pmeta = getProposalStatusMeta(p.status)
                  return (
                    <Link
                      key={p.id}
                      to={`/sales/leads/${id}/proposals/${p.id}`}
                      className="group flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-700 transition-colors">
                          {p.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(p.created_at.split('T')[0])}
                        </p>
                      </div>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${pmeta.color}`}>
                        {pmeta.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <hr className="border-gray-100 mt-auto" />

          {/* Danger zone */}
          <div className="p-5">
            {showDelete ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Delete this lead?</p>
                <p className="mt-1 text-xs text-red-600">This also deletes all activities and proposals. Cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setShowDelete(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white transition-colors">Cancel</button>
                  <button onClick={handleDeleteLead} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">Delete</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete Lead
              </button>
            )}
          </div>
        </div>
      </div>

      {showEdit && <EditLeadPanel leadId={id} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  )
}
