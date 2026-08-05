import { fetchAtfFacility, formatAtfAddress } from './atfFacilityApi'
import { listDropOffDepots } from './dropOffDepotApi'
import { portConnectContainerWeight } from '../portConnect/bookingPortConnectCoalesce'
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
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
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
  for (const r of tracking ?? []) if (r.discharge_port_name) return r.discharge_port_name
  return ''
}
function emptyReturnDepot(tracking: ContainerTrackingRow[] | null | undefined): string {
  for (const r of tracking ?? []) {
    const d = r.empty_return_depot_name?.trim()
    if (d) return d
  }
  return ''
}

function atfName(atf: Awaited<ReturnType<typeof fetchAtfFacility>>): string {
  if (!atf) return ''
  return atf.facility ? `${atf.facility}${atf.atf_code ? ` · ${atf.atf_code}` : ''}` : ''
}
function containerWeights(rows: ContainerListItem[], tracking: ContainerTrackingRow[] | null | undefined): string {
  const byNo = new Map<string, ContainerTrackingRow>()
  for (const t of tracking ?? []) if (t.container_no) byNo.set(t.container_no.trim().toUpperCase(), t)
  const parts: string[] = []
  for (const r of rows) {
    if (!r.container_no) continue
    const t = byNo.get(r.container_no.trim().toUpperCase())
    const kg = t ? portConnectContainerWeight(t) : null
    if (kg != null) parts.push(`${r.container_no}: ${kg.toLocaleString()} kg`)
  }
  return parts.join(', ')
}

async function resolveMailFields(ctx: CartageMailCtx) {
  const { booking, rows, tracking } = ctx
  const atf = await fetchAtfFacility(booking.m_atf)
  let dropOff = ''
  if (booking.drop_off_depot) {
    try {
      const depots = await listDropOffDepots()
      const d = depots.find((x) => x.code === booking.drop_off_depot)
      dropOff = d ? `${d.code} — ${d.name}` : booking.drop_off_depot
    } catch {
      dropOff = booking.drop_off_depot
    }
  }
  return {
    ref: booking.booking_ref ?? '',
    nums: containerNumbers(rows),
    types: containerTypes(rows),
    terminal: pickupLocation(tracking),
    depot: emptyReturnDepot(tracking),
    customer: booking.customer_name ?? '',
    door: doorDirectionLabel(booking.door_direction),
    peak: peakLabel(booking.pickup_peak),
    atfAddress: formatAtfAddress(atf),
    atfName: atfName(atf),
    weights: containerWeights(rows, tracking),
    isUbf: (booking.m_atf ?? '').trim() === '31853',
    bay: booking.ubf_bay ?? '',
    timeSlot: booking.ubf_time_slot ?? '',
    cartageFull: (booking.cartage_instructions_full ?? '').trim(),
    dropOff,
    cartageEmpty: (booking.cartage_instructions_empty ?? '').trim(),
    deliveryDate: fmtDate(booking.delivery_date),
    emptyPickupDate: fmtDate(booking.empty_pickup_date),
  }
}

function joinLines(lines: Array<string | null>): string {
  return lines.filter((l): l is string => l != null).join('\n')
}
function openMailto(subject: string, body: string): void {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function openDeliveryEmail(ctx: CartageMailCtx): Promise<void> {
  const f = await resolveMailFields(ctx)
  const subject = `${f.ref} ${f.nums} ${f.types} | Delivery to ${f.customer}`
  const body = joinLines([
    'Hi there,',
    '',
    f.terminal
      ? `Please place a booking for picking up ${f.nums}, ${f.types}, from ${f.terminal}.`
      : `Please place a booking for picking up ${f.nums}, ${f.types}.`,
    f.atfName ? `ATF: ${f.atfName}` : null,
    f.atfAddress ? `Deliver to: ${f.atfAddress}` : null,
    f.weights ? `Weight: ${f.weights}` : null,
    f.deliveryDate ? `Delivery date: ${f.deliveryDate}` : null,
    f.door ? `Door direction: ${f.door}` : null,
    f.customer ? `Customer: ${f.customer}` : null,
    f.peak ? `Pickup: ${f.peak}` : null,
    ...(f.isUbf
      ? [
          f.bay ? `Bay: ${f.bay}` : null,
          f.timeSlot ? `Time slot: ${f.timeSlot}` : null,
        ]
      : []),
    f.cartageFull ? '' : null,
    f.cartageFull ? 'Cartage instructions:' : null,
    f.cartageFull ? f.cartageFull : null,
    '',
    'Kind regards,',
    'UB Freight',
  ])
  openMailto(subject, body)
}

export async function openEmptyPickupEmail(ctx: CartageMailCtx): Promise<void> {
  const f = await resolveMailFields(ctx)
  const subject = `${f.ref} ${f.nums} ${f.types} | Empty Pick up from ${f.customer}`
  const body = joinLines([
    'Hi there,',
    '',
    f.depot
      ? `Please place a booking for Empty Pickup ${f.nums}, ${f.types}, to ${f.depot}.`
      : `Please place a booking for Empty Pickup ${f.nums}, ${f.types}.`,
    f.atfAddress ? `Pick up from: ${f.atfAddress}` : null,
    f.dropOff ? `Drop off to: ${f.dropOff}` : null,
    f.emptyPickupDate ? `Empty pickup date: ${f.emptyPickupDate}` : null,
    f.customer ? `Customer: ${f.customer}` : null,
    f.peak ? `Pickup: ${f.peak}` : null,
    f.cartageEmpty ? '' : null,
    f.cartageEmpty ? 'Drop off instructions:' : null,
    f.cartageEmpty ? f.cartageEmpty : null,
    '',
    'Kind regards,',
    'UB Freight',
  ])
  openMailto(subject, body)
}
