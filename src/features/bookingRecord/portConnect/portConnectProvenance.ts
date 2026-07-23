import { relativeUpdatedAt } from '../tracking/trackingFormat'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import {
  aggregatePortConnectBookingFields,
  portConnectContainerSeal,
  portConnectContainerType,
} from './bookingPortConnectCoalesce'
import type { OverrideField } from '../bookingFieldOverrides'
import { containerOverrideKey } from '../bookingFieldOverrides'

export type PortConnectFieldKey =
  | OverrideField
  | 'container_type'
  | 'seal'

export type PortConnectDetailFocus =
  | 'vesselEtaAta'
  | 'lineOperator'
  | 'dischargePort'
  | 'dischargeDate'
  | 'seaPortGateOut'
  | 'inlandReturn'
  | 'lastFreeTime'
  | 'iso'
  | 'seals'

export const PORTCONNECT_FIELD_DISPLAY: Record<PortConnectFieldKey, string> = {
  m_eta: 'ETA',
  m_shipping_line: 'Shipping line',
  m_discharge_port: 'Discharge port',
  discharge_date: 'Discharge date',
  delivery_date: 'Delivery date',
  container_return_date: 'Container return',
  last_free_day: 'Last free day',
  container_type: 'Container type',
  seal: 'Seal',
  swb_released: 'SWB released',
  cleared: 'Cleared',
}

export const DETAIL_FOCUS_LABEL: Record<PortConnectDetailFocus, string> = {
  vesselEtaAta: 'Vessel ETA/ATA',
  lineOperator: 'Line Operator',
  dischargePort: 'Discharge Port',
  dischargeDate: 'Discharge Date',
  seaPortGateOut: 'Seaport Gate Out',
  inlandReturn: 'Inland Port Gate Out',
  lastFreeTime: 'Last Free Time',
  iso: 'ISO',
  seals: 'Seals',
}

export const FIELD_DETAIL_FOCUS: Partial<Record<PortConnectFieldKey, PortConnectDetailFocus>> = {
  m_eta: 'vesselEtaAta',
  m_shipping_line: 'lineOperator',
  m_discharge_port: 'dischargePort',
  discharge_date: 'dischargeDate',
  delivery_date: 'seaPortGateOut',
  container_return_date: 'inlandReturn',
  last_free_day: 'lastFreeTime',
  container_type: 'iso',
  seal: 'seals',
}

export function portConnectProvenanceTooltip(lastSync: string | null | undefined): string {
  const rel = lastSync?.trim() ? relativeUpdatedAt(lastSync) : 'not refreshed yet'
  return `Auto-filled from PortConnect · ${rel}`
}

