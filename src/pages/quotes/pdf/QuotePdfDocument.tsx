import { Document, Page, View, Text, Image, Svg, Path, Line, StyleSheet } from '@react-pdf/renderer'
import { QUOTE_TERMS } from './quoteTerms'
import type { QuotePdfData, PdfCharge } from './buildQuotePdfData'

const NAVY = '#002753', ORANGE = '#F99D29', BLACK = '#111111', MUTE = '#6b7280', LINE = '#e2e6ea', SOFT = '#f4f6f8'

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 26, paddingHorizontal: 30, fontSize: 7.5, color: BLACK, fontFamily: 'General Sans', fontWeight: 400, lineHeight: 1.3 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 92, height: 50, objectFit: 'contain' },
  hContact: { textAlign: 'right', color: BLACK, fontSize: 7.5, marginBottom: 2 },
  qBar: { marginTop: 10, backgroundColor: NAVY, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 26, paddingHorizontal: 12, borderRadius: 2 },
  qBarTitle: { color: '#fff', fontSize: 11.5, fontWeight: 700, letterSpacing: 2, lineHeight: 1 },
  qBarNo: { color: ORANGE, fontSize: 9, fontWeight: 600, letterSpacing: 1, lineHeight: 1 },
  route: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  routeEnd: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeText: { flexDirection: 'column' },
  flag: { width: 24, height: 16, borderRadius: 1.5, border: '0.5 solid ' + LINE, objectFit: 'cover' },
  flagBox: { width: 24, height: 16, borderRadius: 1.5, backgroundColor: SOFT },
  routeCode: { fontSize: 16, color: NAVY, fontWeight: 700, lineHeight: 1 },
  routeName: { fontSize: 6.5, color: MUTE, marginTop: 3, lineHeight: 1 },
  routeMid: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  grid: { marginTop: 14, flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  colLabel: { color: ORANGE, fontWeight: 700, fontSize: 8, letterSpacing: 0.4, marginBottom: 5, paddingBottom: 3, borderBottom: '1 solid ' + NAVY },
  field: { marginBottom: 4 },
  fieldK: { color: MUTE, fontSize: 6.5, fontWeight: 500, letterSpacing: 0.2 },
  fieldV: { color: BLACK, fontWeight: 600, fontSize: 7.8, marginTop: 0.5 },
  secHead: { marginTop: 14, color: NAVY, fontWeight: 700, fontSize: 8.5, letterSpacing: 0.5, marginBottom: 4 },
  tRow: { flexDirection: 'row', alignItems: 'center' },
  tHead: { backgroundColor: NAVY },
  tHeadCell: { color: '#fff', fontWeight: 600, fontSize: 6.6, letterSpacing: 0.2, paddingVertical: 4.5, paddingHorizontal: 4 },
  tCell: { fontSize: 7.3, paddingVertical: 4, paddingHorizontal: 4, color: BLACK },
  tRowB: { borderBottom: '0.5 solid ' + LINE },
  totalRow: { borderTop: '0.75 solid ' + NAVY, backgroundColor: SOFT },
  grpRow: { backgroundColor: SOFT },
  grpCell: { color: NAVY, fontWeight: 700, fontSize: 7, letterSpacing: 0.3, paddingVertical: 3.5, paddingHorizontal: 4 },
  meta: { marginTop: 12, flexDirection: 'row', borderTop: '0.5 solid ' + LINE, borderBottom: '0.5 solid ' + LINE, paddingVertical: 7 },
  metaItem: { flex: 1, flexDirection: 'column' },
  metaK: { color: MUTE, fontSize: 6.5, fontWeight: 500, letterSpacing: 0.3, marginBottom: 2, lineHeight: 1 },
  metaV: { color: NAVY, fontWeight: 600, fontSize: 8.5, lineHeight: 1 },
  totals: { marginTop: 8, alignSelf: 'flex-end', width: 200 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totK: { color: MUTE, fontSize: 8, fontWeight: 500 },
  totV: { color: BLACK, fontWeight: 600, fontSize: 8 },
  grand: { borderTop: '1 solid ' + NAVY, marginTop: 3, paddingTop: 4 },
  grandK: { color: NAVY, fontWeight: 700, fontSize: 9.5 },
  grandV: { color: NAVY, fontWeight: 700, fontSize: 10 },
  notesWrap: { marginTop: 14 },
  noteLine: { color: BLACK, fontSize: 7.2, lineHeight: 1.4, marginBottom: 1.5 },
  termsHead: { color: NAVY, fontWeight: 700, fontSize: 10, marginBottom: 8, textAlign: 'center' },
  termRow: { flexDirection: 'row', marginBottom: 4 },
  termNo: { width: 13, color: BLACK, fontWeight: 600, fontSize: 7 },
  termTxt: { flex: 1, color: BLACK, fontSize: 7, lineHeight: 1.35 },
  subRow: { flexDirection: 'row', marginBottom: 2, marginLeft: 13 },
  subNo: { width: 13, color: BLACK, fontSize: 7 },
})

