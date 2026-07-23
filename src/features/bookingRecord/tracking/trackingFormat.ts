import { formatDistanceToNow } from 'date-fns'
import { fmtBoardDate } from '@/features/importSea/importSeaBoardFormat'
import { normalizeIso6346Pill } from '@/features/importSea/iso6346Normalize'
import { formatPortConnectDateTime } from './portConnectAucklandDate'
import { portConnectEventLabel } from './portConnectEventLabels'
import type { BookingTrackingEvent } from './trackingTypes'

export function formatContainerTypeLabel(
  raw: string | null | undefined,
  description?: string | null,
): string {
  const pill = normalizeIso6346Pill(raw, description)
  if (pill) return pill
  if (!raw?.trim()) return '—'
  return raw.trim().toUpperCase()
}

export function relativeUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatEventTimestamp(iso: string | null): string {
  return formatPortConnectDateTime(iso)
}

export function formatEtaDate(iso: string | null): string {
  if (!iso) return '—'
  return fmtBoardDate(iso)
}

export function eventTypeLabel(code: string): string {
  return portConnectEventLabel(code)
}

export function isEstimatedEvent(event: BookingTrackingEvent): boolean {
  if (event.is_estimated) return true
  return /ETA|EST|ESTIMATED|SCHEDULED|PLANNED/i.test(event.event_type_code)
}

export function isLytteltonEstimatedRelease(event: BookingTrackingEvent): boolean {
  if (!event.is_estimated) return false
  const port = event.partner_port_code?.trim().toUpperCase()
  if (port !== 'NZLYT') return false
  return /CUSTOMSRELEASE|MPIRELEASE|LOPRELEASE/.test(event.event_type_code.toUpperCase())
}

export type EventIconKind = 'vessel' | 'gate' | 'default'

export function eventIconKind(event: BookingTrackingEvent): EventIconKind {
  if (event.inbound_vessel_name?.trim() || event.outbound_vessel_name?.trim()) {
    return 'vessel'
  }
  const hay = `${event.event_type_code} ${event.event_value ?? ''}`.toLowerCase()
  if (/gate|gated|in\b|out\b|terminal|yard|pickup|delivery|gate_out/.test(hay)) {
    return 'gate'
  }
  if (/vessel|sail|depart|arriv|load|discharg|berth|inbound|outbound/.test(hay)) {
    return 'vessel'
  }
  return 'default'
}

export function eventVesselLabel(event: BookingTrackingEvent): string | null {
  const inbound = [event.inbound_vessel_name, event.inbound_vessel_ref]
    .filter(Boolean)
    .join(' / ')
  if (inbound) return inbound
  const outbound = [event.outbound_vessel_name, event.outbound_vessel_ref]
    .filter(Boolean)
    .join(' / ')
  return outbound || null
}

export function sourceLabel(source: BookingTrackingEvent['source']): string {
  return source === 'portconnect' ? 'PortConnect' : 'Carrier'
}
