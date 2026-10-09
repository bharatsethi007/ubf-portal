import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { ClearanceAdviceData } from './clearanceAdviceApi'
import {
  Badge, Fields, Footer, Header, Hero, Timeline, s, type Field,
} from './ClearanceAdvicePdfParts'
import {
  bioBadge, customsBadge, dash, foodBadge, money, mpiOverall, nzDate, nzDateTime, qty, timeline,
} from './clearanceAdviceFormat'

const BROKER = 'U.B. Freight Ltd · Customs broker 40113262H'

function shipmentFields(d: ClearanceAdviceData): Field[] {
  const e = d.entry
  const c = d.customer
  const addr = [c?.address1, c?.address2, [c?.city, c?.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const route = [e.port_loading, e.port_discharge].filter(Boolean).join(' to ')
  return [
    { label: 'Importer', value: dash(d.customer?.name ?? e.customer_name ?? e.account_id), small: e.importer_code ? `Customs client code ${e.importer_code}` : undefined },
    { label: e.nature === 'Air' ? 'Flight' : 'Vessel', value: dash(e.vessel_flight), small: route ? `${route}${e.eta ? ` · ETA ${nzDate(e.eta)}` : ''}` : undefined },
    { label: 'Master bill', value: dash(e.master_bill), small: e.house_bill ? `House bill ${e.house_bill}` : undefined },
    { label: 'Supplier', value: dash(e.supplier) },
    { label: 'Packages', value: e.packages != null ? `${e.packages} ${e.pack_desc ?? ''}`.trim() : '—' },
    { label: 'Weight / volume', value: [e.gross_kg != null ? qty(e.gross_kg, 'kg') : '', e.cubic_m3 != null ? qty(e.cubic_m3, 'm³') : ''].filter(Boolean).join(' · ') || '—' },
    { label: 'Entry type', value: [e.entry_type, e.style, e.nature].filter(Boolean).join(' · ') || '—' },
    { label: 'Payment', value: dash(e.payment_method) },
    { label: 'Depot / ATF', value: [e.depot, e.atf_code].filter(Boolean).join(' · ') || '—' },
    ...(e.goods_desc ? [{ label: 'Goods', value: e.goods_desc, wide: true }] : []),
    ...(e.marks ? [{ label: 'Marks', value: e.marks, wide: true }] : []),
    ...(addr ? [{ label: 'Importer address', value: addr, wide: true }] : []),
  ]
}

function refs(d: ClearanceAdviceData): string {
  const e = d.entry
  return [`UBF job ${e.job_unique}`, d.bookingRef ? `Booking ${d.bookingRef}` : null, e.job_kind === 'customs_only' ? 'Customs only' : 'With UBF freight']
    .filter(Boolean).join(' · ')
}

export default function ClearanceAdvicePdf({ data, logo, generatedAt }: {
  data: ClearanceAdviceData; logo: string; generatedAt: string
}) {
  const e = data.entry
  const gen = `Generated ${nzDateTime(generatedAt)}`
  const customsRows = timeline(data.responses, 'customs', data.labels)
  const mpiRows = timeline(data.responses, 'mpi', data.labels)
  const directions = e.mpi_status === 'B05' && !e.mpi_bio_cleared_at

  return (
    <Document title={`Clearance advice ${e.entry_number ?? e.job_unique}`} author="U.B. Freight Ltd">
      <Page size="A4" style={s.page}>
        <Header logo={logo} title="Customs entry advice" sub={BROKER} badge={customsBadge(e)} />
        <Hero items={[
          { label: 'Entry number', value: dash(e.entry_number) },
          { label: 'Released', value: e.customs_released_at ? nzDateTime(e.customs_released_at) : '—' },
          { label: 'Duty and GST assessed', value: money(e.duty_total) },
        ]} />
        <Text style={s.small}>{refs(data)}</Text>
        <Text style={s.section}>SHIPMENT</Text>
        <Fields items={shipmentFields(data)} />
        <Text style={s.section}>NZ CUSTOMS RESPONSES</Text>
        <Timeline rows={customsRows} />
        <Footer left="UBF advice prepared from NZ Customs TSW responses. Not an official Customs document." generated={gen} />
      </Page>

      <Page size="A4" style={s.page}>
        <Header logo={logo} title="MPI clearance advice" sub={`${BROKER} · Entry ${dash(e.entry_number)}`} badge={mpiOverall(e)} />
        <Hero items={[
          { label: 'Biosecurity (BACC)', value: dash(e.bacc_number), extra: <Badge {...bioBadge(e)} /> },
          { label: 'Food (FACC)', value: dash(e.facc_number), extra: <Badge {...foodBadge(e)} /> },
          { label: 'Entry number', value: dash(e.entry_number) },
        ]} />
        <Text style={s.small}>{refs(data)}</Text>
        <Text style={s.section}>MPI RESPONSES</Text>
        <Timeline rows={mpiRows} />
        {directions ? (
          <View style={s.note}>
            <Text>
              Biosecurity directions apply. Inspection or treatment details are set out in the official
              BACC {dash(e.bacc_number)} issued by MPI, held by UBF. Ask UBF for a copy before moving the goods.
            </Text>
          </View>
        ) : null}
        <Footer left="UBF advice prepared from MPI responses via TSW. Not an official MPI document." generated={gen} />
      </Page>
    </Document>
  )
}
