import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPortalProjectData,
  getPortalSelections,
  approvePortalMilestone,
  upsertPortalSelection,
  formatMoney,
} from '@indigo/shared'
import type {
  PortalMilestone,
  PortalInvoice,
  PortalDocument,
  PortalDailyLog,
  PortalChangeOrder,
  PortalSelectionCategory,
} from '@indigo/shared'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { Skeleton } from '@/components/ui/Skeleton'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtBytes(n: number | null | undefined): string {
  if (!n) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function daysUntil(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff} days away`
}

// ── Progress card ──────────────────────────────────────────────────────────

function ProgressCard({
  milestones,
  startDate,
  targetCompletion,
  contractCents,
}: {
  milestones: PortalMilestone[]
  startDate: string | null
  targetCompletion: string | null
  contractCents: number | null
}) {
  const done  = milestones.filter((m) => m.status === 'complete' || m.status === 'approved').length
  const total = milestones.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const nextMilestone = milestones.find(
    (m) => m.status !== 'complete' && m.status !== 'approved' && m.status !== 'void',
  )

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Overall Progress</p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-gray-900">{pct}%</p>
          {total > 0 && (
            <p className="text-xs text-gray-400">{done} of {total} milestones complete</p>
          )}
        </div>
        {contractCents != null && (
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Contract Value</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">{formatMoney(contractCents)}</p>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs font-medium text-gray-500">Start Date</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-800">{fmtDate(startDate)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Target Completion</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-800">{fmtDate(targetCompletion)}</p>
          {targetCompletion && (
            <p className="text-xs text-gray-400">{daysUntil(targetCompletion)}</p>
          )}
        </div>
      </div>

      {nextMilestone && (
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Next Milestone</p>
          <p className="mt-1 text-sm font-semibold text-brand-900">{nextMilestone.name}</p>
          {nextMilestone.due_date && (
            <p className="mt-0.5 text-xs text-brand-600">{fmtDateShort(nextMilestone.due_date)} · {daysUntil(nextMilestone.due_date)}</p>
          )}
          {nextMilestone.requires_client_approval && !nextMilestone.client_approved_at && (
            <p className="mt-1 text-xs font-medium text-amber-700">⚠ Your approval is required for this milestone</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Selections ─────────────────────────────────────────────────────────────

const SELECTION_STATUS_LABEL: Record<string, string> = {
  pending:         'Awaiting your choice',
  client_choosing: 'Your choice needed',
  selected:        'Choice received',
  approved:        'Approved',
  ordered:         'Ordered',
  received:        'Received',
  installed:       'Installed',
}

const SELECTION_STATUS_COLOR: Record<string, string> = {
  pending:         'bg-amber-100 text-amber-700',
  client_choosing: 'bg-amber-100 text-amber-700',
  selected:        'bg-blue-100 text-blue-700',
  approved:        'bg-green-100 text-green-700',
  ordered:         'bg-purple-100 text-purple-700',
  received:        'bg-teal-100 text-teal-700',
  installed:       'bg-green-100 text-green-700',
}

function overage(optionPriceCents: number, allowanceCents: number): number {
  return Math.max(0, optionPriceCents - allowanceCents)
}

function SelectionCategoryCard({
  category,
  onConfirm,
  isConfirming,
}: {
  category: PortalSelectionCategory
  onConfirm: (optionId: string | null) => void
  isConfirming: boolean
}) {
  const isLocked = ['approved', 'ordered', 'received', 'installed'].includes(category.status)
  const hasConfirmed = !!category.selection?.option_id || !!category.selection?.custom_description

  const [isOpen, setIsOpen] = useState(!hasConfirmed && !isLocked)
  const [picked, setPicked]   = useState<string | null>(category.selection?.option_id ?? null)

  const selectedOption = category.options.find((o) => o.id === picked)
  const confirmedOption = category.options.find((o) => o.id === category.selection?.option_id)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-start justify-between gap-3 p-4 ${!isLocked ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
        onClick={() => !isLocked && setIsOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm">{category.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SELECTION_STATUS_COLOR[category.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {SELECTION_STATUS_LABEL[category.status] ?? category.status}
            </span>
          </div>
          {category.description && (
            <p className="mt-0.5 text-xs text-gray-500">{category.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>Allowance: <span className="font-medium text-gray-700">{formatMoney(category.allowance_cents)}</span></span>
            {category.due_date && (
              <span>Due {fmtDateShort(category.due_date)}</span>
            )}
          </div>
        </div>

        {!isLocked && (
          <span className="shrink-0 text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Confirmed selection (collapsed view) */}
      {!isOpen && hasConfirmed && (
        <div className="border-t border-gray-100 bg-green-50 px-4 py-3">
          <p className="text-xs font-medium text-green-700 mb-0.5">Your selection</p>
          <p className="text-sm font-semibold text-gray-900">
            {confirmedOption?.name ?? category.selection?.custom_description ?? '—'}
          </p>
          {confirmedOption && confirmedOption.unit_price_cents > category.allowance_cents && (
            <p className="text-xs text-amber-600 mt-0.5">
              +{formatMoney(overage(confirmedOption.unit_price_cents, category.allowance_cents))} over allowance
            </p>
          )}
          {!isLocked && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}
              className="mt-1.5 text-xs text-brand-600 hover:text-brand-700"
            >
              Change selection
            </button>
          )}
        </div>
      )}

      {/* Options picker */}
      {isOpen && (
        <div className="border-t border-gray-100">
          {category.options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No options added yet by your builder.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {category.options.map((opt) => {
                const over = overage(opt.unit_price_cents, category.allowance_cents)
                const isPicked = picked === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPicked(opt.id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${isPicked ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isPicked ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}>
                      {isPicked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${isPicked ? 'text-brand-900' : 'text-gray-900'}`}>{opt.name}</p>
                      {opt.description && <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>}
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {over > 0 ? (
                          <span className="text-amber-600 font-medium">+{formatMoney(over)} over allowance</span>
                        ) : (
                          <span className="text-green-600 font-medium">Within allowance</span>
                        )}
                        {opt.vendor && <span className="text-gray-400">· {opt.vendor}</span>}
                        {opt.lead_time_days && <span className="text-gray-400">· {opt.lead_time_days}d lead time</span>}
                      </div>
                      {opt.vendor_url && (
                        <a
                          href={opt.vendor_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                        >
                          View product ↗
                        </a>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Confirm button */}
          {category.options.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex items-center justify-between gap-3">
              {selectedOption && (
                <p className="text-xs text-gray-500 flex-1">
                  Selected: <span className="font-medium text-gray-700">{selectedOption.name}</span>
                  {overage(selectedOption.unit_price_cents, category.allowance_cents) > 0 && (
                    <span className="text-amber-600"> (+{formatMoney(overage(selectedOption.unit_price_cents, category.allowance_cents))})</span>
                  )}
                </p>
              )}
              <button
                disabled={!picked || isConfirming}
                onClick={() => onConfirm(picked)}
                className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
              >
                {isConfirming ? 'Saving…' : 'Confirm Selection'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SelectionsSection({
  categories,
  project,
  customerId,
}: {
  categories: PortalSelectionCategory[]
  project: { id: string; tenant_id: string }
  customerId: string
}) {
  const queryClient = useQueryClient()

  const confirmMut = useMutation({
    mutationFn: ({ categoryId, optionId }: { categoryId: string; optionId: string | null }) =>
      upsertPortalSelection(supabase, {
        categoryId,
        projectId:  project.id,
        tenantId:   project.tenant_id,
        customerId,
        optionId,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portal-selections', project.id] }),
  })

  const pending   = categories.filter((c) => !c.selection && ['pending', 'client_choosing'].includes(c.status))
  const confirmed = categories.filter((c) => !!c.selection)
  const other     = categories.filter((c) => !c.selection && !['pending', 'client_choosing'].includes(c.status))

  if (categories.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Your Selections</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {pending.length > 0
            ? `${pending.length} decision${pending.length !== 1 ? 's' : ''} waiting for your input`
            : 'All selections made'}
        </p>
      </div>

      <div className="divide-y divide-gray-100 px-4 py-3 space-y-3">
        {/* Pending first — action needed */}
        {pending.map((cat) => (
          <SelectionCategoryCard
            key={cat.id}
            category={cat}
            onConfirm={(optId) => confirmMut.mutate({ categoryId: cat.id, optionId: optId })}
            isConfirming={confirmMut.isPending && confirmMut.variables?.categoryId === cat.id}
          />
        ))}
        {confirmed.map((cat) => (
          <SelectionCategoryCard
            key={cat.id}
            category={cat}
            onConfirm={(optId) => confirmMut.mutate({ categoryId: cat.id, optionId: optId })}
            isConfirming={confirmMut.isPending && confirmMut.variables?.categoryId === cat.id}
          />
        ))}
        {other.map((cat) => (
          <SelectionCategoryCard
            key={cat.id}
            category={cat}
            onConfirm={(optId) => confirmMut.mutate({ categoryId: cat.id, optionId: optId })}
            isConfirming={confirmMut.isPending && confirmMut.variables?.categoryId === cat.id}
          />
        ))}
      </div>
    </div>
  )
}

// ── Timeline ───────────────────────────────────────────────────────────────

function TimelineSection({
  milestones,
  onApprove,
  approvingId,
}: {
  milestones: PortalMilestone[]
  onApprove: (milestoneId: string) => void
  approvingId: string | null
}) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Timeline</h2>
        <p className="text-sm text-gray-400">No milestones shared yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Timeline</h2>

      <div className="space-y-1">
        {milestones.map((m, i) => {
          const done          = m.status === 'complete' || m.status === 'approved'
          const needsApproval = m.requires_client_approval && !m.client_approved_at && !done
          const isLast        = i === milestones.length - 1
          const isApproving   = approvingId === m.id

          return (
            <div key={m.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white ${
                  done                       ? 'bg-green-500 text-white' :
                  needsApproval              ? 'bg-amber-400 text-white' :
                  m.status === 'in_progress' ? 'bg-brand-500 text-white' :
                                               'bg-gray-200 text-gray-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                {!isLast && <div className="mt-1 w-px flex-1 bg-gray-200" />}
              </div>

              <div className="min-w-0 flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {m.name}
                  </p>
                  {done && m.completed_date ? (
                    <span className="shrink-0 text-xs text-green-600">✓ {fmtDateShort(m.completed_date)}</span>
                  ) : m.due_date ? (
                    <span className="shrink-0 text-xs text-gray-400">Due {fmtDateShort(m.due_date)}</span>
                  ) : null}
                </div>
                {needsApproval && (
                  <div className="mt-1.5 flex items-center gap-3">
                    <p className="text-xs font-medium text-amber-600">Your approval is required</p>
                    <button
                      onClick={() => onApprove(m.id)}
                      disabled={isApproving}
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                    >
                      {isApproving ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                )}
                {m.requires_client_approval && m.client_approved_at && !done && (
                  <p className="mt-0.5 text-xs text-green-600">✓ Approved by you {fmtDateShort(m.client_approved_at)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Invoices ───────────────────────────────────────────────────────────────

function InvoicesSection({ invoices }: { invoices: PortalInvoice[] }) {
  const outstanding = invoices.filter((i) => i.balance_due_cents > 0)
  const paid        = invoices.filter((i) => i.balance_due_cents === 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Invoices</h2>

      {invoices.length === 0 ? (
        <p className="text-sm text-gray-400">No invoices yet.</p>
      ) : (
        <div className="space-y-3">
          {outstanding.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Outstanding</p>
              <div className="space-y-2">
                {outstanding.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
              </div>
            </div>
          )}
          {paid.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Paid</p>
              <div className="space-y-2">
                {paid.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InvoiceRow({ inv }: { inv: PortalInvoice }) {
  const isPaid = inv.balance_due_cents === 0
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base">
        {isPaid ? '✅' : '💳'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
        <p className="text-xs text-gray-400">{fmtDate(inv.invoice_date)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(inv.total_cents)}</p>
        {isPaid ? (
          <p className="text-xs text-green-600">Paid</p>
        ) : (
          <p className="text-xs text-amber-700">Due {fmtDate(inv.due_date)}</p>
        )}
      </div>
    </div>
  )
}

// ── Change orders ──────────────────────────────────────────────────────────

const CO_STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending',
  approved:         'Approved',
}
const CO_STATUS_COLOR: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-green-100 text-green-700',
}

function ChangeOrdersSection({ changeOrders }: { changeOrders: PortalChangeOrder[] }) {
  if (changeOrders.length === 0) return null

  const approvedTotal = changeOrders
    .filter((co) => co.co_status === 'approved')
    .reduce((sum, co) => sum + co.amount_cents, 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-base font-semibold text-gray-900">Change Orders</h2>
        {approvedTotal !== 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">Approved total</p>
            <p className={`text-sm font-semibold tabular-nums ${approvedTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {approvedTotal >= 0 ? '+' : ''}{formatMoney(approvedTotal)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {changeOrders.map((co) => {
          const label = CO_STATUS_LABEL[co.co_status ?? ''] ?? co.co_status ?? ''
          const color = CO_STATUS_COLOR[co.co_status ?? ''] ?? 'bg-gray-100 text-gray-500'
          return (
            <div key={co.id} className="flex items-start gap-3 rounded-xl border border-gray-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{co.co_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
                    {label}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {co.title || co.description || '—'}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  {co.approved_at && <span>Approved {fmtDateShort(co.approved_at)}</span>}
                  {co.schedule_impact_days != null && co.schedule_impact_days !== 0 && (
                    <span>{co.schedule_impact_days > 0 ? '+' : ''}{co.schedule_impact_days} day{Math.abs(co.schedule_impact_days) !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <p className={`shrink-0 text-sm font-semibold tabular-nums ${co.amount_cents >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {co.amount_cents >= 0 ? '+' : ''}{formatMoney(co.amount_cents)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Daily logs (Field Updates) ─────────────────────────────────────────────

function DailyLogsSection({ logs }: { logs: PortalDailyLog[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (logs.length === 0) return null

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Field Updates</h2>
        <p className="mt-0.5 text-xs text-gray-500">{logs.length} update{logs.length !== 1 ? 's' : ''} from your build team</p>
      </div>

      <div className="divide-y divide-gray-100">
        {logs.map((log) => {
          const isExpanded = expanded.has(log.id)
          const summary = log.ai_client_summary || log.work_performed
          const date = new Date(log.date + 'T00:00:00')
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
          const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const hasDetails = !!(log.materials_delivered || log.equipment_used || log.issues_or_delays)

          return (
            <div key={log.id} className="px-5 py-4">
              {/* Date header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{dayName}</p>
                  <p className="text-xs text-gray-400">{dateStr}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                  {log.weather && (
                    <span>🌤 {log.weather}{log.temperature_f != null ? ` · ${log.temperature_f}°F` : ''}</span>
                  )}
                  {log.crew_count != null && (
                    <span>👷 {log.crew_count}</span>
                  )}
                </div>
              </div>

              {/* Summary text */}
              <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>

              {/* Expandable details */}
              {hasDetails && (
                <>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
                      {log.materials_delivered && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-0.5">Materials delivered</p>
                          <p>{log.materials_delivered}</p>
                        </div>
                      )}
                      {log.equipment_used && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-0.5">Equipment used</p>
                          <p>{log.equipment_used}</p>
                        </div>
                      )}
                      {log.issues_or_delays && (
                        <div>
                          <p className="font-semibold text-amber-700 mb-0.5">Issues / delays</p>
                          <p className="text-amber-700">{log.issues_or_delays}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => toggle(log.id)}
                    className="mt-2 text-xs text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    {isExpanded ? 'Show less ▲' : 'More details ▼'}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Documents ──────────────────────────────────────────────────────────────

const DOC_EMOJI: Record<string, string> = {
  plan: '📐', permit: '🏛️', contract: '📄', change_order: '🔄',
  invoice: '💳', photo: '📷', video: '🎥', specification: '📝',
  warranty: '✅', report: '📊', other: '📎',
}

function DocumentsSection({ documents }: { documents: PortalDocument[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Documents</h2>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">No documents shared yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3">
              <span className="shrink-0 text-xl">{DOC_EMOJI[doc.type] ?? '📎'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-400">
                  {fmtDate(doc.created_at)}
                  {doc.file_size_bytes ? ` · ${fmtBytes(doc.file_size_bytes)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function PortalSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
        <Skeleton className="h-5 w-24" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PortalProjectPage() {
  const { id: projectId }   = useParams<{ id: string }>()
  const { customer }        = usePortalAuth()
  const queryClient         = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey:  ['portal-project', projectId],
    queryFn:   () => getPortalProjectData(supabase, projectId!),
    enabled:   !!projectId,
    staleTime: 60_000,
  })

  const { data: selections } = useQuery({
    queryKey:  ['portal-selections', projectId],
    queryFn:   () => getPortalSelections(supabase, projectId!, customer!.id),
    enabled:   !!projectId && !!customer?.id,
    staleTime: 30_000,
  })

  const approveMut = useMutation({
    mutationFn: (milestoneId: string) => approvePortalMilestone(supabase, milestoneId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['portal-project', projectId] }),
  })

  if (isLoading) return <PortalSkeleton />

  if (error || !data) {
    return (
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-500">Unable to load project. Please try again.</p>
      </div>
    )
  }

  const { project, milestones, invoices, documents, dailyLogs, changeOrders } = data
  const job     = project.job
  const address = [job?.address_line1, job?.city, job?.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {/* Project header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{job?.job_name ?? 'Your Project'}</h1>
        {address && <p className="mt-0.5 text-sm text-gray-500">📍 {address}</p>}
      </div>

      <ProgressCard
        milestones={milestones}
        startDate={job?.start_date ?? null}
        targetCompletion={job?.target_completion ?? null}
        contractCents={job?.current_contract_cents ?? job?.contract_value_cents ?? null}
      />

      {/* Selections first — actionable items above the fold */}
      {selections && selections.length > 0 && customer && (
        <SelectionsSection
          categories={selections}
          project={project}
          customerId={customer.id}
        />
      )}

      <TimelineSection
        milestones={milestones}
        onApprove={(id) => approveMut.mutate(id)}
        approvingId={approveMut.isPending ? (approveMut.variables ?? null) : null}
      />

      <InvoicesSection invoices={invoices} />

      <ChangeOrdersSection changeOrders={changeOrders} />

      <DailyLogsSection logs={dailyLogs} />

      <DocumentsSection documents={documents} />
    </div>
  )
}
