import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { InvoiceLine } from '../billingApi'
import type { InvoiceDoc } from './invoiceDocApi'
import { UBF_COMPANY as C } from './invoicePdfConfig'

const NAVY = '#0A2472', INK = '#111827', MUTE = '#6B7280', LINE = '#D1D5DB', SOFT = '#F3F4F6', RED = '#B91C1C'

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 34, paddingHorizontal: 34, fontFamily: 'General Sans', fontSize: 8.4, color: INK, lineHeight: 1.35 },
  mark: { position: 'absolute', top: 360, left: -40, right: -40, alignItems: 'center' },
  markText: { fontSize: 84, fontWeight: 700, color: RED, opacity: 0.07, letterSpacing: 6, transform: 'rotate(-32deg)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 104, height: 56, objectFit: 'contain' },
  co: { alignItems: 'flex-end' },
  coName: { fontSize: 10.5, fontWeight: 700, color: NAVY, marginBottom: 2 },
  coLine: { fontSize: 8, color: INK },
  note: { marginTop: 8, padding: 6, borderWidth: 1, borderColor: RED, borderRadius: 3, backgroundColor: '#FEF2F2' },
  noteText: { color: RED, fontSize: 8.2, fontWeight: 600, textAlign: 'center' },
  bar: { marginTop: 8, paddingVertical: 5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: INK, flexDirection: 'row', alignItems: 'center' },
  barCell: { flex: 1, fontSize: 9.5, fontWeight: 600 },
  barTitle: { fontSize: 12, fontWeight: 700, color: NAVY, textAlign: 'right' },
  twoCol: { flexDirection: 'row', gap: 18, marginTop: 8 },
  col: { flex: 1 },
  k: { width: 74, fontSize: 7.4, fontWeight: 600, color: MUTE, letterSpacing: 0.3 },
  v: { flex: 1, fontSize: 8.4, fontWeight: 500 },
  row: { flexDirection: 'row', marginBottom: 2.4 },
  refLine: { fontSize: 8.4, fontWeight: 500 },
  billName: { fontSize: 9.5, fontWeight: 700 },
  acct: { fontSize: 7, color: MUTE, marginTop: 1 },
  ship: { marginTop: 7, paddingTop: 6, borderTopWidth: 0.75, borderColor: LINE, flexDirection: 'row', gap: 18 },
  tHead: { marginTop: 10, flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 4.5, paddingHorizontal: 6 },
  th: { color: '#FFFFFF', fontSize: 7.6, fontWeight: 600, letterSpacing: 0.3 },
  tRow: { flexDirection: 'row', paddingVertical: 2.8, paddingHorizontal: 6, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  cItem: { flex: 1 },
  cAmt: { width: 90, textAlign: 'right' },
  cGst: { width: 34, textAlign: 'center' },
  gap: { marginTop: 6, fontSize: 7.6, color: MUTE },
  queries: { marginTop: 10, textAlign: 'center', fontSize: 8, fontWeight: 600 },
  sumWrap: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1.5, borderColor: INK, paddingTop: 6 },
  codes: { fontSize: 7.6, color: MUTE },
  sumBox: { width: 220 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.6 },
  sumK: { fontSize: 9, fontWeight: 600 },
  sumV: { fontSize: 9, fontWeight: 600 },
  total: { borderTopWidth: 1, borderColor: INK, marginTop: 2, paddingTop: 3 },
  totalText: { fontSize: 10.5, fontWeight: 700, color: NAVY },
  terms: { marginTop: 6, fontSize: 6.8, color: MUTE, textAlign: 'center' },
  remit: { marginTop: 8, borderTopWidth: 1.5, borderColor: INK, paddingTop: 6, backgroundColor: SOFT, paddingHorizontal: 8, paddingBottom: 8 },
  remitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  remitTitle: { fontSize: 8.6, fontWeight: 700, color: NAVY, letterSpacing: 0.4 },
  small: { fontSize: 7.8 },
  foot: { position: 'absolute', bottom: 14, left: 34, right: 34, textAlign: 'center', fontSize: 6.8, color: MUTE },
})

const money = (n: number) => n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '')
const gstCode = (l: InvoiceLine) => l.gst_code ?? (l.gst_rate > 0 ? 'S' : 'Z')

