import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Proposal, ProposalLineItem } from './types'
import { lineTotal } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  const dollars = Math.abs(cents / 100)
  const formatted =
    dollars % 1 === 0
      ? dollars.toLocaleString('en-US')
      : dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (cents < 0 ? '-$' : '$') + formatted
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        10,
    color:           '#111827',
    paddingTop:      54,
    paddingBottom:   54,
    paddingHorizontal: 54,
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoSquare: {
    width: 40, height: 40,
    backgroundColor: '#111827', borderRadius: 5,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  logoInitials: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#ffffff' },
  companyName:    { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#111827' },
  companyTagline: { fontSize: 7, letterSpacing: 2.5, color: '#374151', marginTop: 2 },
  contactInfo:    { fontSize: 9, color: '#6b7280', textAlign: 'right' },

  // Client / meta row
  clientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  clientName:    { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#111827' },
  clientAddress: { fontSize: 9, color: '#374151', marginTop: 2 },
  metaLabel:     { fontFamily: 'Helvetica-Bold' },
  metaValue:     { fontSize: 9, color: '#374151', textAlign: 'right' },

  // Title + body text
  proposalTitle: { fontFamily: 'Helvetica-Bold', fontSize: 17, color: '#111827', marginBottom: 16 },
  bodyText:      { fontSize: 9, color: '#374151', lineHeight: 1.55, marginBottom: 20 },

  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor:  '#f9fafb',
    borderTopWidth:   1, borderTopColor:    '#e5e7eb',
    borderBottomWidth: 2, borderBottomColor: '#e5e7eb',
    paddingVertical: 7, paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection:    'row',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    paddingVertical: 7, paddingHorizontal: 10,
  },
  th:     { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  tdBold: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#111827' },
  td:     { fontSize: 9, color: '#111827' },
  tdDesc: { fontSize: 8.5, color: '#4b5563', lineHeight: 1.4 },

  // Column widths
  colItem:  { flex: 2 },
  colDesc:  { flex: 4 },
  colUp:    { width: 68, textAlign: 'right' },
  colQty:   { width: 32, textAlign: 'right' },
  colPrice: { width: 68, textAlign: 'right' },

  // Total
  totalSection: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
    paddingTop: 12, marginTop: 6,
  },
  totalText: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#111827' },

  // Signature – unsigned
  legalNote:    { fontSize: 8, color: '#6b7280', fontFamily: 'Helvetica-Oblique', marginTop: 32, marginBottom: 16 },
  sigLinesRow:  { flexDirection: 'row' },
  sigLineBlock: { flex: 1, marginRight: 20 },
  sigLineLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151', marginBottom: 22 },
  sigUnderline: { borderBottomWidth: 1, borderBottomColor: '#374151' },

  // Signature – signed
  signedBox: {
    marginTop: 32,
    backgroundColor: '#f0fdf4',
    borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 6,
    padding: 14,
  },
  signedHeading: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#166534' },
  signedDetail:  { fontSize: 9, color: '#166534', marginTop: 4 },
  signedEmail:   { fontSize: 8, color: '#166534', marginTop: 2 },
})

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  proposal: Proposal
  items:    ProposalLineItem[]
}

