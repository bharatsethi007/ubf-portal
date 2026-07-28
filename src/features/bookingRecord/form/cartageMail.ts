import {
  fetchMeta,
  fetchCustomerSync,
  resolveCustomerAddress,
  type ResolvedCustomerAddress,
} from '@/components/Customers/customerInfoApi'
import { containerTypeLabel } from '@/features/importSea/containerTypeUtils'
import type { BookingRecord } from '../bookingRecordTypes'
import type { ContainerListItem } from '../containers/useBookingContainers'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'

type CartageMailCtx = {
  booking: BookingRecord
  rows: ContainerListItem[]
  tracking: ContainerTrackingRow[] | null | undefined
}

function doorDirectionLabel(v: BookingRecord['door_direction']): string {
  if (v === 'front') return 'Door to Front'
  if (v === 'rear') return 'Door to Rear'
  return ''
}

function peakLabel(v: BookingRecord['pickup_peak']): string {
  if (v === 'peak') return 'Peak'
  if (v === 'offpeak') return 'Off peak'
  return ''
}

function formatAddress(a: ResolvedCustomerAddress): string {
  const parts = [a.line1, a.line2, a.city, a.region, a.postcode, a.country].filter(Boolean)
  return parts.length ? parts.join(', ') : ''
}

function containerNumbers(rows: ContainerListItem[]): string {
  return rows.map((r) => r.container_no).filter(Boolean).join(', ')
}

function containerTypes(rows: ContainerListItem[]): string {
  const labels = new Set<string>()
  for (const r of rows) {
    const desc = 'iso_desc' in r ? r.iso_desc : null
    const label = containerTypeLabel(r.container_type ?? null, desc) ?? ''
    if (label) labels.add(label)
  }
  return [...labels].join(', ')
}

function pickupLocation(tracking: ContainerTrackingRow[] | null | undefined): string {
  const rows = tracking ?? []
  for (const r of rows) {
    if (r.discharge_port_name) return r.discharge_port_name
  }
  return ''
}

function emptyReturnDepot(tracking: ContainerTrackingRow[] | null | undefined): string {
  for (const row of tracking ?? []) {
    const depot = row.empty_return_depot_name?.trim()
    if (depot) return depot
  }
  return ''
}

async function resolveMailFields(ctx: CartageMailCtx) {
  const { booking, rows, tracking } = ctx
  let addressStr = ''
  if (booking.account_id) {
    const [meta, cust] = await Promise.all([
      fetchMeta(booking.account_id),
      fetchCustomerSync(booking.account_id),
    ])
    const addr = resolveCustomerAddress(meta, cust)
    addressStr = formatAddress(addr)
  }

  return {
    ref: booking.booking_ref ?? '',
    nums: containerNumbers(rows),
    types: containerTypes(rows),
    from: pickupLocation(tracking),
    to: emptyReturnDepot(tracking),
    customer: booking.customer_name ?? '',
    door: doorDirectionLabel(booking.door_direction),
    peak: peakLabel(booking.pickup_peak),
    addressStr,
  }
}

function joinBodyLines(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line != null).join('\n')
}

function openMailto(subject: string, body: string): void {
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = mailto
}

export async function openDeliveryEmail(ctx: CartageMailCtx): Promise<void> {
  const { ref, nums, types, from, customer, door, peak, addressStr } = await resolveMailFields(ctx)
  const subject = `${ref} ${nums} ${types} | Delivery to ${customer}`
  const body = joinBodyLines([
    'Hi there,',
    '',
    from
      ? `Please place a booking for picking up ${nums}, ${types}, from ${from}.`
      : `Please place a booking for picking up ${nums}, ${types}.`,
    door ? `DOOR DIRECTION: ${door}` : null,
    customer ? `CUSTOMER: ${customer}` : null,
    addressStr ? `ADDRESS: ${addressStr}` : null,
    peak ? `PICKUP: ${peak}` : null,
    '',
    'Kind regards,',
    'UB Freight',
  ])
  openMailto(subject, body)
}

export async function openEmptyPickupEmail(ctx: CartageMailCtx): Promise<void> {
  const { ref, nums, types, to, customer, peak, addressStr } = await resolveMailFields(ctx)
  const subject = `${ref} ${nums} ${types} | Empty Pick up from ${customer}`
  const body = joinBodyLines([
    'Hi there,',
    '',
    to
      ? `Please place a booking for Empty Pickup ${nums}, ${types}, to ${to}.`
      : `Please place a booking for Empty Pickup ${nums}, ${types}.`,
    customer ? `CUSTOMER: ${customer}` : null,
    addressStr ? `ADDRESS: ${addressStr}` : null,
    peak ? `PICKUP: ${peak}` : null,
    '',
    'Kind regards,',
    'UB Freight',
  ])
  openMailto(subject, body)
}
