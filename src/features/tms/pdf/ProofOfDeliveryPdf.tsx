import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'
import { NAVY, INK, MUTED, MODE, fmtDate, refFooterText, cargoTotals, GoodsMarkers } from './consignmentPdfShared'

const GREEN = '#0f7b3f'
const fmtDateTime = (v: unknown) =>
  v ? new Date(v as string).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 22, paddingHorizontal: 34, fontFamily: 'General Sans', fontSize: 10, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 108, height: 54, objectFit: 'contain' },
  title: { fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: 1 },
  titleSub: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2, textAlign: 'center' },
  qr: { width: 84, height: 84 },
  band: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eaf6ee', borderWidth: 1, borderColor: '#bfe3cc', borderLeftWidth: 4, borderLeftColor: GREEN, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14 },
  bandK: { fontSize: 12, fontWeight: 700, color: GREEN, letterSpacing: 1 },
  bandV: { fontSize: 12, color: '#245c38', marginLeft: 10 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  idK: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  idV: { fontSize: 20, fontWeight: 700, color: NAVY, marginTop: 3 },
  parties: { flexDirection: 'row', borderWidth: 1.5, borderColor: INK, marginTop: 10 },
  party: { flex: 1, padding: 12 },
  partyL: { borderRightWidth: 1.5, borderColor: INK },
  label: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  co: { fontWeight: 700, marginTop: 3, fontSize: 12 },
  addr: { color: '#444', marginTop: 3 },
  meta: { color: MUTED, marginTop: 5, fontSize: 9 },
  detail: { flexDirection: 'row', borderWidth: 1, borderColor: '#dcdfe4', marginTop: 8 },
  dCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRightWidth: 1, borderColor: '#dcdfe4' },
  dCellLast: { borderRightWidth: 0 },
  dK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  dV: { fontSize: 11, fontWeight: 600, color: '#1c2233', marginTop: 3 },
  tHead: { flexDirection: 'row', backgroundColor: NAVY, marginTop: 10 },
  th: { color: '#fff', fontSize: 9, fontWeight: 700, paddingVertical: 7, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eeeeee' },
  td: { fontSize: 9.5, paddingVertical: 7, paddingHorizontal: 6, color: '#3a4252' },
  totRow: { flexDirection: 'row', borderTopWidth: 2, borderColor: NAVY },
  tot: { fontSize: 9.5, fontWeight: 700, paddingVertical: 7, paddingHorizontal: 6, color: NAVY },
  cItems: { width: '12%' }, cType: { width: '34%' }, cDim: { width: '13%', textAlign: 'right' }, cCube: { width: '15%', textAlign: 'right' }, cKg: { width: '13%', textAlign: 'right' },
  notes: { marginTop: 8, borderWidth: 1, borderColor: '#dcdfe4', borderLeftWidth: 4, borderLeftColor: NAVY, padding: 10 },
  notesK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  sigRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#dcdfe4', marginTop: 10 },
  sigCell: { flex: 1, padding: 12 },
  sigCellL: { borderRightWidth: 1, borderColor: '#dcdfe4' },
  sigK: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  sigName: { fontSize: 13, fontWeight: 600, color: '#1c2233', marginTop: 10 },
  sigLine: { marginTop: 16, borderBottomWidth: 1, borderColor: '#9099a8', height: 1 },
  sigBox: { marginTop: 6, height: 34, borderWidth: 1, borderColor: '#e6e8ec', borderStyle: 'dashed', borderRadius: 2 },
  sigImg: { marginTop: 6, height: 34, objectFit: 'contain' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  received: { fontSize: 10, color: '#3a4252', maxWidth: 260 },
  barcode: { height: 58, width: 220, objectFit: 'contain' },
  foot: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderColor: '#dddddd', fontSize: 9, color: MUTED },
  terms: { marginTop: 5, fontSize: 8, color: '#999999' },
})

