import type { PortMap } from '../../../hooks/usePorts'
import type { HomeInvoice, HomeShipment } from './usePortalHome'

const DAY = 86400000

export function todayIso(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b.slice(0, 10)}T00:00:00`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00`).getTime()) / DAY)
}

type NoFields = { module?: string | null; job_no: string | number | null; house_bill: string | null; shipment_no: string | number | null; job_unique: number }

/**
 * UBF shipment number as staff use it.
 * Exports: job number (e.g. 124285). Imports: module + shipment number (e.g. FIS-2140),
 * with the house index appended when a shipment holds several houses (FIS-2140/2).
 */
export function shipmentNo(s: NoFields): string {
  const mod = (s.module ?? '').toUpperCase()
  if (mod.startsWith('FI') && s.shipment_no != null) {
    const house = Number(s.job_no ?? 0)
    return `${mod}-${s.shipment_no}${house > 1 ? `/${house}` : ''}`
  }
  if (s.job_no != null) return String(s.job_no)
  if (s.shipment_no != null) return `${mod || 'SHP'}-${s.shipment_no}`
  return s.house_bill ?? `#${s.job_unique}`
}

/** Always link by the unique id; shipment numbers can repeat across modules. */
export function detailPath(s: { job_unique: number }, tab?: string): string {
  const base = `/portal/shipments/${encodeURIComponent(`#${s.job_unique}`)}`
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

export function fmtDayLong(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function shortPlace(name: string | null | undefined, code: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return code ?? ''
  return n.replace(/\s+(International\s+)?Airport$/i, '').replace(/\s+Bauerfield$/i, '').replace(/^Faleolo$/i, 'Apia')
}

export function placeName(code: string | null, ports: PortMap): string {
  if (!code) return ''
  return shortPlace(ports.get(code)?.name, code)
}

export function shortCode(code: string | null): string {
  if (!code) return '—'
  return code.length === 5 ? code.slice(2) : code
}

export function isSea(s: { mode: string | null }): boolean {
  return (s.mode ?? '').toLowerCase() === 'sea'
}

export function titleCase(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  if (!t) return ''
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Stc|Ltd|Nz|Lcl|Fcl)\b/g, (m) => m.toUpperCase())
}

export function stageLabel(s: HomeShipment): string {
  if (s.stage >= 3) return s.arrived ? 'Arrived' : 'Arrived (est.)'
  if (s.stage === 2) return 'In transit'
  return 'Booked'
}

export function stageTone(s: HomeShipment): 'green' | 'blue' | 'grey' {
  return s.stage >= 3 ? 'green' : s.stage === 2 ? 'blue' : 'grey'
}

/** Fraction of the leg completed, 0..1, from schedule dates. */
export function legFraction(s: HomeShipment, today = todayIso()): number {
  if (s.stage >= 3) return 1
  if (s.stage < 2) return 0
  const from = s.departed ?? s.etd
  const to = s.eta
  if (!from || !to) return 0.5
  const total = Math.max(1, daysBetween(from, to))
  return Math.min(0.97, Math.max(0.03, daysBetween(from, today) / total))
}

export function progressPct(s: HomeShipment): number {
  if (s.stage >= 3) return 100
  if (s.stage === 2) return Math.round(20 + legFraction(s) * 70)
  return 10
}

// ---------- geo ----------
export type LngLat = [number, number]

/** Great-circle points between a and b, longitudes unwrapped so lines never jump the antimeridian. */
export function greatCircle(a: LngLat, b: LngLat, n = 64): LngLat[] {
  const rad = Math.PI / 180
  const [l1, p1] = [a[0] * rad, a[1] * rad]
  const [l2, p2] = [b[0] * rad, b[1] * rad]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (d === 0) return [a, b]
  const out: LngLat[] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    let lng = Math.atan2(y, x) / rad
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / rad
    if (out.length) {
      const prev = out[out.length - 1][0]
      while (lng - prev > 180) lng -= 360
      while (lng - prev < -180) lng += 360
    } else {
      // keep the Pacific in the middle of the map
      if (lng < -30) lng += 360
    }
    out.push([lng, lat])
  }
  return out
}

export function pointAt(line: LngLat[], f: number): LngLat {
  const i = Math.min(line.length - 1, Math.max(0, Math.round(f * (line.length - 1))))
  return line[i]
}

export function portCoord(code: string | null, ports: PortMap): LngLat | null {
  if (!code) return null
  const p = ports.get(code)
  return p ? [p.lng, p.lat] : null
}

// ---------- money ----------
export type Money = { open: number; overdue: number; overdueCount: number; currency: string }

