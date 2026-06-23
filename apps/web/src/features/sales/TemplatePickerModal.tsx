import { useState } from 'react'
import { useProposalTemplates, useCreateTemplate, useDeleteTemplate } from './useProposals'
import { useToast } from '@/stores/toastStore'
import { PlusIcon, TrashIcon, XMarkIcon, CheckIcon } from '@/components/ui/Icons'
import type { ProposalLineItem, ProposalLineItemTemplate } from './types'

interface Props {
  onInsert: (items: Omit<ProposalLineItem, 'id' | 'proposal_id' | 'tenant_id' | 'sort_order'>[]) => void
  onClose: () => void
}

const CATEGORIES = [
  { value: 'all',     label: 'All' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'terms',   label: 'Terms' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'legal',   label: 'Legal' },
  { value: 'custom',  label: 'Custom' },
]

export function TemplatePickerModal({ onInsert, onClose }: Props) {
  const { data: templates = [], isLoading } = useProposalTemplates()
  const createTemplate = useCreateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const toast          = useToast()

  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [category, setCategory]   = useState('all')
  const [showNew, setShowNew]     = useState(false)
  const [newItem, setNewItem]     = useState({
    item_name: '', description: '', unit_price_cents: '', category: 'custom',
  })

  const filtered = category === 'all'
    ? templates
    : templates.filter((t) => t.category === category)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleInsert() {
    const items = templates
      .filter((t) => selected.has(t.id))
      .map((t) => ({
        item_name:        t.item_name,
        description:      t.description,
        unit_price_cents: t.unit_price_cents,
        quantity:         1,
      }))
    onInsert(items)
    onClose()
  }

  async function handleSaveTemplate() {
    if (!newItem.item_name.trim()) return
    try {
      await createTemplate.mutateAsync({
        item_name:        newItem.item_name.trim(),
        description:      newItem.description.trim(),
        unit_price_cents: newItem.unit_price_cents
          ? Math.round(parseFloat(newItem.unit_price_cents) * 100) : 0,
        category: newItem.category,
      })
      setNewItem({ item_name: '', description: '', unit_price_cents: '', category: 'custom' })
      setShowNew(false)
      toast.success('Template saved')
    } catch {
      toast.error('Failed to save template')
    }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Line Item Templates</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-6 py-3 shrink-0">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-500">No templates yet.</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-2 text-xs text-brand-600 hover:underline"
              >
                Create your first template
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  selected={selected.has(t.id)}
                  onToggle={() => toggleSelect(t.id)}
                  onDelete={() => deleteTemplate.mutate(t.id)}
                />
              ))}
            </div>
          )}

          {/* New template form */}
          {showNew ? (
            <div className="mt-4 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700">New Template</p>
              <div className="space-y-2">
                <input className={inputCls} placeholder="Item name" value={newItem.item_name} onChange={(e) => setNewItem((f) => ({ ...f, item_name: e.target.value }))} autoFocus />
                <textarea
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
                  rows={2}
                  placeholder="Description"
                  value={newItem.description}
                  onChange={(e) => setNewItem((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="0" step="100" className={inputCls} placeholder="Price ($)" value={newItem.unit_price_cents} onChange={(e) => setNewItem((f) => ({ ...f, unit_price_cents: e.target.value }))} />
                  <select className={inputCls} value={newItem.category} onChange={(e) => setNewItem((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter((c) => c.value !== 'all').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button onClick={handleSaveTemplate} disabled={!newItem.item_name.trim() || createTemplate.isPending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {createTemplate.isPending ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
            >
              <PlusIcon className="h-4 w-4" strokeWidth={2} />
              Save new template
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 shrink-0">
          <p className="text-sm text-gray-500">
            {selected.size > 0 ? `${selected.size} selected` : 'Select items to add'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
            <button
              onClick={handleInsert}
              disabled={selected.size === 0}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Add {selected.size > 0 ? `${selected.size} Item${selected.size > 1 ? 's' : ''}` : 'Items'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateRow({
  template, selected, onToggle, onDelete,
}: {
  template: ProposalLineItemTemplate
  selected: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const price = template.unit_price_cents / 100

  return (
    <div
      className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        selected ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
      onClick={onToggle}
    >
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-gray-300'
      }`}>
        {selected && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{template.item_name}</p>
        {template.description && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{template.description}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-gray-800">
          {price !== 0 ? `$${price.toLocaleString()}` : '—'}
        </p>
        <span className="text-[10px] text-gray-400 capitalize">{template.category}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-1 text-gray-300 hover:text-red-500 transition-all"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
