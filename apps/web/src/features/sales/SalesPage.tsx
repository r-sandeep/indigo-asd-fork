import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@indigo/shared'
import { useLeads, useUpdateLeadStatus } from './useLeads'
import { CreateLeadModal } from './CreateLeadModal'
import { SalesSubNav } from './SalesSubNav'
import {
  PIPELINE_STAGES,
  LEAD_STATUSES,
  getLeadStatusMeta,
  type Lead,
  type LeadStatus,
} from './types'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from '@/components/ui/Icons'

// ── Helpers ──────────────────────────────────────────────────────────────────

function stageLabel(status: LeadStatus): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d    = new Date(dateStr + 'T00:00:00')
  const now  = new Date()
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1)   return `${Math.abs(diff)}d overdue`
  return `In ${diff}d`
}

// ── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onDragStart,
}: {
  lead: Lead
  onDragStart: (id: string) => void
}) {
  const overdue  = isOverdue(lead.follow_up_date)
  const relDate  = formatRelativeDate(lead.follow_up_date)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      className="group cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing active:shadow-lg select-none"
    >
      <Link
        to={`/sales/leads/${lead.id}`}
        draggable={false}
        className="block"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-brand-700 transition-colors">
          {lead.title}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 truncate">{lead.client_name}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          {lead.estimated_value_cents != null ? (
            <span className="text-xs font-semibold tabular-nums text-gray-700">
              {formatMoney(lead.estimated_value_cents)}
            </span>
          ) : (
            <span className="text-xs text-gray-300">No value</span>
          )}

          {relDate && (
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                overdue
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {relDate}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}

// ── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  leads,
  onDragStart,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
}: {
  status: LeadStatus
  leads: Lead[]
  onDragStart: (id: string) => void
  onDrop: (status: LeadStatus) => void
  isDragOver: boolean
  onDragOver: () => void
  onDragLeave: () => void
}) {
  const totalValue = leads.reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0)

  const columnAccent: Record<LeadStatus, string> = {
    new:           'border-t-gray-400',
    contacted:     'border-t-blue-400',
    qualified:     'border-t-purple-400',
    proposal_sent: 'border-t-amber-400',
    won:           'border-t-green-500',
    lost:          'border-t-red-400',
  }

  return (
    <div
      className={`flex min-w-[220px] flex-1 flex-col rounded-xl border border-gray-200 bg-gray-50 transition-colors ${
        isDragOver ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-200' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(status)}
    >
      {/* Column header */}
      <div className={`border-t-4 rounded-t-xl px-3 pt-3 pb-2 ${columnAccent[status]}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {stageLabel(status)}
          </span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-gray-600 shadow-sm">
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="mt-0.5 text-xs font-medium text-gray-500 tabular-nums">
            {formatMoney(totalValue)}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 flex-1 min-h-[120px]">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-6 text-xs text-gray-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// ── List row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead }: { lead: Lead }) {
  const meta    = getLeadStatusMeta(lead.status)
  const overdue = isOverdue(lead.follow_up_date)
  const relDate = formatRelativeDate(lead.follow_up_date)

  return (
    <Link
      to={`/sales/leads/${lead.id}`}
      className="group flex items-center gap-4 border-b border-gray-100 px-5 py-3.5 transition-colors hover:bg-gray-50 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
          {lead.title}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{lead.client_name}</p>
      </div>

      <div className="hidden sm:flex items-center gap-5 shrink-0">
        {lead.estimated_value_cents != null && (
          <span className="text-sm font-semibold tabular-nums text-gray-900 w-24 text-right">
            {formatMoney(lead.estimated_value_cents)}
          </span>
        )}

        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${meta.color}`}>
          {meta.label}
        </span>

        {relDate && (
          <span className={`w-24 text-right text-xs font-medium ${overdue ? 'text-red-500' : 'text-amber-600'}`}>
            {relDate}
          </span>
        )}
      </div>

      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-400" />
    </Link>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'list'

export function SalesPage() {
  const { data: leads = [], isLoading } = useLeads()
  const updateStatus = useUpdateLeadStatus()

  const [view, setView]               = useState<ViewMode>('kanban')
  const [search, setSearch]           = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.client_name.toLowerCase().includes(q) ||
        (l.client_email ?? '').toLowerCase().includes(q),
    )
  }, [leads, search])

  const byStage = useMemo(() => {
    const map = {} as Record<LeadStatus, Lead[]>
    for (const s of PIPELINE_STAGES) map[s] = []
    for (const l of filtered) {
      if (map[l.status]) map[l.status].push(l)
    }
    return map
  }, [filtered])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const openLeads   = leads.filter((l) => l.status !== 'won' && l.status !== 'lost')
  const pipelineVal = openLeads.reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0)
  const wonLeads    = leads.filter((l) => l.status === 'won')
  const closedLeads = leads.filter((l) => l.status === 'won' || l.status === 'lost')
  const winRate     = closedLeads.length > 0
    ? Math.round((wonLeads.length / closedLeads.length) * 100)
    : null

  // ── DnD ───────────────────────────────────────────────────────────────────

  function handleDrop(targetStatus: LeadStatus) {
    if (!draggingId) return
    const lead = leads.find((l) => l.id === draggingId)
    if (lead && lead.status !== targetStatus) {
      updateStatus.mutate({ id: draggingId, status: targetStatus })
    }
    setDraggingId(null)
    setDragOverCol(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-5 pt-4 pb-0 lg:px-8 lg:pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Sales</h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm text-gray-500">
                {openLeads.length} open lead{openLeads.length !== 1 ? 's' : ''}
                {pipelineVal > 0 && ` · ${formatMoney(pipelineVal)} pipeline`}
                {winRate !== null && ` · ${winRate}% win rate`}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
            New Lead
          </button>
        </div>

        <SalesSubNav />

        {/* Search + view toggle */}
        <div className="mt-4 mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
            />
          </div>

          {/* View mode pills */}
          <div className="flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['kanban', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex h-8 items-center rounded-md px-3 text-xs font-medium capitalize transition-colors ${
                  view === v
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCreate && <CreateLeadModal onClose={() => setShowCreate(false)} />}

      {/* Content */}
      <div className="flex-1 overflow-auto pb-24 lg:pb-0">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : view === 'kanban' ? (
          // ── Kanban board ─────────────────────────────────────────────────
          <div className="flex gap-3 p-5 lg:p-8 overflow-x-auto min-h-full">
            {PIPELINE_STAGES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={byStage[status]}
                onDragStart={setDraggingId}
                onDrop={handleDrop}
                isDragOver={dragOverCol === status}
                onDragOver={() => setDragOverCol(status)}
                onDragLeave={() => setDragOverCol(null)}
              />
            ))}
          </div>
        ) : (
          // ── List view ─────────────────────────────────────────────────────
          <div className="mx-auto max-w-4xl px-5 pt-4 lg:px-8">
            {filtered.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                {search ? 'No leads match your search.' : 'No leads yet. Create your first lead.'}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
                {filtered.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
