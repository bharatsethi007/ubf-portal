import type { TrackingEvent } from '@/features/importSea/jobDetailApi'

export type BookingMilestone = {
  key: string
  label: string
  state: 'done' | 'current' | 'pending'
  date: string | null
  source: string | null
}

type MilestoneDef = {
  key: string
  label: string
  types: string[]
  defaultSource: string
}

const PORT_DEFS: MilestoneDef[] = [
  { key: 'vessel_arrived', label: 'Vessel arrived', types: ['vessel_arrived', 'vessel_arrival', 'arrived_vessel'], defaultSource: 'PortConnect' },
  { key: 'discharged', label: 'Discharged', types: ['discharged', 'discharge'], defaultSource: 'PortConnect' },
  { key: 'available', label: 'Available', types: ['available', 'avail', 'container_available'], defaultSource: 'PortConnect' },
  { key: 'customs_cleared', label: 'Customs cleared', types: ['customs_cleared', 'cleared', 'customs_clear'], defaultSource: 'PortConnect' },
  { key: 'mpi_released', label: 'MPI released', types: ['mpi_released', 'mpi', 'biosecurity_cleared'], defaultSource: 'PortConnect' },
  { key: 'gate_out', label: 'Gate out', types: ['gate_out', 'gated_out'], defaultSource: 'PortConnect' },
  { key: 'delivered', label: 'Delivered', types: ['delivered', 'delivery'], defaultSource: 'PortConnect' },
  { key: 'container_dehired', label: 'Container dehired', types: ['container_dehired', 'dehired', 'container_return'], defaultSource: 'PortConnect' },
]

const SHIPPING_BASE: MilestoneDef[] = [
  { key: 'booked', label: 'Booked', types: ['booked', 'booking_confirmed'], defaultSource: 'Carrier' },
  { key: 'gate_in_origin', label: 'Gate in origin', types: ['gate_in_origin', 'gate_in', 'origin_gate_in'], defaultSource: 'Carrier' },
  { key: 'loaded', label: 'Loaded', types: ['loaded', 'loaded_on_vessel'], defaultSource: 'Carrier' },
  { key: 'departed', label: 'Departed', types: ['departed', 'departure', 'vessel_departed'], defaultSource: 'Carrier' },
]

const SHIPPING_ARRIVED: MilestoneDef = {
  key: 'arrived',
  label: 'Arrived',
  types: ['arrived', 'vessel_arrived_dest', 'arrival'],
  defaultSource: 'Carrier',
}

const TRANSHIP_TYPES = ['transhipment', 'transshipment', 'tranship']

function normalizeType(value: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function eventSource(event: TrackingEvent, fallback: string): string {
  const desc = event.description?.trim()
  if (desc && desc.length <= 40) return desc
  if (event.location?.trim()) return event.location.trim()
  return fallback
}

function pickEvent(def: MilestoneDef, events: TrackingEvent[]): TrackingEvent | null {
  for (const event of events) {
    if (def.types.includes(normalizeType(event.event_type))) return event
  }
  return null
}

function assignStates(items: Omit<BookingMilestone, 'state'>[]): BookingMilestone[] {
  const currentIdx = items.findIndex((m) => !m.date)
  return items.map((m, i) => {
    if (m.date) return { ...m, state: 'done' }
    if (currentIdx === -1) return { ...m, state: 'pending' }
    if (i === currentIdx) return { ...m, state: 'current' }
    return { ...m, state: 'pending' }
  })
}

function defToMilestone(def: MilestoneDef, event: TrackingEvent | null): Omit<BookingMilestone, 'state'> {
  return {
    key: def.key,
    label: def.label,
    date: event?.event_at ?? null,
    source: event ? eventSource(event, def.defaultSource) : null,
  }
}

function isPortEvent(event: TrackingEvent): boolean {
  const type = normalizeType(event.event_type)
  return PORT_DEFS.some((d) => d.types.includes(type))
}

function isShippingEvent(event: TrackingEvent): boolean {
  const type = normalizeType(event.event_type)
  if (TRANSHIP_TYPES.includes(type)) return true
  return [...SHIPPING_BASE, SHIPPING_ARRIVED].some((d) => d.types.includes(type))
}

export function buildPortTimeline(events: TrackingEvent[]): BookingMilestone[] {
  const portEvents = events.filter(isPortEvent)
  const items = PORT_DEFS.map((def) => defToMilestone(def, pickEvent(def, portEvents)))
  return assignStates(items)
}

export function buildShippingTimeline(events: TrackingEvent[]): BookingMilestone[] {
  const shipEvents = events.filter(isShippingEvent)
  const items: Omit<BookingMilestone, 'state'>[] = SHIPPING_BASE.map((def) =>
    defToMilestone(def, pickEvent(def, shipEvents)),
  )

  const tranships = shipEvents
    .filter((e) => TRANSHIP_TYPES.includes(normalizeType(e.event_type)))
    .sort((a, b) => (a.event_at ?? '').localeCompare(b.event_at ?? ''))

  tranships.forEach((event, i) => {
    items.push({
      key: `transhipment_${i}`,
      label: tranships.length > 1 ? `Transhipment ${i + 1}` : 'Transhipment',
      date: event.event_at,
      source: eventSource(event, 'Carrier'),
    })
  })

  items.push(defToMilestone(SHIPPING_ARRIVED, pickEvent(SHIPPING_ARRIVED, shipEvents)))
  return assignStates(items)
}

export function hasPortEvents(events: TrackingEvent[]): boolean {
  return events.some(isPortEvent)
}

export function hasShippingEvents(events: TrackingEvent[]): boolean {
  return events.some(isShippingEvent)
}
