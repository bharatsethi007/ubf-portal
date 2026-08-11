import { Document, Page, View, Text, Image, Svg, Path, Line, StyleSheet } from '@react-pdf/renderer'
import { QUOTE_TERMS } from './quoteTerms'
import type { QuotePdfData, PdfOption } from './buildQuotePdfData'

const NAVY = '#002753', ORANGE = '#F99D29', BLACK = '#111111', MUTE = '#6b7280', LINE = '#e2e6ea', SOFT = '#f4f6f8'

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 26, paddingHorizontal: 30, fontSize: 7.5, color: BLACK, fontFamily: 'General Sans', fontWeight: 400, lineHeight: 1.3 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 92, height: 50, objectFit: 'contain' },
  hContact: { textAlign: 'right', color: BLACK, fontSize: 7.5, marginBottom: 2 },
  qBar: { marginTop: 10, backgroundColor: NAVY, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 26, paddingHorizontal: 12, borderRadius: 2 },
  qBarTitle: { color: '#fff', fontSize: 11.5, fontWeight: 700, letterSpacing: 2, lineHeight: 1 },
  qBarNo: { color: ORANGE, fontSize: 9, fontWeight: 600, letterSpacing: 1, lineHeight: 1 },
  qDateUnder: { textAlign: 'right', fontSize: 6.8, color: MUTE, fontFamily: 'Helvetica', fontStyle: 'italic', marginTop: 3 },
  route: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  routeEnd: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeText: { flexDirection: 'column' },
  flag: { width: 24, height: 16, borderRadius: 1.5, border: '0.5 solid ' + LINE, objectFit: 'cover' },
  flagBox: { width: 24, height: 16, borderRadius: 1.5, backgroundColor: SOFT },
  routeCode: { fontSize: 16, color: NAVY, fontWeight: 700, lineHeight: 1 },
  routeName: { fontSize: 6.5, color: MUTE, marginTop: 3, lineHeight: 1 },
  routeMid: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  grid: { marginTop: 12, flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  colLabel: { color: ORANGE, fontWeight: 700, fontSize: 8, letterSpacing: 0.4, marginBottom: 5, paddingBottom: 3, borderBottom: '1 solid ' + NAVY },
  field: { marginBottom: 4 },
  fieldK: { color: MUTE, fontSize: 6.5, fontWeight: 500, letterSpacing: 0.2 },
  fieldV: { color: BLACK, fontWeight: 600, fontSize: 7.8, marginTop: 0.5 },
  secHead: { marginTop: 12, color: NAVY, fontWeight: 700, fontSize: 8.5, letterSpacing: 0.5, marginBottom: 4 },
  tRow: { flexDirection: 'row', alignItems: 'center' },
  tHead: { backgroundColor: NAVY },
  tHeadCell: { color: '#fff', fontWeight: 600, fontSize: 6.6, letterSpacing: 0.2, paddingVertical: 4.5, paddingHorizontal: 4 },
  tCell: { fontSize: 7.3, paddingVertical: 3, paddingHorizontal: 4, color: BLACK },
  tRowB: { borderBottom: '0.5 solid ' + LINE },
  totalRow: { borderTop: '0.75 solid ' + NAVY, backgroundColor: SOFT },
  grpRow: { backgroundColor: SOFT },
  grpCell: { color: NAVY, fontWeight: 700, fontSize: 7, letterSpacing: 0.3, paddingVertical: 3.5, paddingHorizontal: 4 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totK: { color: MUTE, fontSize: 8, fontWeight: 500 },
  totV: { color: BLACK, fontWeight: 600, fontSize: 8 },
  grand: { borderTop: '1 solid ' + NAVY, marginTop: 3, paddingTop: 4 },
  grandK: { color: NAVY, fontWeight: 700, fontSize: 9.5 },
  grandV: { color: NAVY, fontWeight: 700, fontSize: 10 },
  notesWrap: { marginTop: 6 },
  noteLine: { color: BLACK, fontSize: 7.2, lineHeight: 1.4, marginBottom: 1.5 },
  termsHead: { color: NAVY, fontWeight: 700, fontSize: 10, marginBottom: 8, textAlign: 'center' },
  termRow: { flexDirection: 'row', marginBottom: 4 },
  termNo: { width: 13, color: BLACK, fontWeight: 600, fontSize: 7 },
  termTxt: { flex: 1, color: BLACK, fontSize: 7, lineHeight: 1.35 },
  subRow: { flexDirection: 'row', marginBottom: 2, marginLeft: 13 },
  subNo: { width: 13, color: BLACK, fontSize: 7 },
  optWrap: { marginTop: 10 },
  optHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2f7', borderLeft: '3 solid ' + ORANGE, paddingVertical: 4, paddingHorizontal: 8 },
  optHeadNo: { fontWeight: 700, color: NAVY, fontSize: 9, letterSpacing: 0.5 },
  optHeadRef: { color: MUTE, fontSize: 7.5, marginLeft: 6 },
  optHeadRight: { marginLeft: 'auto', color: NAVY, fontSize: 7.5, fontWeight: 500 },
  optMeta: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 2, borderBottom: '0.5 solid ' + LINE, marginBottom: 2 },
  optMetaItem: { flex: 1, flexDirection: 'column' },
  optMetaK: { color: MUTE, fontSize: 6, fontWeight: 500, letterSpacing: 0.3, marginBottom: 1.5, lineHeight: 1 },
  optMetaV: { color: NAVY, fontSize: 7.8, fontWeight: 600, lineHeight: 1 },
  optTotals: { marginTop: 4, alignSelf: 'flex-end', width: 200 },
  extNoteWrap: { marginTop: 12, paddingTop: 8, borderTop: '0.5px solid #d0d5dd' },
  extNoteLabel: { fontSize: 7, fontWeight: 600, color: BLACK, marginBottom: 3, letterSpacing: 0.3 },
  extNoteBody: { fontSize: 7.2, color: BLACK, lineHeight: 1.4 },
})

