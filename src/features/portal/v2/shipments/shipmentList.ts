import type { PortMap } from '../../../../hooks/usePorts'
import type { HomeShipment } from '../usePortalHome'
import { addDays, fmtDay, placeName, shipmentNo, titleCase, todayIso } from '../homeModel'

export type ListShipment = HomeShipment & { containers: string[] }

export type Bucket = 'all' | 'attention' | 'booked' | 'transit' | 'arriving' | 'arrived'
export type Range = '90d' | '12m' | 'all'
export type SortKey = 'eta' | 'etd' | 'no' | 'recent'

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'booked', label: 'Booked' },
  { key: 'transit', label: 'In transit' },
  { key: 'arriving', label: 'Arriving 7 days' },
  { key: 'arrived', label: 'Arrived' },
]

/** ETA passed but not marked arrived, or booked but ETD passed without departure. */
export function isLate(s: HomeShipment, today = todayIso()): boolean {
  if (s.stage >= 3) return false
  if (s.eta && s.eta < today) return true
  return s.stage < 2 && Boolean(s.etd) && s.etd! < addDays(today, -3)
}

export function inBucket(s: HomeShipment, b: Bucket, today = todayIso()): boolean {
  switch (b) {
    case 'all': return true
    case 'attention': return isLate(s, today) || (s.stage < 3 && !s.customer_ref)
    case 'booked': return s.stage < 2
    case 'transit': return s.stage === 2
    case 'arriving': return s.stage < 3 && Boolean(s.eta) && s.eta! >= today && s.eta! <= addDays(today, 7)
    case 'arrived': return s.stage >= 3
  }
}

export function searchText(s: ListShipment, ports: PortMap): string {
  return [
    shipmentNo(s), s.house_bill, s.master_bill, s.customer_ref, s.goods_desc, s.shipper_name, s.consignee_name,
    s.vessel_flight, s.origin, s.destination, placeName(s.origin, ports), placeName(s.destination, ports), ...s.containers,
  ].filter(Boolean).join(' ').toLowerCase()
}

export function sortRows(rows: ListShipment[], key: SortKey): ListShipment[] {
  const out = [...rows]
  const by = (a: string | null | undefined, b: string | null | undefined, dir = 1) => ((a ?? '9999') < (b ?? '9999') ? -dir : (a ?? '9999') > (b ?? '9999') ? dir : 0)
  if (key === 'eta') out.sort((a, b) => by(a.arrived ?? a.eta, b.arrived ?? b.eta, -1))
  else if (key === 'etd') out.sort((a, b) => by(a.departed ?? a.etd, b.departed ?? b.etd, -1))
  else if (key === 'no') out.sort((a, b) => shipmentNo(a).localeCompare(shipmentNo(b), undefined, { numeric: true }) * -1)
  else out.sort((a, b) => by(a.doc_date, b.doc_date, -1))
  return out
}

/** Two-letter country for a flag: UN/LOCODE prefix for sea, port table for airports. */
export function countryOf(code: string | null, ports: PortMap): string | null {
  if (!code) return null
  const c = code.toUpperCase()
  if (c.length === 5) return c.slice(0, 2).toLowerCase()
  const p = ports.get(c)
  return p?.country_code ? p.country_code.toLowerCase() : null
}

export function partyOf(s: HomeShipment): string {
  return titleCase(s.direction === 'export' ? s.consignee_name : s.shipper_name)
}

function csvCell(v: unknown): string {
  const t = v == null ? '' : String(v)
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function toCsv(rows: ListShipment[], ports: PortMap): string {
  const head = ['Shipment', 'Direction', 'Mode', 'Load', 'Supplier / consignee', 'Your PO', 'Goods', 'From', 'To', 'ETD', 'ETA', 'Status', 'Vessel / flight', 'Containers', 'Pieces', 'Weight kg', 'Volume m3', 'House bill']
  const lines = rows.map((s) => [
    shipmentNo(s), s.direction, s.mode, s.load_type, partyOf(s), s.customer_ref, s.goods_desc,
    placeName(s.origin, ports), placeName(s.destination, ports), fmtDay(s.departed ?? s.etd), fmtDay(s.arrived ?? s.eta),
    s.status, s.vessel_flight, s.containers.join(' '), s.pack_qty, s.weight_kg, s.volume_m3, s.house_bill,
  ].map(csvCell).join(','))
  return [head.join(','), ...lines].join('\n')
}