export function money(invoices: HomeInvoice[], today = todayIso()): Money {
  let open = 0
  let overdue = 0
  let overdueCount = 0
  // Balances are ledger (NZD) amounts, whatever currency the invoice was billed in.
  const currency = 'NZD'
  for (const i of invoices) {
    const bal = Number(i.balance ?? 0)
    if (bal <= 0) continue
    open += bal
    const due = i.date_due ?? (i.doc_date ? addDays(i.doc_date.slice(0, 10), 30) : null)
    if (due && due < today) { overdue += bal; overdueCount++ }
  }
  return { open, overdue, overdueCount, currency }
}

export function fmtMoney(n: number, currency = 'NZD', compact = false): string {
  try {
    return new Intl.NumberFormat('en-NZ', compact
      ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
      : { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `$${Math.round(n).toLocaleString()}`
  }
}

export function fmtNum(n: number, compact = false): string {
  return new Intl.NumberFormat('en-NZ', compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(n)
}

// ---------- exceptions ----------
export type Exception = {
  key: string
  id?: number
  tone: 'red' | 'amber' | 'blue'
  kind: string
  title: string
  sub: string
  to: string
  sort: number
}

export function exceptions(pool: HomeShipment[], active: HomeShipment[], m: Money, ports: PortMap, today = todayIso()): Exception[] {
  const out: Exception[] = []
  for (const s of pool) {
    const no = shipmentNo(s)
    const lane = `${shortCode(s.origin)} → ${shortCode(s.destination)}`
    if (s.stage === 2 && s.eta && s.eta < today) {
      const late = daysBetween(s.eta, today)
      out.push({ key: `late-${s.job_unique}`, id: s.job_unique, tone: 'red', kind: 'Delayed', title: `${no} past ETA by ${late} ${late === 1 ? 'day' : 'days'}`,
        sub: `${lane} · was due ${fmtDay(s.eta)} at ${placeName(s.destination, ports)}`, to: detailPath(s), sort: 100 + late })
    } else if (s.stage === 1 && s.etd && s.etd < addDays(today, -2) && s.is_active) {
      const late = daysBetween(s.etd, today)
      out.push({ key: `dep-${s.job_unique}`, id: s.job_unique, tone: 'amber', kind: 'Departure', title: `${no} not confirmed departed`,
        sub: `${lane} · planned ${fmtDay(s.etd)}${s.vessel_flight ? ` on ${s.vessel_flight}` : ''}`, to: detailPath(s), sort: 50 + late })
    }
  }
  if (m.overdueCount > 0) {
    out.push({ key: 'inv', tone: 'amber', kind: 'Billing', title: `${m.overdueCount} ${m.overdueCount === 1 ? 'invoice' : 'invoices'} past due`,
      sub: `${fmtMoney(m.overdue, m.currency)} outstanding`, to: '/portal/billing?tab=overdue', sort: 80 })
  }
  const noRef = active.filter((s) => !s.customer_ref).length
  if (noRef > 0) {
    out.push({ key: 'po', tone: 'blue', kind: 'Data', title: `${noRef} active ${noRef === 1 ? 'shipment has' : 'shipments have'} no PO`,
      sub: 'Add your reference so you can search and report by it', to: '/portal/shipments', sort: 10 })
  }
  return out.sort((a, b) => b.sort - a.sort)
}

// ---------- calendar ----------
export type CalEvent = { key: string; id: number; type: 'dep' | 'arr'; date: string; no: string; place: string; to: string; sea: boolean }

export function calendarEvents(pool: HomeShipment[], ports: PortMap): CalEvent[] {
  const out: CalEvent[] = []
  for (const s of pool) {
    const no = shipmentNo(s)
    const dep = s.departed ?? s.etd
    const arr = s.arrived ?? s.eta
    if (dep) out.push({ key: `d${s.job_unique}`, id: s.job_unique, type: 'dep', date: dep.slice(0, 10), no, place: placeName(s.origin, ports), to: detailPath(s), sea: isSea(s) })
    if (arr) out.push({ key: `a${s.job_unique}`, id: s.job_unique, type: 'arr', date: arr.slice(0, 10), no, place: placeName(s.destination, ports), to: detailPath(s), sea: isSea(s) })
  }
  return out
}

export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday first
  const start = new Date(year, month, 1 - startOffset)
  const cells: { iso: string; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    cells.push({ iso, inMonth: d.getMonth() === month })
  }
  const lastRowInMonth = cells.slice(35).some((c) => c.inMonth)
  return lastRowInMonth ? cells : cells.slice(0, 35)
}
