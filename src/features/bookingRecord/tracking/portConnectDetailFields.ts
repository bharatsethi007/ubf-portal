import { formatContainerTypeLabel } from './trackingFormat'
import {
  formatPortConnectDate,
  formatPortConnectDateTime,
} from './portConnectAucklandDate'
import type { ContainerTrackingRow } from './trackingTypes'

export type DetailField = { label: string; value: string }

function rawField(raw: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!raw) return null
  const map = new Map(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]))
  for (const key of keys) {
    const hit = map.get(key.toLowerCase())
    if (hit != null && hit !== '') return hit
  }
  return null
}

function text(raw: Record<string, unknown> | null, ...keys: string[]): string {
  const v = rawField(raw, ...keys)
  if (v == null) return ''
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v).trim()
}

function dt(raw: Record<string, unknown> | null, ...keys: string[]): string {
  const v = text(raw, ...keys)
  return v ? formatPortConnectDateTime(v) : ''
}

function rowDt(value: string | null | undefined): string {
  return value?.trim() ? formatPortConnectDateTime(value) : ''
}

export function containerDetailFields(row: ContainerTrackingRow): DetailField[] {
  const raw = row.raw
  const iso = row.iso_type ?? text(raw, 'containerIsoTypeCode')
  const desc = row.iso_desc ?? text(raw, 'containerIsoTypeDescription')
  const isoDisplay = [iso, desc].filter(Boolean).join(' — ')
  return [
    { label: 'ISO', value: isoDisplay || formatContainerTypeLabel(row.container_type) },
    { label: 'Declared Weight (kg)', value: text(raw, 'declaredWeight') },
    { label: 'Declared Weight VGM', value: text(raw, 'declaredWeightVgm') },
    { label: 'Commodity', value: text(raw, 'commodityCode') },
    { label: 'Status', value: row.container_status ?? text(raw, 'containerStatus') },
    { label: 'Seals', value: text(raw, 'seals') },
    { label: 'Attached Equipment', value: text(raw, 'attachedEquipment') },
  ]
}

export function visitDetailFields(row: ContainerTrackingRow): DetailField[] {
  const raw = row.raw
  return [
    { label: 'Port', value: row.port_code ?? text(raw, 'portCode') },
    { label: 'Category', value: text(raw, 'category') },
    { label: 'Vessel Name', value: row.inbound_vessel_name ?? text(raw, 'inboundVesselName') },
    { label: 'Voyage', value: row.operator_voyage_id ?? text(raw, 'containerOperatorVoyageId') },
    { label: 'Location', value: row.container_location ?? text(raw, 'containerLocation') },
    { label: 'Line Operator', value: row.operator_name ?? text(raw, 'containerOperatorName') },
    { label: 'Load Port', value: row.load_port_name ?? text(raw, 'loadPortName') },
    { label: 'Discharge Port', value: row.discharge_port_name ?? text(raw, 'dischargePortName') },
    { label: 'Destination Port', value: text(raw, 'destinationPortName') },
    { label: 'Last Free Time', value: dt(raw, 'lastFreeDatetime') || rowDt(row.last_free_at) },
    { label: 'VBS Slot Date/Time', value: dt(raw, 'vbsSlotDatetime') || rowDt(row.vbs_slot_at) },
    { label: 'Seaport Departure Mode', value: text(raw, 'seaportTransportMode') },
    { label: 'Seaport Outbound Carrier', value: text(raw, 'seaPortCarrier') },
    { label: 'Inland Port Outbound Carrier', value: text(raw, 'inlandPortCarrier') },
    {
      label: 'Empty Return Depot',
      value: row.empty_return_depot_name ?? text(raw, 'emptyReturnDepotName', 'emptyReturnDepotCode'),
    },
    { label: 'Security Check', value: row.security_check ?? text(raw, 'securityCheck') },
    {
      label: 'Impediments',
      value: text(raw, 'stopCount') ? `${text(raw, 'stopCount')} stop(s)` : '',
    },
  ]
}

export function eventDetailFields(row: ContainerTrackingRow): DetailField[] {
  const raw = row.raw
  const ata = text(raw, 'inboundVesselActualArrivalDatetime', 'seaPortArrivalDatetime') || row.inbound_ata
  const eta = text(raw, 'inboundVesselPublishedArrivalDatetime') || row.inbound_eta
  const vesselEtaAta = ata
    ? `ATA ${formatPortConnectDateTime(ata)}`
    : eta
      ? `ETA ${formatPortConnectDateTime(eta)}`
      : ''
  return [
    { label: 'Last Updated', value: dt(raw, 'lastUpdated') || rowDt(row.portconnect_last_updated) },
    { label: 'Activated Date', value: dt(raw, 'activatedDate', 'activatedDatetime') },
    { label: 'Vessel ETA/ATA', value: vesselEtaAta },
    {
      label: 'Vessel ETD/ATD',
      value: dt(raw, 'inboundVesselActualDepartureDatetime')
        || dt(raw, 'inboundVesselPublishedDepartureDatetime'),
    },
    { label: 'Customs Release', value: dt(raw, 'customsReleaseDatetime') || rowDt(row.customs_release_at) },
    { label: 'Line Release', value: dt(raw, 'lineReleaseDatetime') || rowDt(row.line_release_at) },
    { label: 'MPI Release', value: dt(raw, 'mpiReleaseDatetime') || rowDt(row.mpi_release_at) },
    { label: 'Discharge Date', value: dt(raw, 'dischargedDatetime') || rowDt(row.discharged_at) },
    { label: 'Seaport Gate In', value: dt(raw, 'seaPortGateInDateTime') },
    { label: 'Inland Port Gate In', value: dt(raw, 'inlandPortGateInDateTime', 'inlandPortArrivalDatetime') },
    { label: 'Seaport Gate Out', value: dt(raw, 'seaPortGateOutDateTime') || rowDt(row.gate_out_at) },
    { label: 'Inland Port Gate Out', value: dt(raw, 'inlandPortGateOutDateTime') },
  ]
}