function F({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null
  return <View style={s.row}><Text style={s.k}>{k}</Text><Text style={s.v}>{v}</Text></View>
}

type Props = { doc: InvoiceDoc; lines: InvoiceLine[]; logo: string }

/** Duplicate tax invoice, laid out like the CyberFreight print with cleaner type. */
export default function InvoicePdf({ doc: d, lines, logo }: Props) {
  const air = d.mode === 'air'
  const net = Math.round((d.total - d.gst) * 100) / 100
  const itemised = Math.abs(lines.reduce((n, l) => n + l.amount, 0) - net) < 0.5
  const route = [d.origin, d.destination].filter(Boolean)
  const refs = [...d.containers.map((c) => `${d.load_type ?? 'FCL'}/${c}`), d.customer_ref ? `Your ref ${d.customer_ref}` : null].filter(Boolean) as string[]

  return (
    <Document title={`UB Freight invoice ${d.invoice_no} (copy)`} author="UB Freight Limited">
      <Page size="A4" style={s.page}>
        <View style={s.mark} fixed><Text style={s.markText}>DUPLICATE</Text></View>

        <View style={s.head}>
          <Image src={logo} style={s.logo} />
          <View style={s.co}>
            <Text style={s.coName}>{C.name}</Text>
            {C.address.map((a) => <Text key={a} style={s.coLine}>{a}</Text>)}
            <Text style={s.coLine}>Ph: {C.phone}  |  Email: {C.email}</Text>
            <Text style={s.coLine}>GST: {C.gst}</Text>
          </View>
        </View>

        <View style={s.note}>
          <Text style={s.noteText}>DUPLICATE COPY. This is a copy for your records, not the original tax invoice. Please request the original invoice from our team through portal messages.</Text>
        </View>

        <View style={s.bar}>
          <Text style={s.barCell}>Date: {day(d.doc_date)}</Text>
          <Text style={s.barCell}>Due: {day(d.date_due)}</Text>
          <Text style={[s.barCell, s.barTitle, { flex: 1.6 }]}>TAX INVOICE: {d.invoice_no}</Text>
        </View>

        <View style={s.twoCol}>
          <View style={[s.col, s.row]}>
            <View style={{ width: 74 }}><Text style={s.k}>BILL TO</Text>{d.account_id && <Text style={s.acct}>{d.account_id}</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.billName}>{d.bill_name}</Text>
              {(d.bill_address ?? []).map((a, i) => <Text key={i}>{a}</Text>)}
            </View>
          </View>
          <View style={[s.col, s.row]}>
            <Text style={s.k}>REFERENCE</Text>
            <View style={{ flex: 1 }}>{refs.length ? refs.map((r) => <Text key={r} style={s.refLine}>{r}</Text>) : <Text style={s.refLine}>-</Text>}</View>
          </View>
        </View>

        {d.our_ref && (
          <View style={s.ship}>
            <View style={s.col}>
              <F k="OUR REF" v={d.our_ref} />
              <F k="GOODS" v={d.goods} />
              <F k={air ? 'FLIGHT' : 'VESSEL'} v={d.vessel} />
              <F k="PACKAGES" v={d.packages} />
              <F k="FROM / TO" v={route.join('  to  ')} />
            </View>
            <View style={s.col}>
              <F k="CONSIGNEE" v={d.consignee} />
              <F k={air ? 'MASTER AWB' : 'OCEAN BILL'} v={d.ocean_bill} />
              <F k={air ? 'HOUSE AWB' : 'HOUSE BILL'} v={d.house_bill} />
              <F k="SHIPPER" v={d.shipper} />
              <F k="ETD / ETA" v={[day(d.etd), day(d.eta)].filter(Boolean).join('  /  ')} />
            </View>
          </View>
        )}

        <View style={s.tHead}>
          <Text style={[s.th, s.cItem]}>ITEM</Text>
          <Text style={[s.th, s.cAmt]}>AMOUNT</Text>
          <Text style={[s.th, s.cGst]}>GST</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={s.tRow} wrap={false}>
            <Text style={s.cItem}>{l.description ?? l.code}</Text>
            <Text style={s.cAmt}>{money(l.amount)}</Text>
            <Text style={s.cGst}>{gstCode(l)}</Text>
          </View>
        ))}
        {!itemised && <Text style={s.gap}>Some charges on this invoice are not itemised here. The totals below are correct.</Text>}
        {d.comment && <Text style={[s.gap, { color: INK }]}>{d.comment}</Text>}

        <View wrap={false}>
          <Text style={s.queries}>{C.queries}</Text>
          <View style={s.sumWrap}>
            <Text style={s.codes}>GST codes: S = Standard, Z = GST free</Text>
            <View style={s.sumBox}>
              <View style={s.sumRow}><Text style={s.sumK}>SUB TOTAL: {d.currency}</Text><Text style={s.sumV}>{money(net)}</Text></View>
              <View style={s.sumRow}><Text style={s.sumK}>GST: {d.currency}</Text><Text style={s.sumV}>{money(d.gst)}</Text></View>
              <View style={[s.sumRow, s.total]}><Text style={s.totalText}>TOTAL: {d.currency}</Text><Text style={s.totalText}>{money(d.total)}</Text></View>
            </View>
          </View>
          <Text style={s.terms}>{C.terms}</Text>

          <View style={s.remit}>
            <View style={s.remitHead}>
              <Text style={s.remitTitle}>REMITTANCE ADVICE</Text>
              <Text style={s.small}>INVOICE: {d.account_id ? `${d.account_id}/` : ''}{d.invoice_no}</Text>
              <Text style={[s.small, { fontWeight: 700 }]}>TOTAL: {d.currency} {money(d.total)}</Text>
            </View>
            <View style={s.row}><Text style={s.k}>PLEASE REMIT TO</Text><Text style={s.v}>{C.remitTo}</Text></View>
            {d.our_ref && <View style={s.row}><Text style={s.k}>OUR REF</Text><Text style={s.v}>{d.our_ref}</Text></View>}
            <View style={s.row}><Text style={s.k}>BANK</Text><Text style={s.v}>{C.bank}  |  Swift code {C.swift}</Text></View>
            <View style={{ marginLeft: 74 }}>
              <Text style={s.small}>{C.accounts.join('   |   ')}</Text>
              {C.paymentNotes.map((n) => <Text key={n} style={[s.small, { marginTop: 1 }]}>{n}</Text>)}
            </View>
          </View>
        </View>

        <Text style={s.foot} fixed>Duplicate copy of tax invoice {d.invoice_no}. Not the original.</Text>
      </Page>
    </Document>
  )
}
