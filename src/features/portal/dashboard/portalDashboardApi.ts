import { supabase } from '../../../supabase'
import type { PortMap } from '../../../hooks/usePorts'
import type { PortalRange } from './portalFormat'
import { previousRangeBounds, rangeBounds } from './portalFormat'
import {
  isArrived, isAtOrigin, isBooked, isDeparting, isInTransit, mapShipmentStatus, shipmentDirection,
} from './portalStatus'
import { buildTradeKpis, type TradeKpiMetrics } from './portalTradeKpi'

export type { CalendarDay, CalendarEvent } from './portalCalendar'
export { buildCalendar } from './portalCalendar'

export type PortalShipmentRow = {
  job_unique: number
  module: string | null
  mode: string | null
  direction: string | null
  house_bill: string | null
  job_no: string | null
  shipment_no: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  doc_date: string | null
  relevant_date: string | null
  shipper_name: string | null
  consignee_name: string | null
  customer_ref: string | null
  consol_key: string | null
  goods_desc: string | null
  pack_qty: number | null
  pack_type: string | null
  weight_kg: number | null
  volume_m3: number | null
  load_type: 'LCL' | 'FCL' | null
  status: string
  customers: { name: string } | null
}

export type KpiMetric = { label: string; value: number; deltaPct: number; up: boolean }

export type PaymentAging = { current: number; days30_60: number; days60plus: number }

export type PaymentKpi = {
  total: number
  count: number
  currency: string
  aging: PaymentAging
}

export type { TradeKpiMetrics } from './portalTradeKpi'

export type AttentionItem = {
  ref: string
  lane: string
  flag: string
  eta: string
  sev: 'high' | 'med'
  mode: 'air' | 'sea'
}

export type GlobeLane = {
  fromCode: string
  toCode: string
  dir: 'import' | 'export'
  mode: 'air' | 'sea'
  n: number
}

export type GlobeBubble = {
  code: string
  name: string
  lat: number
  lng: number
  vol: number
  imp: number
  exp: number
}

const SHIP_SELECT = `
  job_unique, module, mode, direction, house_bill, job_no, shipment_no,
  origin, destination, vessel_flight, etd, eta, departed, arrived, doc_date, relevant_date,
  shipper_name, consignee_name, customer_ref, load_type,
  consol_key, goods_desc, pack_qty, pack_type, weight_kg, volume_m3, status,
  customers ( name )
`

function pctDelta(cur: number, prev: number): { deltaPct: number; up: boolean } {
  if (prev === 0) return { deltaPct: cur > 0 ? 100 : 0, up: cur >= prev }
  const deltaPct = Math.round(((cur - prev) / prev) * 1000) / 10
  return { deltaPct: Math.abs(deltaPct), up: cur >= prev }
}

async function fetchShipmentsInRange(from: string, to: string): Promise<PortalShipmentRow[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select(SHIP_SELECT)
    .gte('relevant_date', from)
    .lte('relevant_date', to)
    .order('relevant_date', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data as PortalShipmentRow[]) ?? []
}

export async function loadPortalDashboard(range: PortalRange, ports: PortMap) {
  const bounds = rangeBounds(range)
  const prevBounds = previousRangeBounds(range)
  const [rows, prevRows, invoiceRes, containerRes] = await Promise.all([
    fetchShipmentsInRange(bounds.from, bounds.to),
    fetchShipmentsInRange(prevBounds.from, prevBounds.to),
    supabase.from('invoices').select('balance, currency, doc_date').gt('balance', 0),
    supabase.from('containers').select('id, consol_key, c_number, container_size, avail_to'),
  ])

  const open = rows.filter((r) => !isArrived(r.status))
  const kpis = buildKpis(rows, prevRows)
  const containerRows = containerRes.data ?? []
  const trade = buildTradeKpis(rows, containerRows)
  const payments = buildPayments(invoiceRes.data ?? [])
  const attention = buildAttention(open, ports)
  const globe = buildGlobeData(open, ports)

  return {
    kpis,
    trade,
    payments,
    shipments: rows,
    containers: containerRows,
    openCount: open.length,
    attention,
    globe,
    lastUpdated: new Date(),
  }
}

function buildKpis(cur: PortalShipmentRow[], prev: PortalShipmentRow[]): KpiMetric[] {
  const count = (rows: PortalShipmentRow[], fn: (s: string) => boolean) => rows.filter((r) => fn(r.status)).length
  const defs: [string, (s: string) => boolean][] = [
    ['Booked', (s) => isBooked(s) || isAtOrigin(s)],
    ['In Transit', isInTransit],
    ['Departing', isDeparting],
    ['Arriving', (s) => isInTransit(s) || mapShipmentStatus(s).label === 'At Destination'],
  ]
  return defs.map(([label, fn]) => {
    const value = count(cur, fn)
    const prevVal = count(prev, fn)
    const { deltaPct, up } = pctDelta(value, prevVal)
    return { label, value, deltaPct, up }
  })
}

