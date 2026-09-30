import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { UBF_COMPANY as C } from './invoicePdfConfig'
import { BUCKETS, ageStatement, type Statement } from './statementModel'

const NAVY = '#0A2472', INK = '#111827', MUTE = '#6B7280', LINE = '#D1D5DB', SOFT = '#F3F4F6', RED = '#B91C1C'

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 34, paddingHorizontal: 30, fontFamily: 'General Sans', fontSize: 8, color: INK, lineHeight: 1.35 },
  mark: { position: 'absolute', top: 360, left: -40, right: -40, alignItems: 'center' },
  markText: { fontSize: 84, fontWeight: 700, color: RED, opacity: 0.07, letterSpacing: 6, transform: 'rotate(-32deg)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 104, height: 56, objectFit: 'contain' },
  co: { alignItems: 'flex-end' },
  coName: { fontSize: 10.5, fontWeight: 700, color: NAVY, marginBottom: 2 },
  note: { marginTop: 8, padding: 6, borderWidth: 1, borderColor: RED, borderRadius: 3, backgroundColor: '#FEF2F2' },
  noteText: { color: RED, fontSize: 8.2, fontWeight: 600, textAlign: 'center' },
  title: { marginTop: 8, fontSize: 15, fontWeight: 700, color: NAVY, textAlign: 'center', letterSpacing: 2 },
  bar: { marginTop: 4, paddingVertical: 4, borderBottomWidth: 1.5, borderColor: INK, flexDirection: 'row', justifyContent: 'space-between' },
  barText: { fontSize: 8.4, fontWeight: 600 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  billName: { fontSize: 9.5, fontWeight: 700 },
  acct: { fontSize: 9, fontWeight: 600 },
  tHead: { marginTop: 10, flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 4.5, paddingHorizontal: 4 },
  th: { color: '#FFFFFF', fontSize: 7.2, fontWeight: 600, letterSpacing: 0.2 },
  tRow: { flexDirection: 'row', paddingVertical: 2.6, paddingHorizontal: 4, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  cNo: { width: 54 }, cDate: { width: 50 }, cDue: { width: 50 }, cOur: { width: 70 }, cYour: { flex: 1 },
  cAmt: { width: 66, textAlign: 'right' }, cBal: { width: 66, textAlign: 'right' }, cRun: { width: 72, textAlign: 'right' },
  over: { color: RED },
  aging: { marginTop: 12, borderTopWidth: 1.5, borderBottomWidth: 0.75, borderColor: INK, flexDirection: 'row', paddingVertical: 5 },
  agCell: { flex: 1, alignItems: 'center' },
  agK: { fontSize: 7.6, fontWeight: 600, color: MUTE },
  agV: { fontSize: 9, fontWeight: 600, marginTop: 1 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sumK: { fontSize: 8.4, fontWeight: 600 },
  due: { marginTop: 4, flexDirection: 'row', justifyContent: 'flex-end', gap: 16, borderTopWidth: 1, borderColor: INK, paddingTop: 4 },
  dueText: { fontSize: 11, fontWeight: 700, color: NAVY },
  gapNote: { marginTop: 4, fontSize: 7, color: MUTE, textAlign: 'right' },
  remit: { marginTop: 10, borderTopWidth: 1.5, borderColor: INK, paddingTop: 6, backgroundColor: SOFT, paddingHorizontal: 8, paddingBottom: 8 },
  remitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  remitTitle: { fontSize: 8.6, fontWeight: 700, color: NAVY, letterSpacing: 0.4 },
  row: { flexDirection: 'row', marginBottom: 2.4 },
  k: { width: 74, fontSize: 7.4, fontWeight: 600, color: MUTE, letterSpacing: 0.3 },
  v: { flex: 1, fontSize: 8.2, fontWeight: 500 },
  small: { fontSize: 7.8 },
  foot: { position: 'absolute', bottom: 14, left: 30, right: 30, textAlign: 'center', fontSize: 6.8, color: MUTE },
})

const money = (n: number) => n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '')

type Props = { st: Statement; asOf: string; logo: string }

/** Duplicate statement of account, laid out like the CyberFreight print with cleaner type. Amounts in NZD. */
export default function StatementPdf({ st, asOf, logo }: Props) {
  const age = ageStatement(st.items, asOf)
  let run = 0
  const rows = st.items.map((i) => { run += i.balance; return { ...i, run } })

  return (
    <Document title={`UB Freight statement ${st.account_id} (copy)`} author="UB Freight Limited">
      <Page size="A4" style={s.page}>
        <View style={s.mark} fixed><Text style={s.markText}>DUPLICATE</Text></View>

        <View style={s.head}>
          <Image src={logo} style={s.logo} />
          <View style={s.co}>
            <Text style={s.coName}>{C.name}</Text>
            {C.address.map((a) => <Text key={a}>{a}</Text>)}
            <Text>Ph: {C.phone}  |  Email: {C.email}</Text>
            <Text>GST: {C.gst}</Text>
          </View>
        </View>

        <View style={s.note}>
          <Text style={s.noteText}>DUPLICATE COPY. This is a copy for your records, not the original statement. Please request the original statement from our team through portal messages.</Text>
        </View>

        <Text style={s.title}>STATEMENT</Text>
        <View style={s.bar}>
          <Text style={s.barText}>Statement date: {day(asOf)}</Text>
          <Text style={s.barText}>All amounts in NZD</Text>
        </View>

        <View style={s.billRow}>
          <View>
            <Text style={s.billName}>{st.bill_name}</Text>
            {(st.bill_address ?? []).map((a, i) => <Text key={i}>{a}</Text>)}
          </View>
          <Text style={s.acct}>Account: {st.account_id}</Text>
        </View>

        <View style={s.tHead} fixed>
          <Text style={[s.th, s.cNo]}>ITEM NO.</Text>
          <Text style={[s.th, s.cDate]}>DATE</Text>
          <Text style={[s.th, s.cDue]}>DUE</Text>
          <Text style={[s.th, s.cOur]}>OUR REF</Text>
          <Text style={[s.th, s.cYour]}>YOUR REF</Text>
          <Text style={[s.th, s.cAmt]}>AMOUNT</Text>
          <Text style={[s.th, s.cBal]}>BALANCE</Text>
          <Text style={[s.th, s.cRun]}>RUN TOTAL</Text>
        </View>
        {rows.map((r) => (
          <View key={r.invoice_no} style={s.tRow} wrap={false}>
            <Text style={s.cNo}>{r.invoice_no}</Text>
            <Text style={s.cDate}>{day(r.doc_date)}</Text>
            <Text style={[s.cDue, r.date_due < asOf ? s.over : {}]}>{day(r.date_due)}</Text>
            <Text style={s.cOur}>{r.our_ref ?? ''}</Text>
            <Text style={s.cYour}>{r.your_ref ?? ''}</Text>
            <Text style={s.cAmt}>{money(r.amount)}</Text>
            <Text style={s.cBal}>{money(r.balance)}</Text>
            <Text style={s.cRun}>{money(r.run)}</Text>
          </View>
        ))}
        {!rows.length && <Text style={{ marginTop: 8, color: MUTE }}>Nothing outstanding. Thank you.</Text>}

        <View wrap={false}>
          <View style={s.aging}>
            {BUCKETS.map((b) => (
              <View key={b.key} style={s.agCell}><Text style={s.agK}>{b.label}</Text><Text style={s.agV}>{money(age.buckets[b.key])}</Text></View>
            ))}
            <View style={s.agCell}><Text style={s.agK}>Total</Text><Text style={[s.agV, { fontWeight: 700 }]}>{money(age.total)}</Text></View>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumK}>Total disbursements: {money(age.disbursements)}</Text>
            <Text style={[s.sumK, age.overdue > 0.009 ? s.over : {}]}>Total overdue: {money(age.overdue)}</Text>
          </View>
          <View style={s.due}><Text style={s.dueText}>TOTAL DUE: NZD</Text><Text style={s.dueText}>{money(age.total)}</Text></View>
          <Text style={s.gapNote}>Amounts in NZD. Payments not yet matched to an invoice are not shown and may reduce the total due.</Text>

          <View style={s.remit}>
            <View style={s.remitHead}>
              <Text style={s.remitTitle}>REMITTANCE ADVICE</Text>
              <Text style={s.small}>ACCOUNT CODE: {st.account_id}</Text>
              <Text style={[s.small, { fontWeight: 700 }]}>TOTAL: NZD {money(age.total)}</Text>
            </View>
            <View style={s.row}><Text style={s.k}>PLEASE REMIT TO</Text><Text style={s.v}>{C.remitTo}</Text></View>
            <View style={s.row}><Text style={s.k}>BANK</Text><Text style={s.v}>{C.bank}  |  Swift code {C.swift}</Text></View>
            <View style={{ marginLeft: 74 }}>
              <Text style={s.small}>{C.accounts.join('   |   ')}</Text>
              {C.paymentNotes.map((n) => <Text key={n} style={[s.small, { marginTop: 1 }]}>{n}</Text>)}
            </View>
          </View>
        </View>

        <Text style={s.foot} fixed>Duplicate copy of statement for account {st.account_id} as at {day(asOf)}. Not the original.</Text>
      </Page>
    </Document>
  )
}
