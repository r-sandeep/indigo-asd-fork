import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@indigo/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposalData {
  id: string
  title: string
  proposal_number: string | null
  client_name: string | null
  client_email: string | null
  job_address: string | null
  job_city: string | null
  job_state: string | null
  job_zip: string | null
  intro_text: string | null
  closeout_text: string | null
  col_item: boolean
  col_description: boolean
  col_unit_price: boolean
  col_quantity: boolean
  col_price: boolean
  status: string
  portal_token: string | null
  sent_at: string | null
  viewed_at: string | null
  expires_at: string | null
  signed_at: string | null
  signer_name: string | null
  signer_email: string | null
  created_at: string
  updated_at: string
}

interface LineItemData {
  id: string
  sort_order: number
  item_name: string
  description: string
  unit_price_cents: number
  quantity: number
}

// ── Price formatting ──────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  const dollars = cents / 100
  const abs = Math.abs(dollars)
  const formatted = abs % 1 === 0
    ? abs.toLocaleString('en-US')
    : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return dollars < 0 ? `-$${formatted}` : `$${formatted}`
}

function lineTotal(item: LineItemData): number {
  return Math.round(item.unit_price_cents * item.quantity)
}

// ── Main component ────────────────────────────────────────────────────────────

export function PortalProposalPage() {
  const { token = '' } = useParams<{ token: string }>()

  const [proposal, setProposal]   = useState<ProposalData | null>(null)
  const [items, setItems]         = useState<LineItemData[]>([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)

  // Signing state
  const [showSignForm, setShowSignForm]   = useState(false)
  const [signerName, setSignerName]       = useState('')
  const [signerEmail, setSignerEmail]     = useState('')
  const [isSigning, setIsSigning]         = useState(false)
  const [signError, setSignError]         = useState('')
  const [justSigned, setJustSigned]       = useState(false)

  // Load proposal + items via security-definer RPCs
  useEffect(() => {
    if (!token) return

    async function load() {
      setLoading(true)
      try {
        // Fetch proposal
        const { data: propRows, error: propErr } = await supabase
          .rpc('get_proposal_by_token', { p_token: token })
        if (propErr || !propRows?.length) { setNotFound(true); return }
        const prop = propRows[0] as ProposalData
        setProposal(prop)

        // Pre-fill signer name/email from proposal
        if (prop.signer_name)  setSignerName(prop.signer_name)
        if (prop.client_email) setSignerEmail(prop.client_email)

        // Fetch line items
        const { data: itemRows, error: itemErr } = await supabase
          .rpc('get_proposal_line_items_by_token', { p_token: token })
        if (!itemErr && itemRows) setItems(itemRows as LineItemData[])

        // Record view (fire and forget)
        supabase.rpc('record_proposal_view', { p_token: token }).then(() => {})
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  async function handleSign() {
    if (!signerName.trim()) { setSignError('Please enter your name.'); return }
    setIsSigning(true)
    setSignError('')
    try {
      const { error } = await supabase.rpc('sign_proposal_by_token', {
        p_token:       token,
        p_signer_name: signerName.trim(),
        p_signer_email: signerEmail.trim() || '',
      })
      if (error) throw error
      setJustSigned(true)
      setShowSignForm(false)
      setProposal((p) => p ? { ...p, status: 'signed', signed_at: new Date().toISOString(), signer_name: signerName, signer_email: signerEmail } : p)
    } catch {
      setSignError('Something went wrong. Please try again.')
    } finally {
      setIsSigning(false)
    }
  }

  const printDate = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      </div>
    )
  }

  if (notFound || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <p className="text-4xl">🔍</p>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Proposal not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            This link may be invalid or the proposal may have been removed.
            Please contact your contractor.
          </p>
        </div>
      </div>
    )
  }

  const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date()
  const canSign   = !justSigned && proposal.status !== 'signed' && proposal.status !== 'declined' && !isExpired
  const isSigned  = proposal.status === 'signed' || justSigned
  const total     = items.reduce((s, it) => s + lineTotal(it), 0)

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { margin: 0.75in; }
        }
      `}</style>

      {/* Print/close bar */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <p className="text-sm text-gray-500">
          {isSigned
            ? '✅ This proposal has been signed.'
            : canSign
              ? 'Review the proposal below and sign at the bottom.'
              : ''}
        </p>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Document card */}
      <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-xl print:shadow-none print:rounded-none">
        <div className="px-12 py-10 text-[13px] text-gray-900">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-900 text-white font-bold text-2xl select-none">
                GGB
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 tracking-tight">GOOD GUY</p>
                <p className="text-xs font-semibold tracking-[0.25em] text-gray-700">—BUILDERS—</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Phone: (866) 466-3489</p>
            </div>
          </div>

          {/* ── Client block ──────────────────────────────────────── */}
          <div className="mb-6 flex items-start justify-between">
            <div className="text-sm text-gray-800 leading-relaxed">
              {proposal.client_name && <p className="font-medium">{proposal.client_name}</p>}
              {proposal.job_address && (
                <>
                  <p>Job Address:</p>
                  <p>{proposal.job_address}</p>
                  {(proposal.job_city || proposal.job_state) && (
                    <p>{[proposal.job_city, proposal.job_state, proposal.job_zip].filter(Boolean).join(', ')}</p>
                  )}
                </>
              )}
            </div>
            <div className="text-right text-sm text-gray-700">
              <p><span className="font-semibold">Print Date:</span> {printDate}</p>
            </div>
          </div>

          {/* ── Proposal title ────────────────────────────────────── */}
          <h1 className="mb-6 text-xl font-bold text-gray-900">{proposal.title}</h1>

          {/* ── Intro text ───────────────────────────────────────── */}
          {proposal.intro_text && (
            <div className="mb-8 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {proposal.intro_text}
            </div>
          )}

          {/* ── Expired warning ──────────────────────────────────── */}
          {isExpired && (
            <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm font-medium text-orange-800">
                This proposal expired on {new Date(proposal.expires_at!).toLocaleDateString()}.
                Please contact your contractor for a renewed proposal.
              </p>
            </div>
          )}

          {/* ── Line items table ─────────────────────────────────── */}
          <table className="w-full border-collapse text-sm" style={{ borderTop: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                {proposal.col_item        && <th className="px-4 py-3 text-left font-semibold text-gray-800 w-44">Items</th>}
                {proposal.col_description && <th className="px-4 py-3 text-left font-semibold text-gray-800">Description</th>}
                {proposal.col_unit_price  && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-28">Unit Price</th>}
                {proposal.col_quantity    && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-16">Qty</th>}
                {proposal.col_price       && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-28">Price</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lt = lineTotal(item)
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {proposal.col_item        && <td className="px-4 py-3 align-top font-semibold text-gray-900">{item.item_name}</td>}
                    {proposal.col_description && <td className="px-4 py-3 align-top text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</td>}
                    {proposal.col_unit_price  && <td className="px-4 py-3 align-top text-right tabular-nums text-gray-900">{formatPrice(item.unit_price_cents)}</td>}
                    {proposal.col_quantity    && <td className="px-4 py-3 align-top text-right tabular-nums text-gray-900">{item.quantity}</td>}
                    {proposal.col_price       && <td className="px-4 py-3 align-top text-right tabular-nums text-gray-900">{formatPrice(lt)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Total ───────────────────────────────────────────── */}
          <div className="mt-6 flex justify-end" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
            <p className="text-lg font-bold text-gray-900">
              Total Price: {formatMoney(total)}
            </p>
          </div>

          {/* ── Closeout text ─────────────────────────────────── */}
          {proposal.closeout_text && (
            <div className="mt-8 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {proposal.closeout_text}
            </div>
          )}

          {/* ── Signature section ────────────────────────────── */}
          <div className="mt-12">
            {isSigned ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6">
                <p className="text-base font-semibold text-green-800">✅ Proposal Signed</p>
                <p className="mt-2 text-sm text-green-700">
                  Signed by <strong>{proposal.signer_name}</strong>
                  {proposal.signed_at && (
                    <> on {new Date(proposal.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>
                  )}
                </p>
                {proposal.signer_email && (
                  <p className="text-xs text-green-600 mt-1">{proposal.signer_email}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="mb-6 text-sm text-gray-700 italic">
                  I confirm that my action here represents my electronic signature and is binding.
                </p>

                {!showSignForm ? (
                  <div className="grid grid-cols-3 gap-8 print:grid">
                    {['Signature', 'Date', 'Print Name'].map((label) => (
                      <div key={label}>
                        <p className="mb-2 text-sm font-semibold text-gray-800">{label}:</p>
                        <div style={{ borderBottom: '1px solid #374151', minHeight: '28px' }} />
                      </div>
                    ))}
                    {canSign && (
                      <div className="col-span-3 mt-6 no-print">
                        <button
                          onClick={() => setShowSignForm(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 transition-colors"
                        >
                          Sign This Proposal
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-print rounded-2xl border border-brand-200 bg-brand-50 p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">Sign Proposal</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Your full name"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={signerEmail}
                          onChange={(e) => setSignerEmail(e.target.value)}
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
                        />
                      </div>
                      {signError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{signError}</p>
                      )}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => setShowSignForm(false)}
                          className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSign}
                          disabled={isSigning || !signerName.trim()}
                          className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                          {isSigning ? 'Signing…' : 'Confirm & Sign'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 text-center">
                        By signing, you agree this electronic signature is legally binding.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="no-print mx-auto mt-6 max-w-3xl text-center">
        <p className="text-xs text-gray-400">
          Powered by Indigo · Good Guy Builders
        </p>
      </div>
    </div>
  )
}