function daysSinceInvoice(docDate: string | null | undefined): number | null {
  if (!docDate) return null
  const d = new Date(docDate.includes('T') ? docDate : `${docDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function buildPayments(
  invoices: { balance: number | null; currency: string | null; doc_date: string | null }[],
): PaymentKpi {
  const open = invoices.filter((i) => (i.balance ?? 0) > 0)
  const aging: PaymentAging = { current: 0, days30_60: 0, days60plus: 0 }
  for (const inv of open) {
    const bal = inv.balance ?? 0
    const age = daysSinceInvoice(inv.doc_date)
    if (age == null || age <= 30) aging.current += bal
    else if (age <= 60) aging.days30_60 += bal
    else aging.days60plus += bal
  }
  const total = open.reduce((s, i) => s + (i.balance ?? 0), 0)
  return { total, count: open.length, currency: open[0]?.currency ?? 'NZD', aging }
}

function buildAttention(open: PortalShipmentRow[], ports: PortMap): AttentionItem[] {
  const today = new Date().toISOString().slice(0, 10)
  const items: AttentionItem[] = []

  for (const r of open.slice(0, 20)) {
    const ref = r.job_no ?? r.house_bill ?? String(r.job_unique)
    const o = ports.get(r.origin ?? '')?.name ?? r.origin ?? '—'
    const d = ports.get(r.destination ?? '')?.name ?? r.destination ?? '—'
    const lane = `${o} → ${d}`
    const eta = r.eta ?? r.relevant_date
    const mode = r.mode === 'air' ? 'air' : 'sea'

    if (r.eta && r.eta < today && !isArrived(r.status)) {
      items.push({ ref, lane, flag: 'Overdue arrival — shipment past ETA', eta: eta.slice(5), sev: 'high', mode })
      continue
    }
    if (r.etd && r.etd < today && isAtOrigin(r.status)) {
      items.push({ ref, lane, flag: 'Departure delayed — still at origin past ETD', eta: (eta ?? r.etd).slice(5), sev: 'high', mode })
      continue
    }
    if (r.eta) {
      const days = Math.ceil((new Date(r.eta).getTime() - Date.now()) / 86400000)
      if (days >= 0 && days <= 3 && isBooked(r.status)) {
        items.push({ ref, lane, flag: 'Arriving soon — still booked', eta: r.eta.slice(5), sev: 'med', mode })
      }
    }
  }

  return items.slice(0, 6)
}

export function buildGlobeData(open: PortalShipmentRow[], ports: PortMap): { lanes: GlobeLane[]; bubbles: GlobeBubble[] } {
  const laneMap = new Map<string, GlobeLane>()
  const bubbleMap = new Map<string, GlobeBubble>()

  for (const r of open) {
    if (!r.origin || !r.destination) continue
    const dir = shipmentDirection(r)
    const mode = r.mode === 'air' ? 'air' : 'sea'
    const key = `${r.origin}|${r.destination}|${dir}`
    const lane = laneMap.get(key) ?? { fromCode: r.origin, toCode: r.destination, dir, mode, n: 0 }
    lane.n += 1
    laneMap.set(key, lane)

    for (const code of [r.origin, r.destination]) {
      const p = ports.get(code)
      if (!p?.lat || !p?.lng) continue
      const b = bubbleMap.get(code) ?? {
        code, name: p.name, lat: p.lat, lng: p.lng, vol: 0, imp: 0, exp: 0,
      }
      b.vol += 1
      if (code === r.destination && dir === 'import') b.imp += 1
      else if (code === r.origin && dir === 'export') b.exp += 1
      else if (dir === 'import' && code === r.origin) b.imp += 1
      else if (dir === 'export' && code === r.destination) b.exp += 1
      bubbleMap.set(code, b)
    }
  }

  const lanes = [...laneMap.values()].sort((a, b) => b.n - a.n).slice(0, 12)
  const bubbles = [...bubbleMap.values()].filter((b) => b.vol > 0)
  return { lanes, bubbles }
}

export function shipmentDisplayName(r: PortalShipmentRow): string {
  return r.goods_desc?.trim() || r.customers?.name || r.shipper_name || `Shipment ${r.job_unique}`
}

export function shipmentTrackingId(r: PortalShipmentRow): string {
  return r.job_no ?? r.house_bill ?? r.shipment_no ?? `#${r.job_unique}`
}

export function shipmentCargoLine(r: PortalShipmentRow): string {
  const parts: string[] = []
  if (r.goods_desc) parts.push(r.goods_desc.slice(0, 40))
  if (r.pack_qty && r.pack_type) parts.push(`${r.pack_qty}× ${r.pack_type}`)
  else if (r.volume_m3) parts.push(`${r.volume_m3} cbm`)
  return parts.join(' · ') || '—'
}
