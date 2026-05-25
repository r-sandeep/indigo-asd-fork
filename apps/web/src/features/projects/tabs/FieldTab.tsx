import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import type { ProjectRow, ProjectRfi, ProjectPunchItem, ProjectSubmittal, ProjectDailyLog } from '@indigo/shared'
import { useProjectFieldData } from '../useProject'
import { Skeleton } from '@/components/ui/Skeleton'

interface OutletCtx {
  project: ProjectRow | undefined
  isLoading: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

// ── Status configs ─────────────────────────────────────────────────────────

const RFI_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  draft:        { label: 'Draft',        color: 'text-gray-600',   bg: 'bg-gray-100',  ring: 'ring-gray-200'  },
  submitted:    { label: 'Submitted',    color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200' },
  under_review: { label: 'Under Review', color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
  answered:     { label: 'Answered',     color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  closed:       { label: 'Closed',       color: 'text-gray-400',   bg: 'bg-gray-50',   ring: 'ring-gray-200'  },
  void:         { label: 'Void',         color: 'text-gray-400',   bg: 'bg-gray-50',   ring: 'ring-gray-200'  },
}

const PUNCH_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  open:             { label: 'Open',             color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200'    },
  in_progress:      { label: 'In Progress',      color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200'  },
  ready_for_review: { label: 'Ready for Review', color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200'  },
  closed:           { label: 'Closed',           color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200'  },
  void:             { label: 'Void',             color: 'text-gray-400',   bg: 'bg-gray-50',   ring: 'ring-gray-200'   },
}

const PUNCH_PRIORITY: Record<string, { dot: string; label: string }> = {
  low:      { dot: 'bg-gray-300',   label: 'Low'      },
  normal:   { dot: 'bg-brand-400',  label: 'Normal'   },
  high:     { dot: 'bg-amber-400',  label: 'High'     },
  blocking: { dot: 'bg-red-500',    label: 'Blocking' },
}

const SUBMITTAL_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  draft:               { label: 'Draft',               color: 'text-gray-600',   bg: 'bg-gray-100',  ring: 'ring-gray-200'  },
  submitted:           { label: 'Submitted',           color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200' },
  under_review:        { label: 'Under Review',        color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
  approved:            { label: 'Approved',            color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  approved_as_noted:   { label: 'Approved as Noted',   color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  revise_and_resubmit: { label: 'Revise & Resubmit',   color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
  rejected:            { label: 'Rejected',            color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200'   },
  void:                { label: 'Void',                color: 'text-gray-400',   bg: 'bg-gray-50',   ring: 'ring-gray-200'  },
}

function Badge({ status, map }: { status: string; map: Record<string, { label: string; color: string; bg: string; ring: string }> }) {
  const cfg = map[status] ?? { label: status, color: 'text-gray-500', bg: 'bg-gray-100', ring: 'ring-gray-200' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
      {cfg.label}
    </span>
  )
}

// ── Summary stats ──────────────────────────────────────────────────────────

function FieldSummary({
  rfis, punchItems, submittals, dailyLogs,
}: {
  rfis: ProjectRfi[]
  punchItems: ProjectPunchItem[]
  submittals: ProjectSubmittal[]
  dailyLogs: ProjectDailyLog[]
}) {
  const openRfis      = rfis.filter((r) => !['closed', 'void'].includes(r.status)).length
  const openPunch     = punchItems.filter((p) => !['closed', 'void'].includes(p.status)).length
  const pendingSubs   = submittals.filter((s) => !['approved', 'approved_as_noted', 'void'].includes(s.status)).length
  const overdueRfis   = rfis.filter((r) => isOverdue(r.due_date) && !['closed', 'void', 'answered'].includes(r.status)).length

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: 'Open RFIs',        value: openRfis,    warn: overdueRfis > 0, sub: overdueRfis > 0 ? `${overdueRfis} overdue` : undefined },
        { label: 'Punch Items',      value: openPunch,   warn: openPunch > 0 },
        { label: 'Pending Submittals', value: pendingSubs, warn: false },
        { label: 'Daily Logs',       value: dailyLogs.length, warn: false },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-gray-500">{item.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${item.warn ? 'text-amber-600' : 'text-gray-900'}`}>
            {item.value}
          </p>
          {item.sub && <p className="mt-0.5 text-xs text-amber-600">{item.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ── RFIs ───────────────────────────────────────────────────────────────────

function RfisSection({ rfis }: { rfis: ProjectRfi[] }) {
  const open = rfis.filter((r) => !['closed', 'void'].includes(r.status))
  const closed = rfis.filter((r) => ['closed', 'void'].includes(r.status))

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">RFIs</h2>
        <span className="text-xs text-gray-400">{rfis.length} total</span>
      </div>

      {rfis.length === 0 ? (
        <EmptySection label="No RFIs on this project." />
      ) : (
        <div className="divide-y divide-gray-100">
          {[...open, ...closed].map((rfi) => (
            <div key={rfi.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">RFI-{String(rfi.number).padStart(3, '0')}</span>
                  <span className="text-sm font-medium text-gray-900">{rfi.subject}</span>
                  <Badge status={rfi.status} map={RFI_STATUS} />
                </div>
                <div className="shrink-0 text-right">
                  {rfi.due_date && (
                    <span className={`text-xs ${isOverdue(rfi.due_date) && !['answered','closed','void'].includes(rfi.status) ? 'font-medium text-amber-600' : 'text-gray-400'}`}>
                      Due {fmtDate(rfi.due_date)}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{rfi.question}</p>
              {rfi.answer && (
                <p className="mt-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-800 line-clamp-2">
                  ✓ {rfi.answer}
                </p>
              )}
              {(rfi.cost_impact_cents || rfi.schedule_impact_days) && (
                <div className="mt-1 flex gap-3">
                  {rfi.cost_impact_cents != null && rfi.cost_impact_cents !== 0 && (
                    <span className="text-xs text-amber-600">Cost impact: {rfi.cost_impact_cents > 0 ? '+' : ''}${(rfi.cost_impact_cents / 100).toLocaleString()}</span>
                  )}
                  {rfi.schedule_impact_days != null && rfi.schedule_impact_days !== 0 && (
                    <span className="text-xs text-amber-600">Schedule: {rfi.schedule_impact_days > 0 ? '+' : ''}{rfi.schedule_impact_days}d</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Punch List ─────────────────────────────────────────────────────────────

function PunchListSection({ items }: { items: ProjectPunchItem[] }) {
  const priorityOrder = ['blocking', 'high', 'normal', 'low']
  const sorted = [...items].sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority))

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Punch List</h2>
        <span className="text-xs text-gray-400">{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <EmptySection label="No punch list items." />
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map((item) => {
            const pCfg = PUNCH_PRIORITY[item.priority] ?? PUNCH_PRIORITY.normal
            return (
              <div key={item.id} className="flex gap-3 px-5 py-3">
                <div className="mt-1.5 flex shrink-0 flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${pCfg.dot}`} title={pCfg.label} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${item.status === 'closed' || item.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.title}
                    </span>
                    <Badge status={item.status} map={PUNCH_STATUS} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-400">
                    {item.trade && <span>{item.trade}</span>}
                    {item.location && <span>· {item.location}</span>}
                    {item.due_date && (
                      <span className={isOverdue(item.due_date) && item.status !== 'closed' ? 'text-amber-600' : ''}>
                        · Due {fmtDate(item.due_date)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{item.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Submittals ─────────────────────────────────────────────────────────────

function SubmittalsSection({ submittals }: { submittals: ProjectSubmittal[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Submittals</h2>
        <span className="text-xs text-gray-400">{submittals.length} total</span>
      </div>

      {submittals.length === 0 ? (
        <EmptySection label="No submittals on this project." />
      ) : (
        <div className="divide-y divide-gray-100">
          {submittals.map((sub) => (
            <div key={sub.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{sub.number}{sub.revision > 0 ? ` Rev.${sub.revision}` : ''}</span>
                  <span className="text-sm font-medium text-gray-900">{sub.title}</span>
                  <Badge status={sub.status} map={SUBMITTAL_STATUS} />
                </div>
                {sub.required_by && (
                  <span className={`shrink-0 text-xs ${isOverdue(sub.required_by) && !['approved','approved_as_noted','void'].includes(sub.status) ? 'font-medium text-amber-600' : 'text-gray-400'}`}>
                    Required {fmtDate(sub.required_by)}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-400">
                {sub.type && <span>{sub.type.replace('_', ' ')}</span>}
                {sub.spec_section && <span>· {sub.spec_section}</span>}
                {sub.submitted_at && <span>· Submitted {fmtDate(sub.submitted_at)}</span>}
              </div>
              {sub.review_notes && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-1">Note: {sub.review_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Daily Logs ─────────────────────────────────────────────────────────────

function DailyLogsSection({ logs }: { logs: ProjectDailyLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Daily Logs</h2>
        <span className="text-xs text-gray-400">{logs.length} logs</span>
      </div>

      {logs.length === 0 ? (
        <EmptySection label="No daily logs yet." />
      ) : (
        <div className="divide-y divide-gray-100">
          {logs.map((log) => {
            const isOpen = expanded === log.id
            return (
              <div key={log.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="flex w-full items-start gap-4 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {log.weather && (
                        <span className="text-xs text-gray-400">{log.weather}{log.temperature_f ? ` · ${log.temperature_f}°F` : ''}</span>
                      )}
                      {log.crew_count != null && (
                        <span className="text-xs text-gray-400">{log.crew_count} crew{log.hours_worked != null ? ` · ${log.hours_worked}h` : ''}</span>
                      )}
                      {log.is_client_visible && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">CLIENT</span>
                      )}
                    </div>
                    <p className={`mt-0.5 text-xs text-gray-500 ${isOpen ? '' : 'line-clamp-1'}`}>
                      {log.work_performed}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                    {[
                      { label: 'Work Performed',      value: log.work_performed },
                      { label: 'Materials Delivered', value: log.materials_delivered },
                      { label: 'Equipment Used',      value: log.equipment_used },
                      { label: 'Issues / Delays',     value: log.issues_or_delays },
                    ].filter((item) => item.value).map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{item.label}</p>
                        <p className="mt-0.5 text-xs text-gray-700 whitespace-pre-line">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Shared empty state ─────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function FieldSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function FieldTab() {
  const { id: projectId } = useParams<{ id: string }>()
  const { isLoading: projectLoading } = useOutletContext<OutletCtx>()
  const { data: fieldData, isLoading: fieldLoading } = useProjectFieldData(projectId)

  const isLoading = projectLoading || fieldLoading

  if (isLoading) {
    return <div className="px-5 py-6 lg:px-8"><FieldSkeleton /></div>
  }

  const rfis       = fieldData?.rfis       ?? []
  const punchItems = fieldData?.punchItems ?? []
  const submittals = fieldData?.submittals ?? []
  const dailyLogs  = fieldData?.dailyLogs  ?? []

  return (
    <div className="space-y-4 px-5 py-6 lg:px-8">
      <FieldSummary
        rfis={rfis}
        punchItems={punchItems}
        submittals={submittals}
        dailyLogs={dailyLogs}
      />
      <RfisSection rfis={rfis} />
      <PunchListSection items={punchItems} />
      <SubmittalsSection submittals={submittals} />
      <DailyLogsSection logs={dailyLogs} />
    </div>
  )
}
