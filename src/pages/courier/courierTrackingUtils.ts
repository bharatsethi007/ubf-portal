import type { CourierTrackEvent } from './courierBookingsApi'

export type NormalizedTrackEvent = {
  timestamp: string | null
  description: string
  location: string
}

export function parseStoredTrackingEvents(raw: unknown): CourierTrackEvent[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw as CourierTrackEvent[]
}

export function normalizeTrackEvent(raw: CourierTrackEvent): NormalizedTrackEvent {
  const timestamp =
    (raw.timestamp as string | undefined) ??
    (raw.date as string | undefined) ??
    (raw.datetime as string | undefined) ??
    (raw.eventTime as string | undefined) ??
    null
  const description = String(
    raw.description ?? raw.statusText ?? raw.type ?? raw.event ?? raw.status ?? '—',
  )
  const locationParts = [
    raw.location,
    raw.locationName,
    [raw.city, raw.countryCode ?? raw.country].filter(Boolean).join(', '),
  ].filter((v) => typeof v === 'string' && v.trim())
  const location = locationParts.length ? String(locationParts[0]) : '—'
  return { timestamp, description, location }
}

export function sortTrackEventsNewestFirst(events: NormalizedTrackEvent[]): NormalizedTrackEvent[] {
  return [...events].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return tb - ta
  })
}

export function fmtTrackTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