const CH: { k: keyof Extract<PdfCharge, { desc: string }>; f: number; a: 'left' | 'right' }[] = [
  { k: 'desc', f: 2.7, a: 'left' }, { k: 'qty', f: 0.7, a: 'left' }, { k: 'unit', f: 1.8, a: 'left' },
  { k: 'min', f: 1.0, a: 'left' }, { k: 'price', f: 1.0, a: 'left' }, { k: 'ex', f: 0.8, a: 'left' },
  { k: 'tax', f: 0.6, a: 'left' }, { k: 'frcr', f: 1.1, a: 'right' }, { k: 'amt', f: 1.15, a: 'right' },
]
const CHLABEL: Record<string, string> = { desc: 'DESCRIPTION', qty: 'QTY', unit: 'UNIT', min: 'MINIMUM', price: 'PRICE', ex: 'EX. RATE', tax: 'TAX', frcr: 'FR.CR', amt: 'AMOUNT' }

function Field({ k, v }: { k: string; v: string }) {
  if (!v) return null
  return (<View style={s.field}><Text style={s.fieldK}>{k}</Text><Text style={s.fieldV}>{v}</Text></View>)
}

function RouteEnd({ code, name, cc }: { code: string; name: string; cc: string | null }) {
  return (
    <View style={s.routeEnd}>
      {cc ? <Image style={s.flag} src={`https://flagcdn.com/w40/${cc}.png`} /> : <View style={s.flagBox} />}
      <View style={s.routeText}>
        <Text style={s.routeCode}>{code}</Text>
        {name ? <Text style={s.routeName}>{name}</Text> : null}
      </View>
    </View>
  )
}

