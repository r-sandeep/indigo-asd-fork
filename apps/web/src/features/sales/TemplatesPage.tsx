import { useState } from 'react'
import { formatMoney } from '@indigo/shared'
import {
  useProposalTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from './useProposals'
import type { ProposalLineItemTemplate } from './types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@/components/ui/Icons'
import { SalesSubNav } from './SalesSubNav'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'all',      label: 'All' },
  { value: 'pricing',  label: 'Pricing' },
  { value: 'terms',    label: 'Terms' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'legal',    label: 'Legal' },
  { value: 'custom',   label: 'Custom' },
] as const

type CategoryFilter = typeof CATEGORIES[number]['value']

const CATEGORY_COLORS: Record<string, string> = {
  pricing:  'bg-blue-50 text-blue-700',
  terms:    'bg-purple-50 text-purple-700',
  warranty: 'bg-green-50 text-green-700',
  legal:    'bg-amber-50 text-amber-700',
  custom:   'bg-gray-100 text-gray-600',
}

// ── Draft type ────────────────────────────────────────────────────────────────

interface DraftTemplate {
  item_name:        string
  description:      string
  unit_price_cents: number | null
  category:         string
}

const BLANK: DraftTemplate = {
  item_name:        '',
  description:      '',
  unit_price_cents: null,
  category:         'custom',
}

// ── Inline edit row ───────────────────────────────────────────────────────────

function EditRow({
  draft,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  draft:     DraftTemplate
  onChange:  (d: DraftTemplate) => void
  onSave:    () => void
  onCancel:  () => void
  isSaving:  boolean
}) {
  function update<K extends keyof DraftTemplate>(field: K, value: DraftTemplate[K]) {
    onChange({ ...draft, [field]: value })
  }

  function handlePriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw   = e.target.value.replace(/[^0-9.]/g, '')
    const cents = raw ? Math.round(parseFloat(raw) * 100) : null
    onChange({ ...draft, unit_price_cents: cents })
  }

  return (
    <tr className="border-b border-brand-100 bg-brand-50/40">
      <td className="px-3 py-2 align-top">
        <input
          autoFocus
          type="text"
          value={draft.item_name}
          onChange={(e) => update('item_name', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
          placeholder="Item name"
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-100"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-100"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number"
          min="0"
          step="0.01"
          defaultValue={
            draft.unit_price_cents != null && draft.unit_price_cents > 0
              ? (draft.unit_price_cents / 100).toFixed(2)
              : ''
          }
          onBlur={handlePriceBlur}
          placeholder="0.00"
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-right text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-100"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={draft.category}
          onChange={(e) => update('category', e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-100"
        >
          {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1 pt-0.5">
          <button
            onClick={onSave}
            disabled={isSaving || !draft.item_name.trim()}
            title="Save"
            className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-40"
          >
            <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={onCancel}
            title="Cancel"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const { data: templates = [], isLoading } = useProposalTemplates()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [editingId, setEditingId]           = useState<string | 'new' | null>(null)
  const [draft, setDraft]                   = useState<DraftTemplate>(BLANK)
  const [deletingId, setDeletingId]         = useState<string | null>(null)

  const filtered = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter)

  function startNew() {
    setDraft(BLANK)
    setEditingId('new')
    setDeletingId(null)
  }

  function startEdit(t: ProposalLineItemTemplate) {
    setDraft({
      item_name:        t.item_name,
      description:      t.description ?? '',
      unit_price_cents: t.unit_price_cents ?? null,
      category:         t.category ?? 'custom',
    })
    setEditingId(t.id)
    setDeletingId(null)
  }

  async function handleSave() {
    if (!draft.item_name.trim()) return
    const payload = {
      item_name:        draft.item_name.trim(),
      description:      draft.description.trim() || undefined,
      unit_price_cents: draft.unit_price_cents ?? 0,
      category:         draft.category,
    }
    if (editingId === 'new') {
      await createTemplate.mutateAsync(payload)
    } else if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...payload })
    }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    await deleteTemplate.mutateAsync(id)
    setDeletingId(null)
  }

  const isMutating = createTemplate.isPending || updateTemplate.isPending

  return (
    <div className="flex h-full flex-col">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-5 pt-4 pb-0 lg:px-8 lg:pt-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-gray-900">Sales</h1>
          <button
            onClick={startNew}
            disabled={editingId === 'new'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
            New Template
          </button>
        </div>
        <SalesSubNav />
      </div>

      {/* ── Category filter ────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white px-5 py-3 lg:px-8">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                categoryFilter === c.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-1 text-xs text-gray-400 self-center">
            {templates.length} template{templates.length !== 1 ? 's' : ''} total
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Item Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                    <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Unit Price</th>
                    <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                    <th className="w-20 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>

                  {/* New template row (shown at top when adding) */}
                  {editingId === 'new' && (
                    <EditRow
                      draft={draft}
                      onChange={setDraft}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                      isSaving={isMutating}
                    />
                  )}

                  {/* Empty state */}
                  {filtered.length === 0 && editingId !== 'new' && (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-400">
                        {categoryFilter === 'all'
                          ? 'No templates yet — click "New Template" to build your library.'
                          : `No ${categoryFilter} templates. Try a different category or create one.`}
                      </td>
                    </tr>
                  )}

                  {/* Template rows */}
                  {filtered.map((t) =>
                    editingId === t.id ? (
                      <EditRow
                        key={t.id}
                        draft={draft}
                        onChange={setDraft}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                        isSaving={isMutating}
                      />
                    ) : (
                      <tr
                        key={t.id}
                        className="group border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 align-top font-medium text-gray-900">
                          {t.item_name}
                        </td>
                        <td className="px-4 py-3 align-top leading-relaxed text-gray-600 whitespace-pre-wrap">
                          {t.description || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 align-top text-right tabular-nums text-gray-900">
                          {t.unit_price_cents && t.unit_price_cents > 0
                            ? formatMoney(t.unit_price_cents)
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium capitalize ${
                              CATEGORY_COLORS[t.category ?? 'custom'] ?? CATEGORY_COLORS.custom
                            }`}
                          >
                            {t.category ?? 'custom'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {deletingId === t.id ? (
                            <div className="flex items-center gap-1 text-xs">
                              <button
                                onClick={() => handleDelete(t.id)}
                                disabled={deleteTemplate.isPending}
                                className="rounded px-2 py-1 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="rounded px-2 py-1 font-medium text-gray-500 transition-colors hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => startEdit(t)}
                                title="Edit"
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(t.id)}
                                title="Delete"
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {templates.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                Templates are reusable rows you can insert into any proposal. They save as drafts — unit price and description can always be edited per-proposal.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
