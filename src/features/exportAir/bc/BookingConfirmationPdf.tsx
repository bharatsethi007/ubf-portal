import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { registerConsignmentPdfFonts } from '@/features/tms/pdf/consignmentPdfShared'

/** Everything printed on the export air booking confirmation. Built from the booking, its consol and the TW accounts. */
export type BcData = {
  printedAt: string
  printedBy: string
  jobNo: string
  shipper: string[]
  consignee: string[]
  houseBill: string
  masterBill: string
  flight: string
  etd: string
  eta: string
  origin: string
  receipt: string
  discharge: string
  dest: string
  freight: string
  bookingRef: string
  weight: string
  volume: string
  packages: string
  cartage: string
  cutoff: string
  reference: string
  goods: string
  notes: string
  agent: string[]
}

const NAVY = '#0A2472'
const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 36, paddingHorizontal: 40, fontFamily: 'General Sans', fontSize: 8.5, color: '#111' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 120, height: 48, objectFit: 'contain' },
  ubf: { textAlign: 'right', fontSize: 8.5, lineHeight: 1.45 },
  ubfName: { fontWeight: 700, fontSize: 9 },
  titleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 14, borderBottomWidth: 1, borderColor: '#111', paddingBottom: 3, position: 'relative' },
  title: { fontSize: 14, fontWeight: 700 },
  stamp: { position: 'absolute', right: 0, bottom: 4, width: 150, textAlign: 'right', fontSize: 7.5 },
  parties: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#111' },
  party: { flex: 1, paddingVertical: 5, paddingHorizontal: 6 },
  partyL: { borderRightWidth: 1, borderColor: '#111' },
  h: { fontWeight: 700, fontSize: 8.5, marginBottom: 2 },
  line: { fontSize: 8.5, lineHeight: 1.35 },
  advise: { borderBottomWidth: 1, borderColor: '#111', paddingVertical: 3, paddingHorizontal: 6, fontSize: 8 },
  grid: { flexDirection: 'row', marginTop: 6 },
  col: { flex: 1, paddingHorizontal: 2 },
  row: { flexDirection: 'row', marginBottom: 1.5 },
  k: { width: 74, fontWeight: 700 },
  v: { flex: 1 },
  block: { marginTop: 12 },
  rule: { borderTopWidth: 1, borderColor: '#111', marginTop: 16 },
  foot: { borderBottomWidth: 1, borderColor: '#111', paddingVertical: 6 },
  printed: { position: 'absolute', bottom: 22, left: 40, fontSize: 7.5, color: '#333' },
})

const KV = ({ k, v }: { k: string; v: string }) => (
  <View style={s.row}><Text style={s.k}>{k}</Text><Text style={s.v}>{v || ' '}</Text></View>
)

export function BookingConfirmationDoc({ d }: { d: BcData }) {
  return (
    <Document title={`Booking Confirmation ${d.jobNo}`} author="UB Freight Limited">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Image src="/ub-logo-pdf.png" style={s.logo} />
          <View style={s.ubf}>
            <Text style={s.ubfName}>UB Freight Limited</Text>
            <Text>173 Montgomerie Road</Text>
            <Text>Airport Oaks, Auckland 2022, New Zealand</Text>
            <Text>Ph: +64 9 966 3850 | Email: info@ubfreight.com</Text>
            <Text>GST: 79-129-984</Text>
          </View>
        </View>

        <View style={s.titleRow}>
          <Text style={s.title}>Booking Confirmation</Text>
          <Text style={s.stamp}>{d.printedAt}</Text>
        </View>

        <View style={s.parties}>
          <View style={[s.party, s.partyL]}>
            <Text style={s.h}>Shipper</Text>
            {d.shipper.map((l, i) => <Text key={i} style={s.line}>{l}</Text>)}
          </View>
          <View style={s.party}>
            <Text style={s.h}>Consignee</Text>
            {d.consignee.map((l, i) => <Text key={i} style={s.line}>{l}</Text>)}
            <Text style={[s.line, { marginTop: 2 }]}><Text style={{ fontWeight: 700 }}>Job No: </Text>{d.jobNo} Dep: EA</Text>
          </View>
        </View>
        <Text style={s.advise}>Please be advised that the following shipment has been booked</Text>

        <View style={s.grid}>
          <View style={s.col}>
            <KV k="House Bill:" v={d.houseBill} />
            <KV k="Flight No" v={d.flight} />
            <KV k="Origin:" v={d.origin} />
            <KV k="Receipt:" v={d.receipt} />
            <KV k="Discharge:" v={d.discharge} />
            <KV k="Dest:" v={d.dest} />
            <KV k="Freight:" v={d.freight} />
            <KV k="Booking Ref:" v={d.bookingRef} />
          </View>
          <View style={s.col}>
            <KV k="Master Bill:" v={d.masterBill} />
            <KV k="ETD/ETA:" v={[d.etd, d.eta].filter(Boolean).join('   /   ')} />
            <KV k="Weight(kg):" v={d.weight} />
            <KV k="Volume(M3)" v={d.volume} />
            <KV k="Packages:" v={d.packages} />
            <KV k="Cartage Co:" v={d.cartage} />
            <KV k="Cut off/ITRM:" v={d.cutoff} />
          </View>
        </View>

        <View style={[s.grid, { marginTop: 14 }]}>
          <View style={s.col}>
            <Text style={s.h}>Reference</Text>
            <Text style={s.line}>{d.reference}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.h}>Depot</Text>
            {['U.B. FREIGHT LIMITED', '173 MONTGOMERIE ROAD', 'AIRPORT OAKS', 'CCA 13592F', 'AUCKLAND 2022 NEW ZEALAND'].map((l) => <Text key={l} style={s.line}>{l}</Text>)}
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.h}>Goods:</Text>
          <Text style={s.line}>{d.goods}</Text>
        </View>
        <View style={s.block}>
          <Text style={s.h}>Notes</Text>
          <Text style={s.line}>{d.notes}</Text>
        </View>

        <View style={s.rule} />
        <View style={s.foot}>
          <Text style={s.h}>Thank you for shipping with us.</Text>
          <Text style={s.h}>For delivery of freight, please contact our Destination Agent:</Text>
          {d.agent.map((l, i) => <Text key={i} style={s.line}>{l}</Text>)}
        </View>

        <Text style={s.printed} fixed>Printed by {d.printedBy}</Text>
        <Text style={{ position: 'absolute', bottom: 22, right: 40, fontSize: 7, color: NAVY }} fixed>{d.jobNo}</Text>
      </Page>
    </Document>
  )
}

export async function renderBcPdf(d: BcData): Promise<Blob> {
  registerConsignmentPdfFonts()
  return pdf(<BookingConfirmationDoc d={d} />).toBlob()
}
