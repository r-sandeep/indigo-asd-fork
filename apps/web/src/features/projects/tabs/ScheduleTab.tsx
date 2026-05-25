import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import type { ProjectRow, ProjectPhase, ProjectMilestone } from '@indigo/shared'
import { useProjectPhases } from '../useProject'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  CalendarIcon,
  EyeIcon,
  UserCheckIcon,
  ExclamationTriangleIcon,
} from '@/components/ui/Icons'

interface OutletCtx {
  project: ProjectRow | undefined
  isLoading: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtDateShort(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function isOverdue(dueDate: string | null, completedDate: string | null): boolean {
  if (completedDate || !dueDate) return false
  return new Date(dueDate + 'T00:00:00') < new Date()
}

// ── Status configs ─────────────────────────────────────────────────────────

const PHASE_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  complete:    { label: 'Complete',    color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  approved:    { label: 'Approved',    color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  in_progress: { label: 'In Progress', color: 'text-brand-700',  bg: 'bg-brand-50',  ring: 'ring-brand-200' },
  not_started: { label: 'Not Started', color: 'text-gray-500',   bg: 'bg-gray-100',  ring: 'ring-gray-200'  },
  blocked:     { label: 'Blocked',     color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200'   },
}

const MILESTONE_STATUS: Record<string, { dot: string }> = {
  complete:    { dot: 'bg-green-500'  },
  approved:    { dot: 'bg-green-500'  },
  in_progress: { dot: 'bg-brand-500'  },
  not_started: { dot: 'bg-gray-300'   },
  blocked:     { dot: 'bg-red-500'    },
}

const PHASE_ACCENT: Record<string, string> = {
  complete:    '#16a34a',
  approved:    '#16a34a',
  in_progress: '#6366f1',
  not_started: '#d1d5db',
  blocked:     '#ef4444',
}

// ── Milestone row (list view) ──────────────────────────────────────────────

function MilestoneRow({
  milestone,
  isLast,
}: {
  milestone: ProjectMilestone
  isLast: boolean
}) {
  const cfg     = MILESTONE_STATUS[milestone.status] ?? MILESTONE_STATUS.not_started
  const done    = milestone.status === 'complete' || milestone.status === 'approved'
  const overdue = isOverdue(milestone.due_date, milestone.completed_date)
  const blocked = milestone.status === 'blocked'

  return (
    <div className={`relative flex gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex flex-col items-center pt-0.5">
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${cfg.dot}`} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-gray-200" />}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-medium leading-snug ${
              done    ? 'text-gray-400 line-through' :
              blocked ? 'text-red-700' :
              overdue ? 'text-amber-700' :
                        'text-gray-900'
            }`}>
              {milestone.name}
            </span>

            <div className="flex items-center gap-1">
              {milestone.triggers_draw_request && (
                <span title="Triggers draw request" className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                  DRAW
                </span>
              )}
              {milestone.triggers_invoice && (
                <span title="Triggers invoice" className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                  INV
                </span>
              )}
              {milestone.requires_client_approval && (
                <UserCheckIcon className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.75} title="Requires client approval" />
              )}
              {milestone.is_client_visible && (
                <EyeIcon className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.75} title="Client visible" />
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {done && milestone.completed_date ? (
              <span className="text-xs text-green-600">
                ✓ {fmtDateShort(milestone.completed_date)}
              </span>
            ) : milestone.due_date ? (
              <span className={`text-xs ${
                overdue ? 'font-medium text-amber-600' : 'text-gray-400'
              }`}>
                {overdue ? '⚠ Due ' : 'Due '}
                {fmtDateShort(milestone.due_date)}
              </span>
            ) : null}
          </div>
        </div>

        {milestone.description && (
          <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">{milestone.description}</p>
        )}
      </div>
    </div>
  )
}

// ── Phase card (list view) ─────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: ProjectPhase }) {
  const cfg         = PHASE_STATUS[phase.status] ?? PHASE_STATUS.not_started
  const accentColor = phase.color ?? PHASE_ACCENT[phase.status] ?? '#d1d5db'
  const total       = phase.milestones.length
  const completed   = phase.milestones.filter((m) => m.status === 'complete' || m.status === 'approved').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0
  const sorted      = [...phase.milestones].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
      <div
        className="flex items-start gap-4 border-l-4 px-5 py-4"
        style={{ borderLeftColor: accentColor }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{phase.name}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
              {cfg.label}
            </span>
          </div>

          {(phase.start_date || phase.end_date) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {fmtDate(phase.start_date)}
              {phase.end_date && <> → {fmtDate(phase.end_date)}</>}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-700">
            {total > 0 ? `${completed} / ${total}` : '—'}
          </p>
          <p className="text-xs text-gray-400">milestones</p>
        </div>
      </div>

      {total > 0 && (
        <div className="h-1 w-full bg-gray-100">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: accentColor }}
          />
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="px-5 py-1">
          {sorted.map((m, i) => (
            <MilestoneRow key={m.id} milestone={m} isLast={i === sorted.length - 1} />
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-center text-xs text-gray-400">
          No milestones defined for this phase.
        </div>
      )}
    </div>
  )
}

// ── Gantt view ─────────────────────────────────────────────────────────────

function GanttView({ phases }: { phases: ProjectPhase[] }) {
  const sorted = [...phases].sort((a, b) => a.sequence - b.sequence)

  // Collect all relevant dates to determine chart bounds
  const allDates: Date[] = []
  for (const phase of sorted) {
    if (phase.start_date) allDates.push(new Date(phase.start_date + 'T00:00:00'))
    if (phase.end_date)   allDates.push(new Date(phase.end_date   + 'T00:00:00'))
    for (const m of phase.milestones) {
      if (m.due_date)       allDates.push(new Date(m.due_date       + 'T00:00:00'))
      if (m.completed_date) allDates.push(new Date(m.completed_date + 'T00:00:00'))
    }
  }

  if (allDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
        <CalendarIcon className="mx-auto h-10 w-10 text-gray-300" strokeWidth={1} />
        <h3 className="mt-3 text-sm font-semibold text-gray-900">No dates set</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add start/end dates to phases to see the Gantt chart.
        </p>
      </div>
    )
  }

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

  // Pad 2 weeks on each side for breathing room
  minDate.setDate(minDate.getDate() - 14)
  maxDate.setDate(maxDate.getDate() + 14)

  const totalMs = maxDate.getTime() - minDate.getTime()

  function toPct(dateStr: string | null | undefined, offsetDays = 0): number {
    if (!dateStr) return -1
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + offsetDays)
    return Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100))
  }

  // Month grid lines
  const months: { label: string; pct: number }[] = []
  const cur = new Date(minDate)
  cur.setDate(1)
  if (cur < minDate) cur.setMonth(cur.getMonth() + 1)
  while (cur <= maxDate) {
    const p = ((cur.getTime() - minDate.getTime()) / totalMs) * 100
    months.push({ label: fmtMonthYear(cur), pct: p })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Today line
  const today        = new Date()
  const todayPct     = ((today.getTime() - minDate.getTime()) / totalMs) * 100
  const showToday    = todayPct >= 0 && todayPct <= 100

  const LEFT_COL_W = 180 // px

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>

          {/* Header row: month labels */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div
              className="shrink-0 border-r border-gray-200 px-4 py-2.5"
              style={{ width: LEFT_COL_W }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Phase
              </span>
            </div>
            <div className="relative flex-1 overflow-hidden py-2.5" style={{ height: 32 }}>
              {months.map((m) => (
                <span
                  key={m.label}
                  className="absolute text-[10px] font-medium text-gray-400"
                  style={{ left: `${m.pct}%`, transform: 'translateX(-4px)' }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Phase rows */}
          {sorted.map((phase) => {
            const accentColor = phase.color ?? PHASE_ACCENT[phase.status] ?? '#d1d5db'
            const cfg         = PHASE_STATUS[phase.status] ?? PHASE_STATUS.not_started
            const hasBar      = !!(phase.start_date && phase.end_date)
            const barLeft     = hasBar ? toPct(phase.start_date) : -1
            // Add 1 day to end so bar covers the full end day
            const barRight    = hasBar ? toPct(phase.end_date, 1) : -1
            const barWidth    = hasBar ? Math.max(barRight - barLeft, 0.5) : 0
            const milestones  = phase.milestones.filter((m) => m.due_date)

            return (
              <div
                key={phase.id}
                className="flex border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
              >
                {/* Phase label */}
                <div
                  className="flex shrink-0 flex-col justify-center border-r border-gray-100 px-4 py-3"
                  style={{ width: LEFT_COL_W }}
                >
                  <span className="truncate text-xs font-semibold text-gray-800">{phase.name}</span>
                  <span className={`mt-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>

                {/* Timeline area */}
                <div className="relative flex-1" style={{ minHeight: 52 }}>
                  {/* Month grid lines */}
                  {months.map((m) => (
                    <div
                      key={m.label}
                      className="absolute inset-y-0 w-px bg-gray-100"
                      style={{ left: `${m.pct}%` }}
                    />
                  ))}

                  {/* Today line */}
                  {showToday && (
                    <div
                      className="absolute inset-y-0 w-px bg-red-300"
                      style={{ left: `${todayPct}%` }}
                    />
                  )}

                  {/* Phase bar */}
                  {hasBar && (
                    <div
                      className="absolute top-1/2 h-6 -translate-y-1/2 rounded-md"
                      style={{
                        left:            `${barLeft}%`,
                        width:           `${barWidth}%`,
                        backgroundColor: accentColor,
                        opacity:         0.85,
                      }}
                    />
                  )}

                  {/* Milestone diamonds */}
                  {milestones.map((m) => {
                    const mp      = toPct(m.due_date)
                    if (mp < 0) return null
                    const done    = m.status === 'complete' || m.status === 'approved'
                    const overdue = isOverdue(m.due_date, m.completed_date)
                    const color   = done    ? '#16a34a'
                                  : overdue ? '#f59e0b'
                                  : m.status === 'blocked' ? '#ef4444'
                                  : '#6366f1'
                    return (
                      <div
                        key={m.id}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-default"
                        style={{ left: `${mp}%` }}
                        title={`${m.name} — Due ${fmtDateShort(m.due_date)}${done ? ' ✓' : overdue ? ' (overdue)' : ''}`}
                      >
                        <div
                          className="h-3.5 w-3.5 rotate-45 rounded-sm ring-2 ring-white"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Today label footer */}
          {showToday && (
            <div className="flex border-t border-gray-100 bg-gray-50">
              <div className="shrink-0 border-r border-gray-100" style={{ width: LEFT_COL_W }} />
              <div className="relative flex-1 py-1.5">
                <div
                  className="absolute flex items-center gap-0.5"
                  style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="rounded bg-red-400 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    Today
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-6 rounded-sm bg-gray-400 opacity-80" />
              <span className="text-[10px] text-gray-500">Phase bar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rotate-45 rounded-sm bg-indigo-500 ring-1 ring-white" />
              <span className="text-[10px] text-gray-500">Milestone (pending)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rotate-45 rounded-sm bg-green-500 ring-1 ring-white" />
              <span className="text-[10px] text-gray-500">Complete</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rotate-45 rounded-sm bg-amber-500 ring-1 ring-white" />
              <span className="text-[10px] text-gray-500">Overdue</span>
            </div>
            {showToday && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-px bg-red-400" />
                <span className="text-[10px] text-gray-500">Today</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="mb-4 h-1 w-full rounded-full" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Summary bar ────────────────────────────────────────────────────────────

function SummaryBar({ phases }: { phases: ProjectPhase[] }) {
  const totalPhases     = phases.length
  const totalMilestones = phases.reduce((n, p) => n + p.milestones.length, 0)
  const doneMilestones  = phases.reduce(
    (n, p) => n + p.milestones.filter((m) => m.status === 'complete' || m.status === 'approved').length,
    0,
  )
  const overdueMilestones = phases.reduce(
    (n, p) => n + p.milestones.filter((m) => isOverdue(m.due_date, m.completed_date)).length,
    0,
  )
  const blockedPhases = phases.filter((p) => p.status === 'blocked').length
  const pct = totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium text-gray-500">Phases</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900">{totalPhases}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Milestones</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            {doneMilestones}<span className="text-sm text-gray-400"> / {totalMilestones}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Complete</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900">{pct}%</p>
        </div>
        {overdueMilestones > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" strokeWidth={2} />
            <span className="text-sm font-medium text-amber-700">
              {overdueMilestones} overdue
            </span>
          </div>
        )}
        {blockedPhases > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" strokeWidth={2} />
            <span className="text-sm font-medium text-red-700">
              {blockedPhases} blocked
            </span>
          </div>
        )}
      </div>

      {totalMilestones > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── View toggle ────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'gantt'

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {(['list', 'gantt'] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
            value === v
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {v === 'list' ? '☰  List' : '▬  Gantt'}
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function ScheduleTab() {
  const { id } = useParams<{ id: string }>()
  const { isLoading: projectLoading } = useOutletContext<OutletCtx>()
  const { data: phases, isLoading: phasesLoading } = useProjectPhases(id)
  const [view, setView] = useState<ViewMode>('list')

  const isLoading = projectLoading || phasesLoading
  const sorted    = phases ? [...phases].sort((a, b) => a.sequence - b.sequence) : []

  return (
    <div className="px-5 py-6 lg:px-8">
      {isLoading ? (
        <ScheduleSkeleton />
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <CalendarIcon className="mx-auto h-10 w-10 text-gray-300" strokeWidth={1} />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No schedule yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Phases and milestones will appear here once added.
          </p>
        </div>
      ) : (
        <>
          <SummaryBar phases={sorted} />

          <div className="mb-4 flex justify-end">
            <ViewToggle value={view} onChange={setView} />
          </div>

          {view === 'list' ? (
            <div className="space-y-4">
              {sorted.map((phase) => (
                <PhaseCard key={phase.id} phase={phase} />
              ))}
            </div>
          ) : (
            <GanttView phases={sorted} />
          )}
        </>
      )}
    </div>
  )
}
