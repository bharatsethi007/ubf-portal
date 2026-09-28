// Display helpers for the public tracking page. Times show in the viewer's own timezone.
import type { PublicTrack, TrackStatus } from './trackApi'

export const STATUS_LABEL: Record<TrackStatus, string> = {
  booked: 'Booked',
  sailing: 'Sailing',
  arrived: 'Arrived',
  released: 'Ready for pickup',
  delivered: 'Delivered',
}

export function fmtDay(iso: string | null): string {
  if (!iso) return 'To be confirmed'
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Date-only values (midnight UTC) carry no time of day.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function fmtStamp(iso: string | null): string {
  if (!iso) return ''
  const t = fmtTime(iso)
  const d = new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return t ? `${d}, ${t}` : d
}

export function ago(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function daysAway(iso: string | null): string | null {
  if (!iso) return null
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(iso); end.setHours(0, 0, 0, 0)
  const d = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d > 1) return `In ${d} days`
  return null
}

/** Schedule reliability line under the ETA. */
export function scheduleNote(t: PublicTrack): { text: string; tone: 'good' | 'warn' | 'bad' } | null {
  const h = t.eta.delay_hours
  if (h === null) return null
  if (Math.abs(h) < 12) return { text: 'On schedule', tone: 'good' }
  const days = Math.round(Math.abs(h) / 24) || 1
  if (h < 0) return { text: `${days} day${days > 1 ? 's' : ''} ahead of schedule`, tone: 'good' }
  return { text: `${days} day${days > 1 ? 's' : ''} behind original schedule`, tone: h > 72 ? 'bad' : 'warn' }
}

/** Share of the journey completed, for the progress bar. */
export function progress(t: PublicTrack): number {
  if (t.status === 'delivered' || t.status === 'released' || t.status === 'arrived') return 1
  const v = t.vessel
  if (t.status === 'sailing' && v?.nm_to_go != null && t.planned.length > 1) {
    const total = pathNm(t.planned)
    if (total > 0) return Math.min(0.97, Math.max(0.05, 1 - v.nm_to_go / total))
  }
  return t.status === 'sailing' ? 0.5 : 0.04
}

function pathNm(c: [number, number][]): number {
  let nm = 0
  for (let i = 1; i < c.length; i++) {
    const [x1, y1] = c[i - 1], [x2, y2] = c[i]
    const r = Math.PI / 180
    const h = Math.sin(((y2 - y1) * r) / 2) ** 2 + Math.cos(y1 * r) * Math.cos(y2 * r) * Math.sin(((x2 - x1) * r) / 2) ** 2
    nm += 2 * 3440.065 * Math.asin(Math.sqrt(h))
  }
  return nm
}

/** Calendar file for the ETA (all-day event). */
export function etaIcs(t: PublicTrack): string {
  const when = t.eta.actual ?? t.eta.predicted
  if (!when) return ''
  const d = new Date(when)
  const ymd = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`
  const next = new Date(d); next.setDate(d.getDate() + 1)
  const box = t.containers.map((c) => c.no).join(', ')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UB Freight//Tracking//EN', 'BEGIN:VEVENT',
    `UID:${t.ref ?? 'ubf'}-${ymd(d)}@ubfreight.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:Shipment arrives ${t.destination.name ?? ''}`.trim(),
    `DESCRIPTION:${[t.ref, box].filter(Boolean).join(' · ')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

/** "40' 9'6 HIGH CUBE" -> "40ft high cube". */
export function boxType(raw: string | null): string | null {
  if (!raw) return null
  const u = raw.toUpperCase()
  const size = u.match(/^(20|40|45)/)?.[1]
  if (!size) return raw
  const kind = /REEF|REFRIG|\bRF\b|\bRH\b/.test(u) ? 'reefer'
    : /HIGH\s*CUBE|\bHC\b|\bHQ\b|9.6/.test(u) ? 'high cube'
    : /OPEN/.test(u) ? 'open top' : /FLAT/.test(u) ? 'flat rack' : 'standard'
  return `${size}ft ${kind}`
}
