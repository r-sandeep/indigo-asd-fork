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

const MILESTONE_STATUS: Record<string, { dot: string; line: string }> = {
  complete:    { dot: 'bg-green-500',  line: 'border-green-200' },
  approved:    { dot: 'bg-green-500',  line: 'border-green-200' },
  in_progress: { dot: 'bg-brand-500',  line: 'border-brand-200' },
  not_started: { dot: 'bg-gray-300',   line: 'border-gray-200'  },
  blocked:     { dot: 'bg-red-500',    line: 'border-red-200'   },
}

const PHASE_ACCENT: Record<string, string> = {
  complete:    '#16a34a',
  approved:    '#16a34a',
  in_progress: '#6366f1',
  not_started: '#d1d5db',
  blocked:     '#ef4444',
}

// ── Milestone row ──────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  isLast,
}: {
  milestone: ProjectMilestone
  isLast: boolean
}) {
  const cfg       = MILESTONE_STATUS[milestone.status] ?? MILESTONE_STATUS.not_started
  const done      = milestone.status === 'complete' || milestone.status === 'approved'
  const overdue   = isOverdue(milestone.due_date, milestone.completed_date)
  const blocked   = milestone.status === 'blocked'

  return (
    <div className={`relative flex gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Status dot + connector line */}
      <div className="flex flex-col items-center pt-0.5">
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${cfg.dot}`} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-gray-200" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {/* Name + flags */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-medium leading-snug ${
              done    ? 'text-gray-400 line-through' :
              blocked ? 'text-red-700' :
              overdue ? 'text-amber-700' :
                        'text-gray-900'
            }`}>
              {milestone.name}
            </span>

            {/* Trigger/flag icons */}
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

          {/* Dates */}
          <div className="shrink-0 text-right">
            {done && milestone.completed_date ? (
              <span className="text-xs text-green-600">
                ✓ {fmtDateShort(milestone.completed_date)}
              </span>
            ) : milestone.due_date ? (
              <span className={`text-xs ${
                overdue   ? 'font-medium text-amber-600' :
                            'text-gray-400'
              }`}>
                {overdue ? '⚠ Due ' : 'Due '}
                {fmtDateShort(milestone.due_date)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Description */}
        {milestone.description && (
          <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">{milestone.description}</p>
        )}
      </div>
    </div>
  )
}

// ── Phase card ─────────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: ProjectPhase }) {
  const cfg         = PHASE_STATUS[phase.status] ?? PHASE_STATUS.not_started
  const accentColor = phase.color ?? PHASE_ACCENT[phase.status] ?? '#d1d5db'
  const total       = phase.milestones.length
  const completed   = phase.milestones.filter((m) => m.status === 'complete' || m.status === 'approved').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0
  const sorted      = [...phase.milestones].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
      {/* Phase header */}
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

          {/* Date range */}
          {(phase.start_date || phase.end_date) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {fmtDate(phase.start_date)}
              {phase.end_date && <> → {fmtDate(phase.end_date)}</>}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-700">
            {total > 0 ? `${completed} / ${total}` : '—'}
          </p>
          <p className="text-xs text-gray-400">milestones</p>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 w-full bg-gray-100">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: accentColor }}
          />
        </div>
      )}

      {/* Milestones */}
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
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
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

      {/* Overall progress bar */}
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

// ── Main component ─────────────────────────────────────────────────────────

export function ScheduleTab() {
  const { id } = useParams<{ id: string }>()
  const { isLoading: projectLoading } = useOutletContext<OutletCtx>()
  const { data: phases, isLoading: phasesLoading } = useProjectPhases(id)

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
          <div className="space-y-4">
            {sorted.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