const CH: { k: 'desc' | 'qty' | 'unit' | 'min' | 'price' | 'ex' | 'tax' | 'frcr' | 'amt'; f: number; a: 'left' | 'right' }[] = [
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

function OptionBlock({ opt }: { opt: PdfOption }) {
  return (
    <View style={s.optWrap} wrap={false}>
      <View style={s.optHead}>
        <Text style={s.optHeadNo}>OPTION {opt.optionNo}</Text>
        <Text style={s.optHeadRef}>{opt.responseNo}</Text>
        <Text style={s.optHeadRight}>Valid till {opt.validTill}</Text>
      </View>
      <View style={s.optMeta}>
        <View style={s.optMetaItem}><Text style={s.optMetaK}>SHIPPING LINE</Text><Text style={s.optMetaV}>{opt.shippingLine || '\u2014'}</Text></View>
        <View style={s.optMetaItem}><Text style={s.optMetaK}>VIA</Text><Text style={s.optMetaV}>{opt.via || '\u2014'}</Text></View>
        <View style={s.optMetaItem}><Text style={s.optMetaK}>TRANSIT TIME</Text><Text style={s.optMetaV}>{opt.transitTime || '\u2014'}</Text></View>
        <View style={s.optMetaItem}><Text style={s.optMetaK}>FREE DAYS</Text><Text style={s.optMetaV}>{opt.freeDays || '\u2014'}</Text></View>
      </View>
      <View style={[s.tRow, s.tHead]}>
        {CH.map((c, i) => <Text key={i} style={[s.tHeadCell, { flex: c.f, textAlign: c.a }]}>{CHLABEL[c.k]}</Text>)}
      </View>
      {opt.charges.map((row, i) =>
        'grp' in row ? (
          <View key={i} style={[s.tRow, s.grpRow]}><Text style={s.grpCell}>{row.grp}</Text></View>
        ) : (
          <View key={i} style={[s.tRow, s.tRowB]}>
            {CH.map((col, j) => <Text key={j} style={[s.tCell, { flex: col.f, textAlign: col.a }]}>{row[col.k] || ''}</Text>)}
          </View>
        )
      )}
      <View style={s.optTotals}>
        <View style={s.totLine}><Text style={s.totK}>SUB TOTAL</Text><Text style={s.totV}>{opt.subTotal}</Text></View>
        <View style={[s.totLine, s.grand]}><Text style={s.grandK}>TOTAL</Text><Text style={s.grandV}>{opt.total}</Text></View>
      </View>
      {opt.notes.length > 0 && (
        <View style={s.notesWrap}>
          {opt.notes.map((n, i) => <Text key={i} style={s.noteLine}>{'\u2022  ' + n}</Text>)}
        </View>
      )}
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
        <Text style={s.qDateUnder}>Quote date: {data.quoteDate}</Text>

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
            {data.origin.shipper ? <Field k="SHIPPER" v={data.origin.shipper} /> : null}
            {data.origin.address ? <Field k="SHIPPER ADDRESS" v={data.origin.address} /> : null}
            <Field k={data.portLabel} v={data.origin.port} />
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>DESTINATION</Text>
            <Field k="CONSIGNEE" v={data.destination.consignee} />
            {data.destination.address ? <Field k="CONSIGNEE ADDRESS" v={data.destination.address} /> : null}
            <Field k={data.portLabel} v={data.destination.port} />
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>DETAILS</Text>
            <Field k="INCOTERMS" v={data.details.term} />
            <Field k="PO #" v={data.details.po} />
            <Field k="MOVEMENT TYPE" v={data.details.movement} />
            <Field k="SHIPMENT TYPE" v={data.details.shipmentType} />
          </View>
        </View>

        {data.commodities.length > 0 && (
          <>
            <Text style={s.secHead}>COMMODITIES</Text>
            {data.isFcl ? (
              <>
                <View style={[s.tRow, s.tHead]}>
                  <Text style={[s.tHeadCell, { flex: 2.4 }]}>DESCRIPTION</Text>
                  <Text style={[s.tHeadCell, { flex: 2.0 }]}>PACKAGE TYPE</Text>
                  <Text style={[s.tHeadCell, { flex: 1.1 }]}>GROSS WEIGHT</Text>
                  <Text style={[s.tHeadCell, { flex: 1.0 }]}>VOLUME (CBM)</Text>
                  <Text style={[s.tHeadCell, { flex: 0.9 }]}>INSURANCE</Text>
                  <Text style={[s.tHeadCell, { flex: 0.7 }]}>DG</Text>
                  <Text style={[s.tHeadCell, { flex: 0.9 }]}>STACK</Text>
                </View>
                {data.commodities.map((c, i) => (
                  <View key={i} style={[s.tRow, s.tRowB]}>
                    <Text style={[s.tCell, { flex: 2.4 }]}>{c.desc || ' '}</Text>
                    <Text style={[s.tCell, { flex: 2.0 }]}>{c.pkg}</Text>
                    <Text style={[s.tCell, { flex: 1.1 }]}>{c.gross}</Text>
                    <Text style={[s.tCell, { flex: 1.0 }]}>{c.vol}</Text>
                    <Text style={[s.tCell, { flex: 0.9 }]}>{data.cargoFlags.insurance}</Text>
                    <Text style={[s.tCell, { flex: 0.7 }]}>{data.cargoFlags.dg}</Text>
                    <Text style={[s.tCell, { flex: 0.9 }]}>{data.cargoFlags.stackable}</Text>
                  </View>
                ))}
                <View style={[s.tRow, s.totalRow]}>
                  <Text style={[s.tCell, { flex: 2.4, fontWeight: 700 }]}>TOTAL</Text>
                  <Text style={[s.tCell, { flex: 2.0, fontWeight: 700 }]}>{data.commTotal.units}</Text>
                  <Text style={[s.tCell, { flex: 1.1, fontWeight: 700 }]}>{data.commTotal.gross}</Text>
                  <Text style={[s.tCell, { flex: 1.0, fontWeight: 700 }]}>{data.commTotal.vol}</Text>
                  <Text style={[s.tCell, { flex: 0.9, fontWeight: 700 }]}>{''}</Text>
                  <Text style={[s.tCell, { flex: 0.7, fontWeight: 700 }]}>{''}</Text>
                  <Text style={[s.tCell, { flex: 0.9, fontWeight: 700 }]}>{''}</Text>
                </View>
              </>
            ) : (
              <>
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
          </>
        )}

        {data.options.map((opt) => <OptionBlock key={opt.optionNo} opt={opt} />)}

        {data.externalNote ? (
          <View style={s.extNoteWrap} wrap>
            <Text style={s.extNoteLabel}>NOTES</Text>
            <Text style={s.extNoteBody}>{data.externalNote}</Text>
          </View>
        ) : null}
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