export function portConnectLastSync(
  containers: ContainerTrackingRow[] | null | undefined,
): string | null {
  const rows = containers ?? []
  let best: string | null = null
  for (const row of rows) {
    const candidate = row.portconnect_last_updated ?? row.updated_at
    if (!candidate) continue
    if (!best || new Date(candidate).getTime() > new Date(best).getTime()) {
      best = candidate
    }
  }
  return best
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

function rowSourcesField(
  field: PortConnectFieldKey,
  row: ContainerTrackingRow,
): boolean {
  const raw = row.raw
  switch (field) {
    case 'm_eta':
      return Boolean(
        row.inbound_ata || row.inbound_eta
        || rawField(raw, 'inboundVesselActualArrivalDatetime', 'inboundVesselPublishedArrivalDatetime'),
      )
    case 'm_shipping_line':
      return Boolean(row.operator_name || rawField(raw, 'containerOperatorName'))
    case 'm_discharge_port':
      return Boolean(row.discharge_port_name || rawField(raw, 'dischargePortName'))
    case 'discharge_date':
      return Boolean(row.discharged_at || rawField(raw, 'dischargedDatetime'))
    case 'delivery_date':
      return Boolean(rawField(raw, 'seaPortGateOutDateTime') || row.gate_out_at)
    case 'container_return_date':
      return Boolean(rawField(raw, 'inlandPortGateOutDateTime', 'inlandPortGateInDateTime'))
    case 'last_free_day':
      return Boolean(row.last_free_at || rawField(raw, 'lastFreeDatetime'))
    case 'container_type':
      return Boolean(portConnectContainerType(row))
    case 'seal':
      return Boolean(portConnectContainerSeal(row))
    default:
      return false
  }
}

export function portConnectSourceContainer(
  field: PortConnectFieldKey,
  containers: ContainerTrackingRow[] | null | undefined,
): ContainerTrackingRow | null {
  for (const row of containers ?? []) {
    if (rowSourcesField(field, row)) return row
  }
  return null
}

export type PortConnectSnapshot = {
  fields: Partial<Record<OverrideField, string | null>>
  containers: Record<string, { type: string | null; seal: string | null }>
}

export function buildPortConnectSnapshot(
  trackingContainers: ContainerTrackingRow[] | null | undefined,
  containerRows: Array<{ container_no: string; source?: string }>,
  dischargePortHint: string | null | undefined,
): PortConnectSnapshot {
  const pc = aggregatePortConnectBookingFields(trackingContainers, dischargePortHint)
  const fields: PortConnectSnapshot['fields'] = {
    m_eta: pc?.eta ?? null,
    m_shipping_line: pc?.shippingLine ?? null,
    m_discharge_port: pc?.dischargePort ?? null,
    discharge_date: pc?.dischargeDate ?? null,
    delivery_date: pc?.deliveryDate ?? null,
    container_return_date: pc?.containerReturnDate ?? null,
    last_free_day: pc?.lastFreeDay ?? null,
  }

  const trackingByNo = new Map(
    (trackingContainers ?? []).map((r) => [r.container_no.trim().toUpperCase(), r]),
  )
  const containers: PortConnectSnapshot['containers'] = {}
  for (const row of containerRows) {
    const key = row.container_no.trim().toUpperCase()
    const tracking = trackingByNo.get(key)
    if (row.source === 'portconnect' && tracking) {
      containers[key] = {
        type: portConnectContainerType(tracking),
        seal: portConnectContainerSeal(tracking),
      }
    }
  }

  return { fields, containers }
}

export function diffPortConnectSnapshots(
  before: PortConnectSnapshot | null,
  after: PortConnectSnapshot,
): PortConnectFieldKey[] {
  if (!before) return []
  const changed: PortConnectFieldKey[] = []

  for (const key of Object.keys(PORTCONNECT_FIELD_DISPLAY) as PortConnectFieldKey[]) {
    if (key === 'container_type' || key === 'seal') continue
    const prev = before.fields[key as OverrideField] ?? null
    const next = after.fields[key as OverrideField] ?? null
    if (prev !== next && (prev || next)) changed.push(key)
  }

  const containerNos = new Set([
    ...Object.keys(before.containers),
    ...Object.keys(after.containers),
  ])
  for (const no of containerNos) {
    const prev = before.containers[no]
    const next = after.containers[no]
    if ((prev?.type ?? null) !== (next?.type ?? null) && (prev?.type || next?.type)) {
      changed.push('container_type')
    }
    if ((prev?.seal ?? null) !== (next?.seal ?? null) && (prev?.seal || next?.seal)) {
      changed.push('seal')
    }
  }

  return [...new Set(changed)]
}

export function formatRefreshChangeList(keys: PortConnectFieldKey[]): string {
  const labels = keys
    .filter((k) => !String(k).includes(':'))
    .map((k) => PORTCONNECT_FIELD_DISPLAY[k] ?? k)
  const containerKeys = keys.filter((k) => String(k).includes(':'))
  if (containerKeys.length) labels.push('Container type', 'Seal')
  return [...new Set(labels)].join(', ')
}

export function containerFieldOverrideKey(containerNo: string): string {
  return containerOverrideKey(containerNo)
}
