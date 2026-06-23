import { useState } from 'react'
import { useCreateLead } from './useLeads'
import { LEAD_SOURCES } from './types'
import { useToast } from '@/stores/toastStore'
import { XMarkIcon } from '@/components/ui/Icons'

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors'

const selectCls =
  'h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

interface Props {
  onClose: () => void
  onCreated?: (leadId: string) => void
}

export function CreateLeadModal({ onClose, onCreated }: Props) {
  const create = useCreateLead()
  const toast  = useToast()

  const [form, setForm] = useState({
    client_name:            '',
    client_email:           '',
    client_phone:           '',
    title:                  '',
    job_address:            '',
    job_city:               '',
    job_state:              'CA',
    job_zip:                '',
    job_type:               '',
    estimated_value_cents:  '',
    lead_source:            '',
    description:            '',
  })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim() || !form.title.trim()) return

    const valueCents = form.estimated_value_cents
      ? Math.round(parseFloat(form.estimated_value_cents) * 100)
      : undefined

    try {
      const lead = await create.mutateAsync({
        client_name:            form.client_name.trim(),
        client_email:           form.client_email.trim() || undefined,
        client_phone:           form.client_phone.trim() || undefined,
        title:                  form.title.trim(),
        job_address:            form.job_address.trim() || undefined,
        job_city:               form.job_city.trim() || undefined,
        job_state:              form.job_state.trim() || undefined,
        job_zip:                form.job_zip.trim() || undefined,
        job_type:               form.job_type || undefined,
        estimated_value_cents:  valueCents,
        lead_source:            form.lead_source || undefined,
        description:            form.description.trim() || undefined,
      })
      toast.success('Lead created')
      onCreated?.(lead.id)
      onClose()
    } catch {
      toast.error('Failed to create lead')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">New Lead</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Client Name" required>
                  <input
                    className={inputCls}
                    placeholder="e.g. Michael and Natalia Robinson"
                    value={form.client_name}
                    onChange={(e) => set('client_name', e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="client@example.com"
                  value={form.client_email}
                  onChange={(e) => set('client_email', e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="(707) 555-0100"
                  value={form.client_phone}
                  onChange={(e) => set('client_phone', e.target.value)}
                />
              </Field>
            </div>

            <hr className="border-gray-100" />

            {/* Job */}
            <Field label="Lead Title" required>
              <input
                className={inputCls}
                placeholder="e.g. Robinson Sonoma Home Renovation"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Job Address">
                  <input
                    className={inputCls}
                    placeholder="1376 Grayson Ave"
                    value={form.job_address}
                    onChange={(e) => set('job_address', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="City">
                <input
                  className={inputCls}
                  placeholder="St Helena"
                  value={form.job_city}
                  onChange={(e) => set('job_city', e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="State">
                  <input
                    className={inputCls}
                    placeholder="CA"
                    maxLength={2}
                    value={form.job_state}
                    onChange={(e) => set('job_state', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Zip">
                  <input
                    className={inputCls}
                    placeholder="94574"
                    value={form.job_zip}
                    onChange={(e) => set('job_zip', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Job Type">
                <select
                  className={selectCls}
                  value={form.job_type}
                  onChange={(e) => set('job_type', e.target.value)}
                >
                  <option value="">— Select —</option>
                  <option value="remodel">Remodel</option>
                  <option value="new_construction">New Construction</option>
                  <option value="addition">Addition</option>
                  <option value="adu">ADU</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Estimated Value ($)">
                <input
                  type="number"
                  min="0"
                  step="500"
                  className={inputCls}
                  placeholder="500000"
                  value={form.estimated_value_cents}
                  onChange={(e) => set('estimated_value_cents', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Lead Source">
                <select
                  className={selectCls}
                  value={form.lead_source}
                  onChange={(e) => set('lead_source', e.target.value)}
                >
                  <option value="">— Select —</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors resize-none"
                rows={3}
                placeholder="Any initial notes about this lead..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !form.client_name.trim() || !form.title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {create.isPending ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
