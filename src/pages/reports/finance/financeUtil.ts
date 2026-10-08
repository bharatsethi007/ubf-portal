import type { KpiRow, PlRow } from './financeApi'

// NZ financial year runs 1 Apr - 31 Mar. FY label = calendar year it starts in (FY2026 = Apr 26 - Mar 27).
export const DATA_START = '2025-04-01' // finance sync window start (FY2025)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (y: number, m: number, d = 1) => `${y}-${pad(m)}-${pad(d)}`
export const fyOf = (isoDate: string) => {
  const [y, m] = isoDate.split('-').map(Number)
  return m >= 4 ? y : y - 1
}
export const fyStart = (fy: number) => iso(fy, 4, 1)
export const fyEnd = (fy: number) => iso(fy + 1, 3, 31)
export const fyLabel = (fy: number) => `FY${String(fy).slice(2)}/${String(fy + 1).slice(2)}`

export const monthEnd = (monthIso: string) => {
  const [y, m] = monthIso.split('-').map(Number)
  return iso(y, m, new Date(y, m, 0).getDate())
}
export const addMonths = (monthIso: string, n: number) => {
  const [y, m] = monthIso.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return iso(d.getFullYear(), d.getMonth() + 1)
}
export const monthLabel = (monthIso: string) => {
  const [y, m] = monthIso.split('-').map(Number)
  return `${MON[m - 1]} ${String(y).slice(2)}`
}
// first day of the last fully finished month
export const lastClosedMonth = () => {
  const t = new Date()
  const d = new Date(t.getFullYear(), t.getMonth() - 1, 1)
  return iso(d.getFullYear(), d.getMonth() + 1)
}
export const monthsBetween = (fromMonth: string, toMonth: string) => {
  const out: string[] = []
  for (let m = fromMonth; m <= toMonth; m = addMonths(m, 1)) out.push(m)
  return out
}

/* ---------- formatting ---------- */
const nz0 = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 })
export const money = (v: number) => (v < 0 ? `(${nz0.format(Math.abs(v))})` : nz0.format(v))
export const moneyD = (v: number) => (v < 0 ? '-$' : '$') + nz0.format(Math.abs(v))
export const compact = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}k`
  return `${s}$${a.toFixed(0)}`
}
export const pct = (v: number | null | undefined, dp = 1) => (v == null || !isFinite(v) ? '–' : `${v.toFixed(dp)}%`)
export const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null)
export const growth = (cur: number, prev: number) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null)

/* ---------- open-month adjustment ----------
 * TradeWindow posts job costs (PROF) when jobs are costed. Supplier invoices that arrive first sit as a
 * DEBIT in Accruals (23000). The growth in that debit is real cost not yet in P&L, so we add it back.
 * kpis must include the month before the first month shown. */
export type AdjMap = Record<string, number>
export function unpostedCosts(kpis: KpiRow[]): AdjMap {
  const sorted = [...kpis].sort((a, b) => a.month.localeCompare(b.month))
  const out: AdjMap = {}
  for (let i = 1; i < sorted.length; i++) {
    const wip = (k: KpiRow) => Math.max(0, -k.accruals)
    const d = wip(sorted[i]) - wip(sorted[i - 1])
    if (Math.abs(d) >= 1000) out[sorted[i].month] = d
  }
  return out
}

export type Totals = { revenue: number; cos: number; gp: number; otherInc: number; opex: number; people: number
  premises: number; ebit: number; net: number; adj: number }
export function totals(kpis: KpiRow[], months: string[], adj: AdjMap, useAdj: boolean): Totals {
  const t: Totals = { revenue: 0, cos: 0, gp: 0, otherInc: 0, opex: 0, people: 0, premises: 0, ebit: 0, net: 0, adj: 0 }
  for (const k of kpis) {
    if (!months.includes(k.month)) continue
    const a = useAdj ? adj[k.month] ?? 0 : 0
    t.revenue += k.revenue; t.cos += k.cost_of_sales + a; t.gp += k.gross_profit - a
    t.otherInc += k.other_op_income; t.opex += k.opex; t.people += k.people; t.premises += k.premises
    t.ebit += k.ebit - a; t.net += k.net_profit - a; t.adj += a
  }
  return t
}

/* ---------- service lines from P&L rows ---------- */
export type ServiceLine = { line: string; revenue: number; cost: number; gp: number; margin: number | null }
export function serviceLines(rows: PlRow[], months?: string[]): ServiceLine[] {
  const m = new Map<string, ServiceLine>()
  for (const r of rows) {
    if (months && !months.includes(r.month)) continue
    if (r.pl_group !== 'Revenue' && r.pl_group !== 'Cost of sales') continue
    const s = m.get(r.pl_line) ?? { line: r.pl_line, revenue: 0, cost: 0, gp: 0, margin: null }
    if (r.pl_group === 'Revenue') s.revenue += r.amount
    else s.cost += -r.amount
    m.set(r.pl_line, s)
  }
  return [...m.values()].map((s) => ({ ...s, gp: s.revenue - s.cost, margin: ratio(s.revenue - s.cost, s.revenue) }))
    .sort((a, b) => b.gp - a.gp)
}
