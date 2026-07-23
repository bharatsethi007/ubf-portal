import { Badge } from '@/components/ui/badge'
import type { JobDetailBooking, JobDetailShipment } from '../jobDetailApi'

type Source = 'ERP' | 'Manual'

type Field = {
  label: string
  value: string | null | undefined
  source: Source
}

function fmt(v: string | number | boolean | null | undefined): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function dual(erp: string | null | undefined, manual: string | null | undefined): { value: string | null; source: Source } {
  if (erp) return { value: erp, source: 'ERP' }
  if (manual) return { value: manual, source: 'Manual' }
  return { value: null, source: 'Manual' }
}

function FieldRow({ label, value, source }: Field) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-2 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="nums text-[13px]">{value ?? '—'}</span>
      <Badge variant="outline" className="text-[10px]">
        {source}
      </Badge>
    </div>
  )
}

type Props = {
  booking: JobDetailBooking
  shipment: JobDetailShipment | null
}

export default function OverviewTab({ booking, shipment }: Props) {
  const eta = dual(shipment?.eta, booking.m_eta)
  const line = dual(shipment?.vessel_flight, booking.m_shipping_line)
  const port = dual(shipment?.destination, booking.m_discharge_port)
  const origin = dual(shipment?.origin, booking.origin)
  const atf = dual(null, booking.m_atf)

  const fields: Field[] = [
    { label: 'Booking ref', value: fmt(booking.booking_ref), source: 'Manual' },
    { label: 'Job #', value: fmt(booking.job_no ?? shipment?.job_no), source: shipment ? 'ERP' : 'Manual' },
    { label: 'House bill', value: fmt(shipment?.house_bill), source: 'ERP' },
    { label: 'Master bill', value: fmt(shipment?.master_bill), source: 'ERP' },
    { label: 'Status', value: fmt(shipment?.status ?? booking.status), source: shipment?.status ? 'ERP' : 'Manual' },
    { label: 'Origin', value: origin.value, source: origin.source },
    { label: 'Discharge port', value: port.value, source: port.source },
    { label: 'ETA', value: eta.value, source: eta.source },
    { label: 'ETD', value: fmt(shipment?.etd ?? booking.etd), source: shipment?.etd ? 'ERP' : 'Manual' },
    { label: 'ATF', value: atf.value, source: atf.source },
    { label: 'Shipping line', value: line.value, source: line.source },
    { label: 'Departed', value: fmt(shipment?.departed), source: 'ERP' },
    { label: 'Arrived', value: fmt(shipment?.arrived), source: 'ERP' },
    { label: 'SWB released', value: fmt(booking.swb_released), source: 'Manual' },
    { label: 'TLX on hand', value: fmt(booking.tlx_release_on_hand), source: 'Manual' },
    { label: 'Doc handover', value: fmt(booking.doc_handover_at), source: 'Manual' },
    { label: 'BACC sent', value: fmt(booking.bacc_sent), source: 'Manual' },
    { label: 'UBF cleared', value: fmt(booking.cleared), source: 'Manual' },
    { label: 'Truck booked', value: fmt(booking.truck_booked), source: 'Manual' },
    { label: 'LFD', value: fmt(booking.last_free_day), source: 'Manual' },
    { label: 'Discharge', value: fmt(booking.discharge_date), source: 'Manual' },
    { label: 'Delivery', value: fmt(booking.delivery_date), source: 'Manual' },
    { label: 'Return', value: fmt(booking.container_return_date), source: 'Manual' },
    { label: 'Hold', value: fmt(booking.hold_reason), source: 'Manual' },
    { label: 'ERP job', value: fmt(booking.erp_internal_job_no), source: 'ERP' },
  ]

  return (
    <div className="px-1">
      {fields.map((f) => (
        <FieldRow key={f.label} {...f} />
      ))}
    </div>
  )
}