export function ProposalPDFDocument({ proposal, items }: Props) {
  const total     = items.reduce((s, it) => s + lineTotal(it), 0)
  const printDate = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })

  const showItem  = proposal.col_item
  const showDesc  = proposal.col_description
  const showUp    = proposal.col_unit_price
  const showQty   = proposal.col_quantity
  const showPrice = proposal.col_price

  const addressLine2 = [proposal.job_city, proposal.job_state, proposal.job_zip].filter(Boolean).join(', ')

  return (
    <Document>
      <Page size="LETTER" style={S.page}>

        {/* ── Company header ──────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.logoRow}>
            <View style={S.logoSquare}>
              <Text style={S.logoInitials}>GGB</Text>
            </View>
            <View>
              <Text style={S.companyName}>GOOD GUY</Text>
              <Text style={S.companyTagline}>—BUILDERS—</Text>
            </View>
          </View>
          <View>
            <Text style={S.contactInfo}>Phone: (866) 466-3489</Text>
          </View>
        </View>

        {/* ── Client + date block ─────────────────────────────────────────── */}
        <View style={S.clientRow}>
          <View>
            {proposal.client_name ? (
              <Text style={S.clientName}>{proposal.client_name}</Text>
            ) : null}
            {proposal.job_address ? (
              <View style={{ marginTop: 4 }}>
                <Text style={S.clientAddress}>Job Address:</Text>
                <Text style={S.clientAddress}>{proposal.job_address}</Text>
                {addressLine2 ? <Text style={S.clientAddress}>{addressLine2}</Text> : null}
              </View>
            ) : null}
          </View>
          <View>
            <Text style={S.metaValue}>
              <Text style={S.metaLabel}>Print Date: </Text>
              {printDate}
            </Text>
          </View>
        </View>

        {/* ── Proposal title ──────────────────────────────────────────────── */}
        <Text style={S.proposalTitle}>{proposal.title}</Text>

        {/* ── Intro text ──────────────────────────────────────────────────── */}
        {proposal.intro_text ? (
          <Text style={S.bodyText}>{proposal.intro_text}</Text>
        ) : null}

        {/* ── Line items table ────────────────────────────────────────────── */}
        <View style={S.tableHeader}>
          {showItem  && <Text style={[S.th, S.colItem]}>Items</Text>}
          {showDesc  && <Text style={[S.th, S.colDesc]}>Description</Text>}
          {showUp    && <Text style={[S.th, S.colUp]}>Unit Price</Text>}
          {showQty   && <Text style={[S.th, S.colQty]}>Qty</Text>}
          {showPrice && <Text style={[S.th, S.colPrice]}>Price</Text>}
        </View>

        {items.map((item) => (
          <View key={item.id} style={S.tableRow} wrap={false}>
            {showItem  && <Text style={[S.tdBold, S.colItem]}>{item.item_name}</Text>}
            {showDesc  && <Text style={[S.tdDesc,  S.colDesc]}>{item.description}</Text>}
            {showUp    && <Text style={[S.td,      S.colUp]}>{fmt(item.unit_price_cents)}</Text>}
            {showQty   && (
              <Text style={[S.td, S.colQty]}>
                {item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2)}
              </Text>
            )}
            {showPrice && <Text style={[S.td, S.colPrice]}>{fmt(lineTotal(item))}</Text>}
          </View>
        ))}

        {/* ── Total ───────────────────────────────────────────────────────── */}
        <View style={S.totalSection}>
          <Text style={S.totalText}>Total Price: {fmt(total)}</Text>
        </View>

        {/* ── Closeout text ───────────────────────────────────────────────── */}
        {proposal.closeout_text ? (
          <Text style={[S.bodyText, { marginTop: 24 }]}>{proposal.closeout_text}</Text>
        ) : null}

        {/* ── Signature block ─────────────────────────────────────────────── */}
        {proposal.signed_at ? (
          <View style={S.signedBox}>
            <Text style={S.signedHeading}>Signed</Text>
            <Text style={S.signedDetail}>
              {proposal.signer_name}
              {'  ·  '}
              {new Date(proposal.signed_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
            {proposal.signer_email ? (
              <Text style={S.signedEmail}>{proposal.signer_email}</Text>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={S.legalNote}>
              I confirm that my action here represents my electronic signature and is binding.
            </Text>
            <View style={S.sigLinesRow}>
              {['Signature', 'Date', 'Print Name'].map((label) => (
                <View key={label} style={S.sigLineBlock}>
                  <Text style={S.sigLineLabel}>{label}:</Text>
                  <View style={S.sigUnderline} />
                </View>
              ))}
            </View>
          </View>
        )}

      </Page>
    </Document>
  )
}