function MidIcon({ mode }: { mode: 'air' | 'sea' }) {
  return (
    <View style={s.routeMid}>
      {mode === 'air' ? (
        <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M2.5 19l19-7L2.5 5l0 5.2 12 1.8-12 1.8z" fill={NAVY} /></Svg>
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" fill="none" stroke={NAVY} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" fill="none" stroke={NAVY} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6M12 10v4M12 2v3" fill="none" stroke={NAVY} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Svg width="100%" height={4} style={{ marginTop: 2 }}><Line x1={0} y1={2} x2={400} y2={2} stroke={LINE} strokeWidth={1} /></Svg>
    </View>
  )
}

export default function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headRow}>
          <Image style={s.logo} src="/ub-logo-pdf.png" />
          <View>
            <Text style={s.hContact}>{data.company.email}</Text>
            <Text style={s.hContact}>{data.company.phone}</Text>
          </View>
        </View>

        <View style={s.qBar}>
          <Text style={s.qBarTitle}>QUOTATION</Text>
          <Text style={s.qBarNo}>{data.quoteNo}</Text>
        </View>

        <View style={s.route}>
          <RouteEnd code={data.from.code} name={data.from.name} cc={data.from.cc} />
          <MidIcon mode={data.mode} />
          <RouteEnd code={data.to.code} name={data.to.name} cc={data.to.cc} />
        </View>

        <View style={s.grid}>
          <View style={s.col}>
            <Text style={s.colLabel}>REQUESTED BY</Text>
            <Field k="NAME / COMPANY" v={data.requestedBy.company} />
            <Field k="PRIMARY CONTACT" v={data.requestedBy.contact} />
            <Field k="ADDRESS" v={data.requestedBy.address} />
            <Field k="PHONE" v={data.requestedBy.phone} />
            <Field k="EMAIL" v={data.requestedBy.email} />
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>ORIGIN</Text>
            <Field k={data.portLabel} v={data.origin.port} />
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>DESTINATION</Text>
            <Field k="CONSIGNEE" v={data.destination.consignee} />
            <Field k="CONSIGNEE ADDRESS" v={data.destination.address} />
            <Field k={data.portLabel} v={data.destination.port} />
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>DETAILS</Text>
            <Field k="QUOTATION #" v={data.details.quoteNo} />
            <Field k="PO #" v={data.details.po} />
            <Field k="SHIPMENT TYPE" v={data.details.shipmentType} />
            <Field k="MOVEMENT TYPE" v={data.details.movement} />
            <Field k="SHIPMENT TERM" v={data.details.term} />
          </View>
        </View>

        {data.commodities.length > 0 && (
          <>
            <Text style={s.secHead}>COMMODITIES</Text>
            <View style={[s.tRow, s.tHead]}>
              <Text style={[s.tHeadCell, { flex: 2.6 }]}>DESCRIPTION</Text>
              <Text style={[s.tHeadCell, { flex: 2.2 }]}>PACKAGE TYPE</Text>
              <Text style={[s.tHeadCell, { flex: 1.1 }]}>GROSS WEIGHT</Text>
              <Text style={[s.tHeadCell, { flex: 1.1 }]}>VOLUME (CBM)</Text>
              <Text style={[s.tHeadCell, { flex: 1.3 }]}>CHARGEABLE WEIGHT</Text>
            </View>
            {data.commodities.map((c, i) => (
              <View key={i} style={[s.tRow, s.tRowB]}>
                <Text style={[s.tCell, { flex: 2.6 }]}>{c.desc || ' '}</Text>
                <Text style={[s.tCell, { flex: 2.2 }]}>{c.pkg}</Text>
                <Text style={[s.tCell, { flex: 1.1 }]}>{c.gross}</Text>
                <Text style={[s.tCell, { flex: 1.1 }]}>{c.vol}</Text>
                <Text style={[s.tCell, { flex: 1.3 }]}>{c.chg}</Text>
              </View>
            ))}
            <View style={[s.tRow, s.totalRow]}>
              <Text style={[s.tCell, { flex: 2.6, fontWeight: 700 }]}>TOTAL</Text>
              <Text style={[s.tCell, { flex: 2.2, fontWeight: 700 }]}>{data.commTotal.units}</Text>
              <Text style={[s.tCell, { flex: 1.1, fontWeight: 700 }]}>{data.commTotal.gross}</Text>
              <Text style={[s.tCell, { flex: 1.1, fontWeight: 700 }]}>{data.commTotal.vol}</Text>
              <Text style={[s.tCell, { flex: 1.3, fontWeight: 700 }]}>{data.commTotal.chg}</Text>
            </View>
          </>
        )}

        <View style={s.meta}>
          <View style={s.metaItem}><Text style={s.metaK}>QUOTE DATE</Text><Text style={s.metaV}>{data.quoteDate}</Text></View>
          <View style={s.metaItem}><Text style={s.metaK}>VALID FROM</Text><Text style={s.metaV}>{data.validFrom}</Text></View>
          <View style={s.metaItem}><Text style={s.metaK}>VALID TILL</Text><Text style={s.metaV}>{data.validTill}</Text></View>
          <View style={s.metaItem}><Text style={s.metaK}>CURRENCY</Text><Text style={s.metaV}>{data.currency}</Text></View>
        </View>

        <View style={[s.tRow, s.tHead, { marginTop: 12 }]}>
          {CH.map((c, i) => <Text key={i} style={[s.tHeadCell, { flex: c.f, textAlign: c.a }]}>{CHLABEL[c.k]}</Text>)}
        </View>
        {data.charges.map((row, i) =>
          'grp' in row ? (
            <View key={i} style={[s.tRow, s.grpRow]}><Text style={s.grpCell}>{row.grp}</Text></View>
          ) : (
            <View key={i} style={[s.tRow, s.tRowB]}>
              {CH.map((col, j) => <Text key={j} style={[s.tCell, { flex: col.f, textAlign: col.a }]}>{row[col.k] || ''}</Text>)}
            </View>
          )
        )}

        <View style={s.totals}>
          <View style={s.totLine}><Text style={s.totK}>SUB TOTAL</Text><Text style={s.totV}>{data.subTotal}</Text></View>
          <View style={[s.totLine, s.grand]}><Text style={s.grandK}>TOTAL</Text><Text style={s.grandV}>{data.total}</Text></View>
        </View>

        {data.notes.length > 0 && (
          <View style={s.notesWrap}>
            <Text style={s.secHead}>NOTES</Text>
            {data.notes.map((n, i) => <Text key={i} style={s.noteLine}>{'\u2022  ' + n}</Text>)}
          </View>
        )}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.termsHead}>Quotation Terms & Conditions</Text>
        {QUOTE_TERMS.map((t, i) =>
          typeof t === 'string' ? (
            <View key={i} style={s.termRow}><Text style={s.termNo}>{i + 1}.</Text><Text style={s.termTxt}>{t}</Text></View>
          ) : (
            <View key={i}>
              <View style={s.termRow}><Text style={s.termNo}>{i + 1}.</Text><Text style={s.termTxt}>{t.t}</Text></View>
              {t.subs.map((sub, j) => <View key={j} style={s.subRow}><Text style={s.subNo}>{j + 1}.</Text><Text style={s.termTxt}>{sub}</Text></View>)}
            </View>
          )
        )}
      </Page>
    </Document>
  )
}
