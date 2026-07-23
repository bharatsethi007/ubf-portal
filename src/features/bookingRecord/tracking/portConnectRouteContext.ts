import type { ContainerTrackingRow } from './trackingTypes'

export type PortConnectRouteContext = {
  loadPort: string
  dischargePort: string
  vesselName: string
  voyage: string
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

export function buildPortConnectRouteContext(
  containers: ContainerTrackingRow[],
): PortConnectRouteContext | null {
  const row = containers[0]
  if (!row) return null

  const raw = row.raw
  const loadPort = row.load_port_name ?? asText(rawField(raw, 'loadPortName'))
  const dischargePort = row.discharge_port_name ?? asText(rawField(raw, 'dischargePortName'))
  const vesselName = row.inbound_vessel_name ?? asText(rawField(raw, 'inboundVesselName'))
  const voyage =
    row.operator_voyage_id
    ?? asText(rawField(raw, 'containerOperatorVoyageId'))
    ?? row.inbound_vessel_ref
    ?? asText(rawField(raw, 'inboundVesselRef'))

  if (!loadPort && !dischargePort && !vesselName && !voyage) return null

  return {
    loadPort: loadPort ?? '—',
    dischargePort: dischargePort ?? '—',
    vesselName: vesselName ?? '—',
    voyage: voyage ?? '—',
  }
}
