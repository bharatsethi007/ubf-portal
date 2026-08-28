import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'
import { NAVY, INK, MUTED, MODE, fmtDate, refFooterText, cargoTotals, GoodsMarkers } from './consignmentPdfShared'

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 30, paddingHorizontal: 34, fontFamily: 'General Sans', fontSize: 10, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 108, height: 54, objectFit: 'contain' },
  center: { alignItems: 'center', fontSize: 11 },
  ck: { fontWeight: 500 },
  badge: { marginTop: 4, backgroundColor: INK, color: '#fff', fontWeight: 600, fontSize: 9, letterSpacing: 1, paddingVertical: 3, paddingHorizontal: 7 },
  qr: { width: 84, height: 84 },
  parties: { flexDirection: 'row', borderWidth: 1.5, borderColor: INK, marginTop: 16 },
  party: { flex: 1, padding: 12 },
  partyL: { borderRightWidth: 1.5, borderColor: INK },
  label: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  co: { fontWeight: 600, marginTop: 3, fontSize: 12 },
  addr: { color: '#444', marginTop: 3 },
  meta: { color: MUTED, marginTop: 5, fontSize: 9 },
  tHead: { flexDirection: 'row', backgroundColor: NAVY, marginTop: 16 },
  th: { color: '#fff', fontSize: 9, fontWeight: 500, paddingVertical: 7, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eeeeee' },
  td: { fontSize: 9.5, paddingVertical: 7, paddingHorizontal: 6, color: '#3a4252' },
  totRow: { flexDirection: 'row', borderTopWidth: 2, borderColor: NAVY },
  tot: { fontSize: 9.5, fontWeight: 600, paddingVertical: 7, paddingHorizontal: 6, color: NAVY },
  cItems: { width: '11%' }, cType: { width: '20%' }, cDg: { width: '13%' },
  cDim: { width: '11%', textAlign: 'right' }, cCube: { width: '12%', textAlign: 'right' }, cKg: { width: '11%', textAlign: 'right' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 },
  barcode: { height: 62, width: 240, objectFit: 'contain' },
  foot: { marginTop: 12, paddingTop: 7, borderTopWidth: 1, borderColor: '#dddddd', fontSize: 9, color: MUTED },
  terms: { marginTop: 8, fontSize: 8, color: '#999999' },
})

export default function ConsignmentNotePdf({ d, qrUrl, barcodeUrl, logoUrl }: {
  d: TmsConsignmentDetail; qrUrl: string; barcodeUrl: string; logoUrl: string
}) {
  const x = d as any
  const dg = d.goods_type === 'dangerous'
  const t = cargoTotals(d)
  const foot = refFooterText(d)
  const val = (v: unknown) => (v == null || v === '' ? '' : String(v))
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src={logoUrl} />
          <View style={s.center}>
            <Text><Text style={s.ck}>Consignment ID: </Text>{val(d.consignment_no)}</Text>
            <Text style={{ marginTop: 2 }}><Text style={s.ck}>Pickup: </Text>{fmtDate(x.picked_up_at ?? x.preferred_pickup_at) || '—'}</Text>
            {x.mode ? <Text style={s.badge}>{MODE[x.mode] ?? ''}</Text> : null}
          </View>
          <Image style={s.qr} src={qrUrl} />
        </View>

        <View style={s.parties}>
          <View style={[s.party, s.partyL]}>
            <Text style={s.label}>Sender</Text>
            <Text style={s.co}>{val(d.sender_company)}</Text>
            <Text style={s.addr}>{val(d.sender_address)}</Text>
            <Text style={s.meta}>{[x.sender_contact, x.sender_phone].filter(Boolean).join('  ·  ')}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.label}>Receiver</Text>
            <Text style={s.co}>{val(d.receiver_company)}</Text>
            <Text style={s.addr}>{val(d.receiver_address)}</Text>
            <Text style={s.meta}>{[d.receiver_contact, d.receiver_phone].filter(Boolean).join('  ·  ')}</Text>
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cItems]}>Items</Text>
          <Text style={[s.th, s.cType]}>Type</Text>
          <Text style={[s.th, s.cDg]}>DG class</Text>
          <Text style={[s.th, s.cDim]}>H(cm)</Text>
          <Text style={[s.th, s.cDim]}>W(cm)</Text>
          <Text style={[s.th, s.cDim]}>L(cm)</Text>
          <Text style={[s.th, s.cCube]}>Cubic (m³)</Text>
          <Text style={[s.th, s.cKg]}>Kilos</Text>
        </View>
        {(d.cargo ?? []).map((l) => (
          <View style={s.tr} key={l.id} wrap={false}>
            <Text style={[s.td, s.cItems]}>{val(l.units)}</Text>
            <Text style={[s.td, s.cType]}>{val(l.type)}</Text>
            <Text style={[s.td, s.cDg, dg ? { color: '#e11d1d', fontWeight: 600 } : {}]}>{dg ? 'DG' : 'General'}</Text>
            <Text style={[s.td, s.cDim]}>{val(l.height_cm)}</Text>
            <Text style={[s.td, s.cDim]}>{val(l.width_cm)}</Text>
            <Text style={[s.td, s.cDim]}>{val(l.length_cm)}</Text>
            <Text style={[s.td, s.cCube]}>{val(l.total_cube_m3)}</Text>
            <Text style={[s.td, s.cKg]}>{val(l.weight_kg)}</Text>
          </View>
        ))}
        <View style={s.totRow}>
          <Text style={[s.tot, s.cItems]}>{t.units}</Text>
          <Text style={[s.tot, s.cType]} />
          <Text style={[s.tot, s.cDg]} />
          <Text style={[s.tot, s.cDim]} />
          <Text style={[s.tot, s.cDim]} />
          <Text style={[s.tot, s.cDim]} />
          <Text style={[s.tot, s.cCube]}>{t.cube.toFixed(4)}</Text>
          <Text style={[s.tot, s.cKg]}>{t.kg.toFixed(2)}</Text>
        </View>

        <View style={s.bottom}>
          <GoodsMarkers d={d} />
          <Image style={s.barcode} src={barcodeUrl} />
        </View>

        {foot ? <Text style={s.foot}>{foot}</Text> : null}
        <Text style={s.terms}>The agreement for freighting of goods, hereby evidenced, is subject to the conditions at ubfreight.com/terms-and-conditions</Text>
      </Page>
    </Document>
  )
}
