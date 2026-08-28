import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { NAVY, INK, MUTED, fmtDate } from './consignmentPdfShared'

export type CheckinPdfLine = { type: string; units: number | null; weight_kg: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null; total_cube_m3: number | null }
export type CheckinPdfData = {
  sheetNo: string | null; checkedInAt: string | null; mode: string | null; refInput: string | null; reference: string | null
  shipperCompany: string | null; shipperAddress: string | null
  consigneeCompany: string | null; port: string | null; knownCustomer: boolean
  goodsType: string; screenAt: string | null; deliveredByName: string | null; receivedByName: string
  screening: { label: string; value: 'yes' | 'no' | null }[]
  comments: string | null; lines: CheckinPdfLine[]; signatureDataUrl: string | null
}

const GREEN = '#0f7b3f'
const fmtDateTime = (v: unknown) =>
  v ? new Date(v as string).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const num = (v: number | null) => (v == null ? '' : String(v))

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 22, paddingHorizontal: 34, fontFamily: 'General Sans', fontSize: 10, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 108, height: 54, objectFit: 'contain' },
  title: { fontSize: 15, fontWeight: 600, color: NAVY, letterSpacing: 1, textAlign: 'right' },
  titleSub: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2, textAlign: 'right' },
  band: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eaf6ee', borderWidth: 1, borderColor: '#bfe3cc', borderLeftWidth: 4, borderLeftColor: GREEN, marginTop: 12, paddingVertical: 9, paddingHorizontal: 14 },
  bandK: { fontSize: 12, fontWeight: 600, color: GREEN, letterSpacing: 1 },
  bandV: { fontSize: 12, color: '#245c38', marginLeft: 10 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  idK: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  idV: { fontSize: 20, fontWeight: 700, color: NAVY, marginTop: 3 },
  chip: { fontSize: 10, fontWeight: 600, color: NAVY, borderWidth: 1, borderColor: NAVY, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  parties: { flexDirection: 'row', borderWidth: 1.5, borderColor: INK, marginTop: 10 },
  party: { flex: 1, padding: 12 },
  partyL: { borderRightWidth: 1.5, borderColor: INK },
  label: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  co: { fontWeight: 600, marginTop: 3, fontSize: 12 },
  addr: { color: '#444', marginTop: 3 },
  detail: { flexDirection: 'row', borderWidth: 1, borderColor: '#dcdfe4', marginTop: 8 },
  dCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRightWidth: 1, borderColor: '#dcdfe4' },
  dCellLast: { borderRightWidth: 0 },
  dK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  dV: { fontSize: 11, fontWeight: 600, color: '#1c2233', marginTop: 3 },
  tHead: { flexDirection: 'row', backgroundColor: NAVY, marginTop: 10 },
  th: { color: '#fff', fontSize: 9, fontWeight: 500, paddingVertical: 7, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eeeeee' },
  td: { fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 6, color: '#3a4252' },
  totRow: { flexDirection: 'row', borderTopWidth: 2, borderColor: NAVY },
  tot: { fontSize: 9.5, fontWeight: 600, paddingVertical: 6, paddingHorizontal: 6, color: NAVY },
  cUnits: { width: '10%' }, cType: { width: '30%' }, cDim: { width: '11%', textAlign: 'right' }, cCube: { width: '14%', textAlign: 'right' }, cKg: { width: '12%', textAlign: 'right' },
  secK: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  screenGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  screenItem: { width: '50%', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingRight: 14, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  screenL: { fontSize: 9.5, color: '#3a4252' },
  screenV: { fontSize: 9.5, fontWeight: 600 },
  notes: { marginTop: 10, borderWidth: 1, borderColor: '#dcdfe4', borderLeftWidth: 4, borderLeftColor: NAVY, padding: 10 },
  notesK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  sigRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#dcdfe4', marginTop: 10 },
  sigCell: { flex: 1, padding: 12 },
  sigCellL: { borderRightWidth: 1, borderColor: '#dcdfe4' },
  sigK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  sigName: { fontSize: 13, fontWeight: 600, color: '#1c2233', marginTop: 8 },
  sigImg: { marginTop: 6, height: 44, objectFit: 'contain' },
  sigBox: { marginTop: 6, height: 44, borderWidth: 1, borderColor: '#e6e8ec', borderStyle: 'dashed', borderRadius: 2 },
  foot: { marginTop: 12, paddingTop: 7, borderTopWidth: 1, borderColor: '#dddddd', fontSize: 9, color: MUTED },
})

const yn = (v: 'yes' | 'no' | null) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—')

export default function CheckinSheetPdf({ data, logoUrl }: { data: CheckinPdfData; logoUrl: string }) {
  const t = data.lines.reduce((a, l) => ({ units: a.units + (l.units ?? 0), cube: a.cube + (l.total_cube_m3 ?? 0), kg: a.kg + (l.weight_kg ?? 0) }), { units: 0, cube: 0, kg: 0 })
  const val = (v: unknown) => (v == null || v === '' ? '' : String(v))
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src={logoUrl} />
          <View>
            <Text style={s.title}>CHECK-IN SHEET</Text>
            {data.mode ? <Text style={s.titleSub}>{data.mode.toUpperCase()} FREIGHT</Text> : null}
          </View>
        </View>

        <View style={s.band}>
          <Text style={s.bandK}>CHECKED IN</Text>
          <Text style={s.bandV}>{fmtDateTime(data.checkedInAt)}</Text>
        </View>

        <View style={s.idRow}>
          <View><Text style={s.idK}>Sheet</Text><Text style={s.idV}>{val(data.sheetNo) || '—'}</Text></View>
          {data.knownCustomer ? <Text style={s.chip}>KNOWN CUSTOMER</Text> : null}
        </View>

        <View style={s.parties}>
          <View style={[s.party, s.partyL]}>
            <Text style={s.label}>Shipper</Text>
            <Text style={s.co}>{val(data.shipperCompany) || '—'}</Text>
            <Text style={s.addr}>{val(data.shipperAddress)}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.label}>Consignee</Text>
            <Text style={s.co}>{val(data.consigneeCompany) || '—'}</Text>
            <Text style={s.addr}>{data.mode === 'Air' || data.mode?.toLowerCase() === 'air' ? 'Airport: ' : 'Port: '}{val(data.port) || '—'}</Text>
          </View>
        </View>

        <View style={s.detail}>
          <View style={s.dCell}><Text style={s.dK}>Reference</Text><Text style={s.dV}>{val(data.refInput) || val(data.reference) || '—'}</Text></View>
          <View style={s.dCell}><Text style={s.dK}>Screened</Text><Text style={s.dV}>{data.screenAt ? fmtDate(data.screenAt) : '—'}</Text></View>
          <View style={[s.dCell, s.dCellLast]}><Text style={s.dK}>Goods</Text><Text style={s.dV}>{data.goodsType === 'dangerous' ? 'Dangerous' : 'General'}</Text></View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cUnits]}>Units</Text>
          <Text style={[s.th, s.cType]}>Type</Text>
          <Text style={[s.th, s.cDim]}>L</Text>
          <Text style={[s.th, s.cDim]}>W</Text>
          <Text style={[s.th, s.cDim]}>H</Text>
          <Text style={[s.th, s.cCube]}>Cubic (m³)</Text>
          <Text style={[s.th, s.cKg]}>Kg</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, s.cUnits]}>{num(l.units)}</Text>
            <Text style={[s.td, s.cType]}>{l.type}</Text>
            <Text style={[s.td, s.cDim]}>{num(l.length_cm)}</Text>
            <Text style={[s.td, s.cDim]}>{num(l.width_cm)}</Text>
            <Text style={[s.td, s.cDim]}>{num(l.height_cm)}</Text>
            <Text style={[s.td, s.cCube]}>{(l.total_cube_m3 ?? 0).toFixed(4)}</Text>
            <Text style={[s.td, s.cKg]}>{num(l.weight_kg)}</Text>
          </View>
        ))}
        <View style={s.totRow}>
          <Text style={[s.tot, s.cUnits]}>{t.units}</Text>
          <Text style={[s.tot, s.cType]}>Total</Text>
          <Text style={[s.tot, s.cDim]}> </Text>
          <Text style={[s.tot, s.cDim]}> </Text>
          <Text style={[s.tot, s.cDim]}> </Text>
          <Text style={[s.tot, s.cCube]}>{t.cube.toFixed(4)}</Text>
          <Text style={[s.tot, s.cKg]}>{t.kg}</Text>
        </View>

        <Text style={s.secK}>Screening</Text>
        <View style={s.screenGrid}>
          {data.screening.map((it) => (
            <View key={it.label} style={s.screenItem}>
              <Text style={s.screenL}>{it.label}</Text>
              <Text style={[s.screenV, { color: it.value === 'no' ? '#e11d1d' : it.value === 'yes' ? GREEN : MUTED }]}>{yn(it.value)}</Text>
            </View>
          ))}
        </View>

        {data.comments ? (
          <View style={s.notes}><Text style={s.notesK}>Comments</Text><Text>{data.comments}</Text></View>
        ) : null}

        <View style={s.sigRow}>
          <View style={[s.sigCell, s.sigCellL]}>
            <Text style={s.sigK}>Received by</Text>
            <Text style={s.sigName}>{data.receivedByName || '—'}</Text>
            {data.deliveredByName ? <Text style={[s.dK, { marginTop: 6 }]}>Driver: {data.deliveredByName}</Text> : null}
          </View>
          <View style={s.sigCell}>
            <Text style={s.sigK}>Signature</Text>
            {data.signatureDataUrl ? <Image style={s.sigImg} src={data.signatureDataUrl} /> : <View style={s.sigBox} />}
          </View>
        </View>

        <Text style={s.foot}>UB Freight — Pacific trade specialists. Generated {fmtDate(new Date().toISOString())}.</Text>
      </Page>
    </Document>
  )
}
