import { formatContainerTypeLabel } from './trackingFormat'
import type {
  BookingTrackingEvent,
  ClearedStatus,
  ContainerTrackingRow,
  PortConnectVisitView,
} from './trackingTypes'

function rawField(raw: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!raw) return null
  const map = new Map(
    Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]),
  )
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

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function firstIso(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v?.trim()) return v.trim()
  }
  return null
}

function vesselArrival(row: ContainerTrackingRow): { at: string | null; kind: 'ATA' | 'ETA' | null } {
  const raw = row.raw
  const ata = firstIso(
    row.inbound_ata,
    asText(rawField(raw, 'inboundVesselActualArrivalDatetime', 'seaPortArrivalDatetime')),
  )
  if (ata) return { at: ata, kind: 'ATA' }
  const eta = firstIso(
    row.inbound_eta,
    asText(rawField(raw, 'inboundVesselPublishedArrivalDatetime')),
  )
  if (eta) return { at: eta, kind: 'ETA' }
  return { at: null, kind: null }
}

function isReefer(iso: string | null, desc: string | null): boolean {
  const pill = `${iso ?? ''} ${desc ?? ''}`.toUpperCase()
  return /\bREEF|REEFER|\bRF\b|'\s*R\b|22R|42R|45R/.test(pill)
    || /REEFER|\bRH\b/.test(desc?.toUpperCase() ?? '')
}

function impedimentCodes(raw: Record<string, unknown> | null): string[] {
  const stops = rawField(raw, 'stops')
  if (!Array.isArray(stops)) return []
  return stops
    .map((s) => {
      if (!s || typeof s !== 'object') return null
      const rec = s as Record<string, unknown>
      return asText(rec.stopCode ?? rec.code ?? rec.stopType ?? rec.description)
    })
    .filter((v): v is string => Boolean(v))
}

export function clearedStatus(
  row: ContainerTrackingRow,
  events: BookingTrackingEvent[] | null | undefined,
): ClearedStatus {
  const list = events ?? []
  const containerEvents = list.filter((e) => e.container_no === row.container_no)
  if (containerEvents.some((e) => /CANCELLED/i.test(e.event_type_code))) return 'cancelled'
  if (row.customs_release_at && row.mpi_release_at) return 'cleared'
  return 'missing'
}

export function buildPortConnectVisitView(
  row: ContainerTrackingRow,
  events: BookingTrackingEvent[] | null | undefined,
): PortConnectVisitView {
  const raw = row.raw
  const loadPort = row.load_port_name ?? asText(rawField(raw, 'loadPortName'))
  const dischargePort = row.discharge_port_name ?? asText(rawField(raw, 'dischargePortName'))
  const depotName = row.empty_return_depot_name ?? asText(rawField(raw, 'emptyReturnDepotName'))
  const depotCode = row.empty_return_depot_code ?? asText(rawField(raw, 'emptyReturnDepotCode'))
  const isoType = row.iso_type ?? asText(rawField(raw, 'containerIsoTypeCode'))
  const isoDesc = row.iso_desc ?? asText(rawField(raw, 'containerIsoTypeDescription'))
  const vesselName = row.inbound_vessel_name ?? asText(rawField(raw, 'inboundVesselName'))
  const voyage = row.operator_voyage_id ?? asText(rawField(raw, 'containerOperatorVoyageId'))
  const vesselRef = row.inbound_vessel_ref ?? asText(rawField(raw, 'inboundVesselRef'))
  const vesselVisit = [vesselName, voyage ?? vesselRef].filter(Boolean).join(' / ') || null
  const weight = asNumber(rawField(raw, 'declaredWeight'))
  const tempRaw = asNumber(rawField(raw, 'requiredTemperature'))
  const temp = isReefer(isoType, isoDesc) && tempRaw != null ? `${tempRaw}°C` : null
  const codes = impedimentCodes(raw)
  const stopCount = asNumber(rawField(raw, 'stopCount')) ?? codes.length

  return {
    row,
    port: row.port_code ?? asText(rawField(raw, 'portCode', 'partnerPortCode')),
    category: asText(rawField(raw, 'category')),
    vesselVisit,
    vesselArrival: vesselArrival(row),
    location: row.container_location ?? asText(rawField(raw, 'containerLocation')),
    status: row.container_status ?? asText(rawField(raw, 'containerStatus')),
    mtReturn: depotCode ?? depotName,
    isoLabel: formatContainerTypeLabel(isoType ?? row.container_type, isoDesc),
    weightKg: weight,
    securityCheck: row.security_check ?? asText(rawField(raw, 'securityCheck')),
    cleared: clearedStatus(row, events),
    impedimentCount: stopCount,
    impedimentCodes: codes,
    temp,
    hazardCount: row.hazard_count ?? asNumber(rawField(raw, 'hazardCount')) ?? 0,
    oversizeCount: asNumber(rawField(raw, 'oversizeCount')) ?? 0,
    lastFreeTime: row.last_free_at ?? asText(rawField(raw, 'lastFreeDatetime')),
    dischargePortName: dischargePort,
    emptyReturnDepotName: depotName,
    loadPortName: loadPort,
  }
}

export function buildPortConnectVisitViews(
  rows: ContainerTrackingRow[],
  events: BookingTrackingEvent[] | null | undefined,
): PortConnectVisitView[] {
  return rows.map((row) => buildPortConnectVisitView(row, events ?? []))
}
