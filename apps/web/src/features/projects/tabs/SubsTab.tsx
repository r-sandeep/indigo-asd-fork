import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import type { ProjectRow, ProjectSubcontract, ProjectLienWaiver } from '@indigo/shared'
import { formatMoney } from '@indigo/shared'
import { useProjectSubcontracts, useProjectLienWaivers } from '../useProject'
import { Skeleton } from '@/components/ui/Skeleton'
import { ExclamationTriangleIcon } from '@/components/ui/Icons'

interface OutletCtx {
  project: ProjectRow | undefined
  isLoading: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isExpiringSoon(dateStr: string | null | undefined, daysAhead = 30): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const cutoff = new Date()
  cutoff.setDate(now.getDate() + daysAhead)
  return d >= now && d <= cutoff
}

function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

// ── Status configs ─────────────────────────────────────────────────────────

const SUB_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  draft:      { label: 'Draft',      color: 'text-gray-600',   bg: 'bg-gray-100',  ring: 'ring-gray-200'  },
  sent:       { label: 'Sent',       color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200' },
  active:     { label: 'Active',     color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  complete:   { label: 'Complete',   color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  cancelled:  { label: 'Cancelled',  color: 'text-gray-400',   bg: 'bg-gray-50',   ring: 'ring-gray-200'  },
}

const INV_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  received:   { label: 'Received',   color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200' },
  reviewing:  { label: 'Reviewing',  color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
  approved:   { label: 'Approved',   color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  paid:       { label: 'Paid',       color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  disputed:   { label: 'Disputed',   color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200'   },
}

const LIEN_TYPE: Record<string, string> = {
  conditional_progress:   'Conditional Progress',
  unconditional_progress: 'Unconditional Progress',
  conditional_final:      'Conditional Final',
  unconditional_final:    'Unconditional Final',
}

function Badge({ status, map }: { status: string | null; map: Record<string, { label: string; color: string; bg: string; ring: string }> }) {
  const cfg = (status ? map[status] : null) ?? { label: status ?? '—', color: 'text-gray-500', bg: 'bg-gray-100', ring: 'ring-gray-200' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
      {cfg.label}
    </span>
  )
}

// ── Subcontract card ───────────────────────────────────────────────────────

function SubcontractCard({ sub }: { sub: ProjectSubcontract }) {
  const [showInvoices, setShowInvoices] = useState(false)
  const invoices = sub.subcontract_invoices ?? []
  const totalBilled = invoices.reduce((s, i) => s + i.amount_billed_cents, 0)
  const coiExpired  = isExpired(sub.subcontractor?.coi_expiration)
  const coiSoon     = !coiExpired && isExpiringSoon(sub.subcontractor?.coi_expiration)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
      {/* Header */}
      <div className="flex items-start gap-4 border-l-4 px-5 py-4" style={{ borderLeftColor: sub.subcontract_status === 'active' ? '#6366f1' : sub.subcontract_status === 'complete' ? '#16a34a' : '#d1d5db' }}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {sub.subcontractor?.is_preferred && (
              <span className="text-sm">⭐</span>
            )}
            <h3 className="text-sm font-semibold text-gray-900">
              {sub.subcontractor?.name ?? 'Unknown Subcontractor'}
            </h3>
            <Badge status={sub.subcontract_status} map={SUB_STATUS} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {sub.reference_number}{sub.description ? ` · ${sub.description}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
            {sub.subcontractor?.contact_name && <span>{sub.subcontractor.contact_name}</span>}
            {sub.subcontractor?.phone && <span>{sub.subcontractor.phone}</span>}
            {sub.execution_date && <span>Executed {fmtDate(sub.execution_date)}</span>}
          </div>

          {/* COI / License alerts */}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {coiExpired && (
              <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                <ExclamationTriangleIcon className="h-3 w-3" strokeWidth={2} /> COI EXPIRED
              </span>
            )}
            {coiSoon && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <ExclamationTriangleIcon className="h-3 w-3" strokeWidth={2} /> COI EXPIRING {fmtDate(sub.subcontractor?.coi_expiration)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(sub.original_value_cents)}</p>
          {invoices.length > 0 && (
            <p className="text-xs text-gray-400">
              {formatMoney(totalBilled)} billed
            </p>
          )}
        </div>
      </div>

      {/* Invoices toggle */}
      {invoices.length > 0 && (
        <>
          <button
            onClick={() => setShowInvoices(!showInvoices)}
            className="flex w-full items-center justify-between border-t border-gray-100 px-5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
            <span>{showInvoices ? '▲' : '▼'}</span>
          </button>

          {showInvoices && (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{inv.sub_invoice_number}</span>
                      <Badge status={inv.sub_invoice_status} map={INV_STATUS} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{inv.milestone_description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-gray-800">{formatMoney(inv.amount_billed_cents)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(inv.invoice_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Lien Waivers ──────────────────────────────────────────────────────────

function LienWaiversSection({ waivers }: { waivers: ProjectLienWaiver[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Lien Waivers</h2>
        <span className="text-xs text-gray-400">{waivers.length} on file</span>
      </div>

      {waivers.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-gray-400">No lien waivers collected yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {waivers.map((w) => (
            <div key={w.id} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {w.subcontractor?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">
                  {LIEN_TYPE[w.type] ?? w.type} · Through {fmtDate(w.through_date)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-800">{formatMoney(w.amount_cents)}</p>
                {w.received_at ? (
                  <p className="text-xs text-green-600">✓ Received {fmtDate(w.received_at)}</p>
                ) : (
                  <p className="text-xs text-amber-600">Pending</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Summary ────────────────────────────────────────────────────────────────

function SubsSummary({ subs }: { subs: ProjectSubcontract[] }) {
  const totalValue  = subs.reduce((s, c) => s + c.original_value_cents, 0)
  const activeSubs  = subs.filter((s) => s.subcontract_status === 'active').length
  const allInvoices = subs.flatMap((s) => s.subcontract_invoices ?? [])
  const pendingInv  = allInvoices.filter((i) => ['received', 'reviewing'].includes(i.sub_invoice_status ?? '')).length
  const coiAlerts   = subs.filter((s) => isExpired(s.subcontractor?.coi_expiration) || isExpiringSoon(s.subcontractor?.coi_expiration)).length

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: 'Total Subcontracts', value: subs.length,                       warn: false },
        { label: 'Active',            value: activeSubs,                          warn: false },
        { label: 'Committed Value',   value: subs.length > 0 ? formatMoney(totalValue) : '—', warn: false, wide: true },
        { label: 'Pending Invoices',  value: pendingInv,                          warn: pendingInv > 0 },
      ].map((item) => (
        <div key={item.label} className={`rounded-xl border border-gray-200 bg-white p-4 shadow-card ${item.wide ? '' : ''}`}>
          <p className="text-xs font-medium text-gray-500">{item.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${item.warn ? 'text-amber-600' : 'text-gray-900'}`}>
            {item.value}
          </p>
        </div>
      ))}
      {coiAlerts > 0 && (
        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 lg:col-span-4">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} />
          <span className="text-sm font-medium text-amber-700">
            {coiAlerts} subcontractor{coiAlerts !== 1 ? 's have' : ' has'} expired or expiring insurance
          </span>
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function SubsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-8" />
          </div>
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function SubsTab() {
  const { id: projectId } = useParams<{ id: string }>()
  const { project, isLoading: projectLoading } = useOutletContext<OutletCtx>()

  const jobId = project?.job?.id

  const { data: subs,    isLoading: subsLoading  } = useProjectSubcontracts(jobId)
  const { data: waivers, isLoading: waiversLoading } = useProjectLienWaivers(projectId)

  const isLoading = projectLoading || subsLoading || waiversLoading

  if (isLoading) {
    return <div className="px-5 py-6 lg:px-8"><SubsSkeleton /></div>
  }

  const subList    = subs    ?? []
  const waiverList = waivers ?? []

  return (
    <div className="space-y-4 px-5 py-6 lg:px-8">
      <SubsSummary subs={subList} />

      {subList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <span className="text-3xl">🔨</span>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No subcontracts yet</h3>
          <p className="mt-1 text-sm text-gray-500">Subcontracts and invoices will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subList.map((sub) => (
            <SubcontractCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}

      <LienWaiversSection waivers={waiverList} />
    </div>
  )
}
