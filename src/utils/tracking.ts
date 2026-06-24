import type { Shipment } from '../types/shipment'

export type TrackingEvent = {
  label: string
  date: string | null
  state: 'done' | 'current' | 'upcoming'
}

export function deriveTrackingEvents(shipment: Shipment): TrackingEvent[] {
  const current = currentEventLabel(shipment.status)
  const topLabel = shipment.status.startsWith('Arrived') ? 'Arrived' : 'Import Customs Commenced'

  const items = [
    {
      label: topLabel,
      date: shipment.arrived ?? (shipment.status.startsWith('Arrived') ? shipment.eta : null),
    },
    { label: 'In Transit', date: shipment.departed ?? shipment.etd },
    { label: 'Depart from Load Port', date: shipment.departed ?? shipment.etd },
    { label: 'Order Confirmed', date: shipment.doc_date },
    { label: 'Order Pending', date: shipment.doc_date },
  ]

  const currentIdx = items.findIndex((item) => item.label === current)

  return items.map((item, i) => ({
    label: item.label,
    date: item.date,
    state: i < currentIdx ? 'upcoming' : i === currentIdx ? 'current' : 'done',
  }))
}

function currentEventLabel(status: string): string {
  if (status === 'Arrived') return 'Arrived'
  if (status === 'Arrived (est.)') return 'Import Customs Commenced'
  if (status === 'In transit') return 'In Transit'
  if (status === 'Scheduled') return 'Order Confirmed'
  return 'Order Pending'
}

export function parseVesselFlight(raw: string | null): { vessel: string; voyage: string } {
  if (!raw) return { vessel: '—', voyage: '—' }
  const match = raw.match(/^(.+?)\s*[-–|/]\s*(.+)$/)
  if (match) return { vessel: match[1].trim(), voyage: match[2].trim() }
  return { vessel: raw, voyage: '—' }
}
