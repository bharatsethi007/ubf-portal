import { normalizeIso6346Pill } from '@/features/importSea/iso6346Normalize'
import { isLytteltonPort } from '../tracking/portconnectUtils'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'

export type PortConnectBookingSnapshot = {
  eta: string | null
  shippingLine: string | null
  dischargePort: string | null
  dischargeDate: string | null
  deliveryDate: string | null
  containerReturnDate: string | null
  lastFreeDay: string | null
}

function rawField(raw: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!raw) return null
  const map = new Map(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]))
  for (const key of keys) {
    const hit = map.get(key.toLowerCase())
    if (hit != null && hit !== '') return hit
  }
  return null
}

function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  return iso.trim().slice(0, 10)
}

function minDate(values: Array<string | null | undefined>): string | null {
  const days = values.map(toDateOnly).filter(Boolean) as string[]
  if (!days.length) return null
  return days.sort()[0]
}

function maxText(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v?.trim()) return v.trim()
  }
  return null
}

function firstSeal(raw: Record<string, unknown> | null): string | null {
  const seals = rawField(raw, 'seals')
  if (!Array.isArray(seals) || !seals.length) return null
  return asText(seals[0])
}

export function aggregatePortConnectBookingFields(
  containers: ContainerTrackingRow[] | null | undefined,
  dischargePortHint: string | null | undefined,
): PortConnectBookingSnapshot | null {
  const rows = containers ?? []
  if (!rows.length) return null

  const portHint = dischargePortHint ?? rows.map((r) => r.discharge_port_name).find(Boolean) ?? null
  const lyttelton = isLytteltonPort(portHint)

  const etas = rows.map((r) => {
    const raw = r.raw
    return toDateOnly(r.inbound_ata)
      ?? toDateOnly(asText(rawField(raw, 'inboundVesselActualArrivalDatetime', 'seaPortArrivalDatetime')))
      ?? toDateOnly(r.inbound_eta)
      ?? toDateOnly(asText(rawField(raw, 'inboundVesselPublishedArrivalDatetime')))
  })

  const deliveryDates = rows.map((r) =>
    toDateOnly(asText(rawField(r.raw, 'seaPortGateOutDateTime'))),
  )

  const returnDates = rows.map((r) => {
    const raw = r.raw
    return toDateOnly(asText(rawField(raw, 'inlandPortGateOutDateTime')))
      ?? toDateOnly(asText(rawField(raw, 'inlandPortGateInDateTime')))
  })

  return {
    eta: minDate(etas),
    shippingLine: maxText(rows.map((r) =>
      r.operator_name ?? asText(rawField(r.raw, 'containerOperatorName')))),
    dischargePort: maxText(rows.map((r) =>
      r.discharge_port_name ?? asText(rawField(r.raw, 'dischargePortName')))),
    dischargeDate: minDate(rows.map((r) =>
      r.discharged_at ?? asText(rawField(r.raw, 'dischargedDatetime')))),
    deliveryDate: minDate(deliveryDates),
    containerReturnDate: minDate(returnDates),
    lastFreeDay: lyttelton
      ? null
      : minDate(rows.map((r) => r.last_free_at ?? asText(rawField(r.raw, 'lastFreeDatetime')))),
  }
}

export function portConnectContainerType(row: ContainerTrackingRow): string | null {
  const raw = row.raw
  const iso = row.iso_type ?? asText(rawField(raw, 'containerIsoTypeCode'))
  const desc = row.iso_desc ?? asText(rawField(raw, 'containerIsoTypeDescription'))
  return normalizeIso6346Pill(iso, desc)
    ?? row.container_type
    ?? asText(rawField(raw, 'containerIsoTypeCode'))
}

export function portConnectContainerSeal(row: ContainerTrackingRow): string | null {
  return firstSeal(row.raw)
}
