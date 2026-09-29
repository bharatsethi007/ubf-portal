import type { PortMap } from '../../../hooks/usePorts'
import { arcPath, inView, project, shortPlace, type Pt } from './geo'
import type { HomeInvoice, HomeShipment } from './usePortalHome'

const DAY = 86400000

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function shipmentNo(s: Pick<HomeShipment, 'job_no' | 'house_bill' | 'shipment_no' | 'job_unique'>): string {
  return String(s.job_no ?? s.house_bill ?? s.shipment_no ?? `#${s.job_unique}`)
}

export function detailPath(s: HomeShipment): string {
  return `/portal/shipments/${encodeURIComponent(shipmentNo(s))}`
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY)
}

export function placeName(code: string | null, ports: PortMap): string {
  if (!code) return ''
  const p = ports.get(code)
  return shortPlace(p?.name, code)
}

export function shortCode(code: string | null): string {
  if (!code) return ''
  return code.length === 5 ? code.slice(2) : code
}

export function isSea(s: HomeShipment): boolean {
  return (s.mode ?? '').toLowerCase() === 'sea'
}

export function titleCase(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  if (!t) return ''
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bStc\b/g, 'STC')
}

export const STAGES = ['Booked', 'Departed', 'Arrived', 'Cleared', 'Delivered'] as const

export function stageLabel(s: HomeShipment): string {
  if (s.stage >= 3) return 'Arrived'
  if (s.stage === 2) return 'In transit'
  return 'Booked'
}

/** 0..100 along the whole journey (booked -> delivered). */
export function progressPct(s: HomeShipment, today = todayIso()): number {
  if (s.stage >= 3) return 62
  if (s.stage === 2) {
    const from = s.departed ?? s.etd
    const to = s.eta
    if (from && to) {
      const total = Math.max(1, daysBetween(from, to))
      const gone = Math.min(total, Math.max(0, daysBetween(from, today)))
      return Math.round(22 + (gone / total) * 36)
    }
    return 40
  }
  return 12
}

export function statusLine(s: HomeShipment, ports: PortMap, today = todayIso()): string {
  const dest = placeName(s.destination, ports)
  if (s.stage >= 3) {
    const when = s.arrived ?? s.eta
    return when ? `Arrived ${dest} ${fmtDay(when)}${s.arrived ? '' : ' (est.)'}` : `Arrived ${dest}`
  }
  if (s.stage === 2) {
    if (s.eta) {
      const n = daysBetween(today, s.eta)
      if (n > 1) return `${dest} in ${n} days · ETA ${fmtDay(s.eta)}`
      if (n === 1) return `${dest} tomorrow`
      if (n === 0) return `Due in ${dest} today`
      return `Was due ${fmtDay(s.eta)} · checking with carrier`
    }
    return `On the way to ${dest}`
  }
  if (s.etd && s.etd >= today) return `Departs ${fmtDay(s.etd)}${s.vessel_flight ? ` on ${s.vessel_flight}` : ''}`
  if (s.etd && s.etd < today) return 'Schedule being confirmed with carrier'
  return s.vessel_flight ? `Booked on ${s.vessel_flight} · date to be confirmed` : 'Booked · awaiting schedule'
}

export function sortForMotion(list: HomeShipment[]): HomeShipment[] {
  return [...list].sort((a, b) => {
    if (b.stage !== a.stage) return (b.stage === 2 ? 3 : b.stage) - (a.stage === 2 ? 3 : a.stage)
    return (b.doc_date ?? '').localeCompare(a.doc_date ?? '')
  })
}

export type Lane = {
  key: string
  path: string
  from: Pt & { code: string; name: string }
  to: Pt & { code: string; name: string }
  count: number
  moving: boolean
}

export function buildLanes(list: HomeShipment[], ports: PortMap): { lanes: Lane[]; outside: number } {
  const map = new Map<string, Lane>()
  let outside = 0
  for (const s of list) {
    const o = s.origin ? ports.get(s.origin) : undefined
    const d = s.destination ? ports.get(s.destination) : undefined
    if (!o || !d) continue
    const a = project(o.lat, o.lng)
    const b = project(d.lat, d.lng)
    if (!inView(a) || !inView(b)) { outside++; continue }
    const key = `${placeName(s.origin, ports)}>${placeName(s.destination, ports)}`
    const lane = map.get(key)
    if (lane) {
      lane.count++
      lane.moving = lane.moving || s.stage === 2
      continue
    }
    map.set(key, {
      key,
      path: arcPath(a, b),
      from: { ...a, code: s.origin!, name: placeName(s.origin, ports) },
      to: { ...b, code: s.destination!, name: placeName(s.destination, ports) },
      count: 1,
      moving: s.stage === 2,
    })
  }
  return { lanes: [...map.values()].sort((x, y) => y.count - x.count).slice(0, 10), outside }
}