export default function ProofOfDeliveryPdf({ d, qrUrl, barcodeUrl, logoUrl }: {
  d: TmsConsignmentDetail; qrUrl: string; barcodeUrl: string; logoUrl: string
}) {
  const x = d as any
  const t = cargoTotals(d)
  const foot = refFooterText(d)
  const val = (v: unknown) => (v == null || v === '' ? '' : String(v))
  const driver = x.driver1 ? `${x.driver1.first_name ?? ''} ${x.driver1.last_name ?? ''}`.trim() : '—'
  const notes = (x.driver_notes ?? '').trim()
  const receivedBy = (x.pod_received_by ?? '').trim()
  const sigUrl = (x.pod_signature_url ?? '').trim()
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src={logoUrl} />
          <View>
            <Text style={s.title}>PROOF OF DELIVERY</Text>
            {x.mode ? <Text style={s.titleSub}>{MODE[x.mode] ?? ''}</Text> : null}
          </View>
          <Image style={s.qr} src={qrUrl} />
        </View>

        <View style={s.band}>
          <Text style={s.bandK}>DELIVERED</Text>
          <Text style={s.bandV}>{fmtDateTime(x.delivered_at)}</Text>
        </View>

        <View style={s.idRow}>
          <View><Text style={s.idK}>Consignment</Text><Text style={s.idV}>{val(d.consignment_no)}</Text></View>
          <GoodsMarkers d={d} />
        </View>

        <View style={s.parties}>
          <View style={[s.party, s.partyL]}>
            <Text style={s.label}>Delivered to</Text>
            <Text style={s.co}>{val(d.receiver_company)}</Text>
            <Text style={s.addr}>{val(d.receiver_address)}</Text>
            <Text style={s.meta}>{[d.receiver_contact, d.receiver_phone].filter(Boolean).join('  ·  ')}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.label}>Sender</Text>
            <Text style={s.co}>{val(d.sender_company)}</Text>
            <Text style={s.addr}>{val(d.sender_address)}</Text>
            <Text style={s.meta}>{[x.sender_contact, x.sender_phone].filter(Boolean).join('  ·  ')}</Text>
          </View>
        </View>

        <View style={s.detail}>
          <View style={s.dCell}><Text style={s.dK}>Delivered at</Text><Text style={s.dV}>{fmtDateTime(x.delivered_at)}</Text></View>
          <View style={s.dCell}><Text style={s.dK}>Driver</Text><Text style={s.dV}>{driver}</Text></View>
          <View style={[s.dCell, s.dCellLast]}><Text style={s.dK}>Items delivered</Text><Text style={s.dV}>{t.units} {t.units === 1 ? 'piece' : 'pieces'}</Text></View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cItems]}>Items</Text>
          <Text style={[s.th, s.cType]}>Type</Text>
          <Text style={[s.th, s.cDim]}>H(cm)</Text>
          <Text style={[s.th, s.cDim]}>W(cm)</Text>
          <Text style={[s.th, s.cCube]}>Cubic (m³)</Text>
          <Text style={[s.th, s.cKg]}>Kilos</Text>
        </View>
        {(d.cargo ?? []).map((l) => (
          <View style={s.tr} key={l.id} wrap={false}>
            <Text style={[s.td, s.cItems]}>{val(l.units)}</Text>
            <Text style={[s.td, s.cType]}>{val(l.type)}</Text>
            <Text style={[s.td, s.cDim]}>{val(l.height_cm)}</Text>
            <Text style={[s.td, s.cDim]}>{val(l.width_cm)}</Text>
            <Text style={[s.td, s.cCube]}>{val(l.total_cube_m3)}</Text>
            <Text style={[s.td, s.cKg]}>{val(l.weight_kg)}</Text>
          </View>
        ))}
        <View style={s.totRow}>
          <Text style={[s.tot, s.cItems]}>{t.units}</Text>
          <Text style={[s.tot, s.cType]} />
          <Text style={[s.tot, s.cDim]} />
          <Text style={[s.tot, s.cDim]} />
          <Text style={[s.tot, s.cCube]}>{t.cube.toFixed(4)}</Text>
          <Text style={[s.tot, s.cKg]}>{t.kg.toFixed(2)}</Text>
        </View>

        {notes ? (
          <View style={s.notes}><Text style={s.notesK}>Delivery notes</Text><Text style={{ fontSize: 10, color: '#3a4252' }}>{notes}</Text></View>
        ) : null}

        <View style={s.sigRow}>
          <View style={[s.sigCell, s.sigCellL]}>
            <Text style={s.sigK}>Received by</Text>
            {receivedBy ? <Text style={s.sigName}>{receivedBy}</Text> : <View style={s.sigLine} />}
          </View>
          <View style={s.sigCell}>
            <Text style={s.sigK}>Signature</Text>
            {sigUrl ? <Image style={s.sigImg} src={sigUrl} /> : <View style={s.sigBox} />}
          </View>
        </View>

        <View style={s.bottom}>
          <Text style={s.received}>Goods recorded as delivered in good order by UB Freight at the date and time shown above.</Text>
          <Image style={s.barcode} src={barcodeUrl} />
        </View>

        {foot ? <Text style={s.foot}>{foot}</Text> : null}
        <Text style={s.terms}>Delivery of goods is subject to the conditions at ubfreight.com/terms-and-conditions</Text>
      </Page>
    </Document>
  )
}
