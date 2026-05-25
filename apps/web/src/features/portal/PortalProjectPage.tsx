import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPortalProjectData, approvePortalMilestone } from '@indigo/shared'
import { formatMoney } from '@indigo/shared'
import type { PortalMilestone, PortalInvoice, PortalDocument } from '@indigo/shared'
import { supabase } from '@/lib/supabase'
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

      {/* Progress bar */}
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

      {/* Dates */}
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

      {/* Next milestone */}
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
          const done     = m.status === 'complete' || m.status === 'approved'
          const needsApproval = m.requires_client_approval && !m.client_approved_at && !done
          const isLast   = i === milestones.length - 1
          const isApproving = approvingId === m.id

          return (
            <div key={m.id} className="flex gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white ${
                  done              ? 'bg-green-500 text-white' :
                  needsApproval     ? 'bg-amber-400 text-white' :
                  m.status === 'in_progress' ? 'bg-brand-500 text-white' :
                                      'bg-gray-200 text-gray-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                {!isLast && <div className="mt-1 w-px flex-1 bg-gray-200" />}
              </div>

              {/* Content */}
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
                {outstanding.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </div>
            </div>
          )}
          {paid.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Paid</p>
              <div className="space-y-2">
                {paid.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
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
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey:  ['portal-project', projectId],
    queryFn:   () => getPortalProjectData(supabase, projectId!),
    enabled:   !!projectId,
    staleTime: 60_000,
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

  const { project, milestones, invoices, documents } = data
  const job      = project.job
  const address  = [job?.address_line1, job?.city, job?.state].filter(Boolean).join(', ')

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

      <TimelineSection
        milestones={milestones}
        onApprove={(id) => approveMut.mutate(id)}
        approvingId={approveMut.isPending ? (approveMut.variables ?? null) : null}
      />

      <InvoicesSection invoices={invoices} />

      <DocumentsSection documents={documents} />
    </div>
  )
}