export function countries(list: HomeShipment[], ports: PortMap): number {
  const set = new Set<string>()
  for (const s of list) {
    for (const code of [s.origin, s.destination]) {
      const c = code ? ports.get(code)?.country_code : undefined
      if (c && c !== 'NZ') set.add(c)
    }
  }
  return set.size
}

export type Money = { open: number; overdue: number; overdueCount: number; currency: string }

export function money(invoices: HomeInvoice[], today = todayIso()): Money {
  let open = 0
  let overdue = 0
  let overdueCount = 0
  let currency = 'NZD'
  for (const i of invoices) {
    const bal = Number(i.balance ?? 0)
    if (bal <= 0) continue
    open += bal
    if (i.currency) currency = i.currency
    const due = i.date_due ?? (i.doc_date ? new Date(new Date(`${i.doc_date}T00:00:00`).getTime() + 30 * DAY).toISOString().slice(0, 10) : null)
    if (due && due < today) { overdue += bal; overdueCount++ }
  }
  return { open, overdue, overdueCount, currency }
}

export function fmtMoney(n: number, currency: string, decimals = 2): string {
  try {
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency, maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n)
  } catch {
    return `$${n.toFixed(decimals)}`
  }
}

export type NeedItem = { key: string; title: string; body: string; cta: string; to: string; tone: 'amber' | 'blue' }

export function needs(active: HomeShipment[], m: Money): NeedItem[] {
  const out: NeedItem[] = []
  if (m.overdueCount > 0) {
    out.push({
      key: 'overdue',
      title: m.overdueCount === 1 ? '1 invoice past due' : `${m.overdueCount} invoices past due`,
      body: `${fmtMoney(m.overdue, m.currency)} outstanding`,
      cta: 'View billing',
      to: '/portal/billing',
      tone: 'amber',
    })
  }
  const noRef = active.filter((s) => !s.customer_ref).length
  if (noRef > 0) {
    out.push({
      key: 'po',
      title: 'Add your PO numbers',
      body: `${noRef} ${noRef === 1 ? 'shipment has' : 'shipments have'} no reference. Add yours to search by it.`,
      cta: 'See shipments',
      to: '/portal/shipments',
      tone: 'blue',
    })
  }
  return out
}

export type Activity = { key: string; title: string; sub: string; when: string; sort: string; tone: 'blue' | 'green' | 'amber' }

export function activity(active: HomeShipment[], recent: HomeShipment[], invoices: HomeInvoice[], ports: PortMap): Activity[] {
  const seen = new Set<number>()
  const out: Activity[] = []
  for (const s of [...active, ...recent]) {
    if (seen.has(s.job_unique)) continue
    seen.add(s.job_unique)
    const no = shipmentNo(s)
    const goods = titleCase(s.goods_desc) || titleCase(s.consignee_name) || 'Shipment'
    if (s.stage >= 3) {
      const when = s.arrived ?? s.eta
      if (when) out.push({ key: `a${s.job_unique}`, title: `${no} arrived ${placeName(s.destination, ports)}`, sub: goods, when: fmtShort(when), sort: when, tone: 'green' })
    } else if (s.stage === 2) {
      const when = s.departed ?? s.etd
      if (when) out.push({ key: `d${s.job_unique}`, title: `${no} left ${placeName(s.origin, ports)}`, sub: goods, when: fmtShort(when), sort: when, tone: 'blue' })
    } else if (s.doc_date) {
      out.push({ key: `b${s.job_unique}`, title: `${no} booked`, sub: goods, when: fmtShort(s.doc_date), sort: s.doc_date, tone: 'blue' })
    }
  }
  for (const i of invoices.slice(0, 5)) {
    if (!i.doc_date) continue
    out.push({ key: `i${i.invoice_no}`, title: `Invoice ${i.invoice_no ?? ''} issued`, sub: fmtMoney(Number(i.balance ?? 0), i.currency ?? 'NZD'), when: fmtShort(i.doc_date), sort: i.doc_date, tone: 'amber' })
  }
  return out.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 6)
}
