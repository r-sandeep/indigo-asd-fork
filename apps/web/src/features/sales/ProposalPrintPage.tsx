import { useParams } from 'react-router-dom'
import { useProposal, useProposalLineItems } from './useProposals'
import { lineTotal } from './types'
import { formatMoney } from '@indigo/shared'

// ── Print page ────────────────────────────────────────────────────────────────
// Opened in a new tab. User prints via browser Ctrl+P.
// Matches the layout of the Buildertrend PDF exactly.

function formatDisplayPrice(cents: number): string {
  const dollars = cents / 100
  const abs = Math.abs(dollars)
  const formatted = abs % 1 === 0
    ? abs.toLocaleString('en-US')
    : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return dollars < 0 ? `-$${formatted}` : `$${formatted}`
}

export function ProposalPrintPage() {
  const { proposalId = '' } = useParams<{ proposalId: string }>()

  const { data: proposal, isLoading: propLoading } = useProposal(proposalId)
  const { data: items = [], isLoading: itemsLoading } = useProposalLineItems(proposalId)

  if (propLoading || itemsLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  if (!proposal) {
    return <div className="p-8 text-sm text-gray-500">Proposal not found.</div>
  }

  const total       = items.reduce((s, it) => s + lineTotal(it), 0)
  const printDate   = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  const addressLine = [proposal.job_address, proposal.job_city, proposal.job_state, proposal.job_zip].filter(Boolean).join('\n')

  const showItem  = proposal.col_item
  const showDesc  = proposal.col_description
  const showUp    = proposal.col_unit_price
  const showQty   = proposal.col_quantity
  const showPrice = proposal.col_price

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 0.75in; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-brand-700 transition-colors"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-[850px] px-12 py-10 text-[13px] text-gray-900">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          {/* Logo placeholder — in production replace with <img src="/logo.png" /> */}
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

        {/* ── Client block ─────────────────────────────────────────── */}
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

        {/* ── Proposal title ───────────────────────────────────────── */}
        <h1 className="mb-6 text-xl font-bold text-gray-900">{proposal.title}</h1>

        {/* ── Intro text ───────────────────────────────────────────── */}
        {proposal.intro_text && (
          <div className="mb-8 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {proposal.intro_text}
          </div>
        )}

        {/* ── Line items table ─────────────────────────────────────── */}
        <table className="w-full border-collapse text-sm mb-0" style={{ borderTop: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              {showItem  && <th className="px-4 py-3 text-left font-semibold text-gray-800 w-44">Items</th>}
              {showDesc  && <th className="px-4 py-3 text-left font-semibold text-gray-800">Description</th>}
              {showUp    && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-28">Unit Price</th>}
              {showQty   && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-16">Qty</th>}
              {showPrice && <th className="px-4 py-3 text-right font-semibold text-gray-800 w-28">Price</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lt = lineTotal(item)
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
                  {showItem && (
                    <td className="px-4 py-3 align-top font-semibold text-gray-900 w-44">
                      {item.item_name}
                    </td>
                  )}
                  {showDesc && (
                    <td className="px-4 py-3 align-top text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </td>
                  )}
                  {showUp && (
                    <td className="px-4 py-3 align-top text-right text-gray-900 tabular-nums">
                      {formatDisplayPrice(item.unit_price_cents)}
                    </td>
                  )}
                  {showQty && (
                    <td className="px-4 py-3 align-top text-right text-gray-900 tabular-nums">
                      {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                    </td>
                  )}
                  {showPrice && (
                    <td className={`px-4 py-3 align-top text-right tabular-nums ${lt < 0 ? 'text-gray-900' : 'text-gray-900'}`}>
                      {formatDisplayPrice(lt)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ── Total ───────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-end" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
          <p className="text-lg font-bold text-gray-900">
            Total Price: {formatMoney(total)}
          </p>
        </div>

        {/* ── Closeout text ────────────────────────────────────────── */}
        {proposal.closeout_text && (
          <div className="mt-8 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {proposal.closeout_text}
          </div>
        )}

        {/* ── Signature block ──────────────────────────────────────── */}
        <div className="mt-12" style={{ pageBreakBefore: 'auto' }}>
          {proposal.signed_at ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <p className="text-sm font-semibold text-green-800">Signed</p>
              <p className="mt-1 text-sm text-green-700">
                {proposal.signer_name} &nbsp;·&nbsp; {new Date(proposal.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              {proposal.signer_email && (
                <p className="text-xs text-green-600 mt-0.5">{proposal.signer_email}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-6 text-sm text-gray-700 italic">
                I confirm that my action here represents my electronic signature and is binding.
              </p>
              <div className="grid grid-cols-3 gap-8">
                {['Signature', 'Date', 'Print Name'].map((label) => (
                  <div key={label}>
                    <p className="mb-2 text-sm font-semibold text-gray-800">{label}:</p>
                    <div style={{ borderBottom: '1px solid #374151', minHeight: '28px' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
