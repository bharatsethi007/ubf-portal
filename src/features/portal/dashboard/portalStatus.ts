export type PortalStatusLabel =
  | 'At Origin'
  | 'In Transit'
  | 'Picked up'
  | 'Departure'
  | 'At Destination'
  | 'Delivered'

export type StatusStyle = { label: PortalStatusLabel; color: string; bg: string }

const STYLES: Record<PortalStatusLabel, { color: string; bg: string }> = {
  'At Origin': { color: 'var(--portal-grey)', bg: 'var(--portal-grey-bg)' },
  'In Transit': { color: 'var(--portal-blue)', bg: 'var(--portal-blue-soft)' },
  'Picked up': { color: 'var(--portal-amber)', bg: 'var(--portal-amber-bg)' },
  Departure: { color: 'var(--portal-orange)', bg: 'var(--portal-orange-bg)' },
  'At Destination': { color: 'var(--portal-orange)', bg: 'var(--portal-orange-bg)' },
  Delivered: { color: 'var(--portal-green)', bg: 'var(--portal-green-bg)' },
}

export function mapShipmentStatus(status: string | null | undefined): StatusStyle {
  const s = (status ?? '').trim()
  let label: PortalStatusLabel = 'At Origin'
  if (s === 'In transit') label = 'In Transit'
  else if (s === 'Scheduled') label = 'Departure'
  else if (s.startsWith('Arrived')) label = s === 'Arrived' ? 'Delivered' : 'At Destination'
  else if (s === 'Booked') label = 'At Origin'
  return { label, ...STYLES[label] }
}

export function shipmentDirection(row: { direction?: string | null; module?: string | null }): 'import' | 'export' {
  if (row.direction === 'import' || row.direction === 'export') return row.direction
  const m = (row.module ?? '').toUpperCase()
  if (m.startsWith('FI')) return 'import'
  if (m.startsWith('FE')) return 'export'
  return 'import'
}

export function isArrived(status: string | null | undefined): boolean {
  return (status ?? '').startsWith('Arrived')
}

export function isInTransit(status: string | null | undefined): boolean {
  return (status ?? '').trim() === 'In transit'
}

export function isDeparting(status: string | null | undefined): boolean {
  return (status ?? '').trim() === 'Scheduled'
}

export function isAtOrigin(status: string | null | undefined): boolean {
  const s = (status ?? '').trim()
  return s === 'Booked' || s === 'Scheduled'
}

export function isBooked(status: string | null | undefined): boolean {
  return (status ?? '').trim() === 'Booked'
}

export function tabMatchesStatus(tab: string, status: string | null | undefined): boolean {
  if (tab === 'All') return true
  const { label } = mapShipmentStatus(status)
  if (tab === 'In Transit') return label === 'In Transit'
  if (tab === 'Arriving') return label === 'At Destination' || (isInTransit(status) && !isArrived(status))
  if (tab === 'Departing') return label === 'Departure' || label === 'At Origin'
  return true
}

export { STYLES as PORTAL_STATUS_STYLES }
