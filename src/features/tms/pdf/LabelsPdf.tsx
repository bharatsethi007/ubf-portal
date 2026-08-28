import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'
import { NAVY, INK, MUTED, MODE, fmtDate, refFooterText, GoodsMarkers } from './consignmentPdfShared'

const s = StyleSheet.create({
  page: { paddingVertical: 26, paddingHorizontal: 30, fontFamily: 'General Sans', color: INK },
  label: { borderWidth: 3, borderColor: INK, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 3, borderColor: INK },
  logo: { width: 92, height: 30, objectFit: 'contain' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: INK, color: '#fff', fontWeight: 700, fontSize: 10, letterSpacing: 1, paddingVertical: 4, paddingHorizontal: 8 },
  pcount: { fontWeight: 700, fontSize: 16 },
  from: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderColor: INK },
  cap: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  fromCo: { fontWeight: 700, marginTop: 1, fontSize: 12 },
  fromLn: { fontSize: 11, color: '#444' },
  pickup: { fontSize: 10, color: MUTED, marginTop: 4 },
  shipRow: { flexDirection: 'row', borderBottomWidth: 3, borderColor: INK },
  shipTo: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  toCo: { fontWeight: 700, fontSize: 26, lineHeight: 1.1, marginTop: 2 },
  toAddr: { fontSize: 14, color: '#222', marginTop: 4 },
  markers: { marginTop: 14 },
  pieceBox: { width: 132, paddingVertical: 10, alignItems: 'center', borderLeftWidth: 2, borderColor: INK },
  pieceCap: { fontSize: 9, color: MUTED, letterSpacing: 1 },
  pieceQr: { width: 104, height: 104, marginVertical: 4 },
  pieceNo: { fontSize: 12, fontWeight: 700 },
  cid: { textAlign: 'center', fontWeight: 700, fontSize: 30, letterSpacing: 1, paddingVertical: 10, borderBottomWidth: 3, borderColor: INK },
  barcodeWrap: { paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  barcode: { height: 66, width: 300, objectFit: 'contain' },
  foot: { paddingTop: 6, paddingBottom: 10, paddingHorizontal: 12, fontSize: 9, color: MUTED, borderTopWidth: 1, borderColor: '#cccccc' },
})

export default function LabelsPdf({ d, pieceQrUrls, barcodeUrl, logoUrl }: {
  d: TmsConsignmentDetail; pieceQrUrls: string[]; barcodeUrl: string; logoUrl: string
}) {
  const x = d as any
  const total = pieceQrUrls.length
  const modeLabel = x.mode ? MODE[x.mode] : ''
  const foot = refFooterText(d)
  const val = (v: unknown) => (v == null ? '' : String(v))
  return (
    <Document>
      {pieceQrUrls.map((pieceQr, i) => {
        const idx = i + 1
        return (
          <Page size="A4" style={s.page} key={idx}>
            <View style={s.label}>
              <View style={s.topBar}>
                <Image style={s.logo} src={logoUrl} />
                <View style={s.topRight}>
                  {modeLabel ? <Text style={s.badge}>{modeLabel}</Text> : null}
                  <Text style={s.pcount}>{idx} of {total}</Text>
                </View>
              </View>

              <View style={s.from}>
                <Text style={s.cap}>From</Text>
                <Text style={s.fromCo}>{val(d.sender_company)}</Text>
                <Text style={s.fromLn}>{val(d.sender_address)}</Text>
                <Text style={s.fromLn}>{[x.sender_contact, x.sender_phone].filter(Boolean).join('  ·  ')}</Text>
                <Text style={s.pickup}>Pickup: {fmtDate(x.picked_up_at ?? x.preferred_pickup_at) || '—'}</Text>
              </View>

              <View style={s.shipRow}>
                <View style={s.shipTo}>
                  <Text style={s.cap}>Ship to</Text>
                  <Text style={s.toCo}>{val(d.receiver_company)}</Text>
                  <Text style={s.toAddr}>{val(d.receiver_address)}</Text>
                  <View style={s.markers}><GoodsMarkers d={d} /></View>
                </View>
                <View style={s.pieceBox}>
                  <Text style={s.pieceCap}>PIECE</Text>
                  <Image style={s.pieceQr} src={pieceQr} />
                  <Text style={s.pieceNo}>{idx}/{total}</Text>
                </View>
              </View>

              <Text style={s.cid}>{val(d.consignment_no)}</Text>
              <View style={s.barcodeWrap}><Image style={s.barcode} src={barcodeUrl} /></View>
              {foot ? <Text style={s.foot}>{foot}</Text> : null}
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
