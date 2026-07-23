import { formatPortConnectDateTimeShort } from '@/features/bookingRecord/tracking/portConnectAucklandDate'
import type {
  BookingTrackingEvent,
  ContainerTrackingRow,
} from '@/features/bookingRecord/tracking/trackingTypes'

export type ClearancePillState = 'off' | 'on' | 'warn'

export type ReleaseField = 'mpi_release_at' | 'customs_release_at' | 'line_release_at'

export type ReleaseLayer = {
  released: boolean
  cancelled: boolean
  at: string | null
}

const CANCEL_BY_FIELD: Record<ReleaseField, string> = {
  mpi_release_at: 'MPIRELEASECANCELLED',
  customs_release_at: 'CUSTOMSRELEASECANCELLED',
  line_release_at: 'LOPRELEASECANCELLED',
}

export function releaseLayer(
  containers: ContainerTrackingRow[],
  field: ReleaseField,
  events: BookingTrackingEvent[],
): ReleaseLayer {
  const cancelled = hasEventCode(events, CANCEL_BY_FIELD[field])
  if (!containers.length) return { released: false, cancelled, at: null }
  const released = containers.every((c) => Boolean(c[field]))
  if (!released) return { released: false, cancelled, at: null }
  const at = latestTimestamp(containers.map((c) => c[field]))
  return { released: true, cancelled, at }
}

export function portClearanceLayer(
  containers: ContainerTrackingRow[],
  events: BookingTrackingEvent[],
): ReleaseLayer {
  const cancelled = hasEventCode(events, 'CUSTOMSRELEASECANCELLED', 'MPIRELEASECANCELLED')
  if (!containers.length) return { released: false, cancelled, at: null }
  const released = containers.every((c) => c.customs_release_at && c.mpi_release_at)
  if (!released) return { released: false, cancelled, at: null }
  const at = latestTimestamp(
    containers.map((c) => latestTimestamp([c.customs_release_at, c.mpi_release_at])),
  )
  return { released: true, cancelled, at }
}

export function clearancePillState(released: boolean, cancelled: boolean): ClearancePillState {
  if (cancelled) return 'warn'
  return released ? 'on' : 'off'
}

export function formatReleaseTimestamp(iso: string | null): string {
  if (!iso) return '—'
  return formatPortConnectDateTimeShort(iso)
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const sorted = values.filter(Boolean).sort() as string[]
  return sorted[sorted.length - 1] ?? null
}

function hasEventCode(events: BookingTrackingEvent[], ...codes: string[]): boolean {
  const wanted = new Set(codes.map((c) => c.toUpperCase()))
  return events.some((e) => wanted.has(e.event_type_code.toUpperCase()))
}
