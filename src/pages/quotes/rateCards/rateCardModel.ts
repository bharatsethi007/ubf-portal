// Customer rate cards: types and pure math. No supabase import (PDF code uses this).

export type Product = 'FCL' | 'LCL' | 'AIR'
export type MarginMethod = 'rule' | 'pct' | 'flat' | 'sell'
export type CardStatus = 'draft' | 'pending' | 'changes' | 'live' | 'superseded' | 'void'

export type RateCard = {
  id: string; ref: string; version: number; parent_id: string | null; account_id: string; customer: string
  title: string; status: CardStatus; valid_from: string; valid_to: string
  presentation: 'freight' | 'all_in' | 'breakdown' | 'both'; fx: Record<string, number>
  sales_id: string | null; pricing_id: string | null
  included: string | null; excluded: string | null; terms: string | null
  approver_note: string | null; submitted_at: string | null; approved_at: string | null; approved_by: string | null
  approval_comment: string | null; published_at: string | null; created_at: string; updated_at: string
}

export type Line = {
  id?: string; card_id?: string; sort: number; product: Product
  origin_code: string; dest_code: string; container_type: string | null; carrier: string | null
  transit_days: number | null; via: string | null; frequency: string | null
  source_table: 'fcl' | 'lcl' | 'air' | null; source_line_id: string | null; source_card_id: string | null
  buy: number | null; buy_currency: string | null
  margin_method: MarginMethod; margin_value: number | null
  freight_sell: number | null; sell_min: number | null; sell_currency: string
  origin_sell: number | null; origin_currency: string | null
  dest_sell: number | null; dest_currency: string | null
  show: boolean; notes: string | null; rule_id?: string | null
}

export type Rule = { method: 'pct' | 'flat' | 'fixed'; value: number; min_margin: number | null }

export const GP_FLOOR = 10
export const PRODUCTS: Product[] = ['FCL', 'LCL', 'AIR']
export const UNIT: Record<Product, string> = { FCL: 'per container', LCL: 'per w/m', AIR: 'per kg' }
export const CONTAINERS = ['20GP', '40GP', '40HC', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR']

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Waiting approval', changes: 'Changes asked', live: 'Live', scheduled: 'Starts soon',
  expiring: 'Expiring', expired: 'Expired', superseded: 'Replaced', void: 'Withdrawn',
}
export const STATUS_STYLE: Record<string, [string, string]> = {
  draft: ['#F1F3F7', '#475467'], pending: ['#FFFAEB', '#B54708'], changes: ['#EFF4FF', '#1D4ED8'],
  live: ['#ECFDF3', '#067647'], scheduled: ['#ECFDF3', '#067647'], expiring: ['#FFF6ED', '#C4320A'],
  expired: ['#FEF3F2', '#B42318'], superseded: ['#F1F3F7', '#475467'], void: ['#F1F3F7', '#475467'],
}

export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)
}

/** Display state: live cards split by dates. */
export function viewStatus(c: Pick<RateCard, 'status' | 'valid_from' | 'valid_to'>): string {
  if (c.status !== 'live') return c.status
  const t = todayIso()
  if (c.valid_to < t) return 'expired'
  if (c.valid_from > t) return 'scheduled'
  return daysBetween(t, c.valid_to) <= 30 ? 'expiring' : 'live'
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Freight sell for a line from its margin method. Rule = customer's product rule. */
export function computeSell(l: Pick<Line, 'buy' | 'margin_method' | 'margin_value' | 'freight_sell'>, rule: Rule | null): number | null {
  if (l.margin_method === 'sell') return l.freight_sell
  if (l.buy == null) return l.freight_sell
  const b = Number(l.buy)
  if (l.margin_method === 'pct') return l.margin_value == null ? null : r2(b * (1 + Number(l.margin_value) / 100))
  if (l.margin_method === 'flat') return l.margin_value == null ? null : r2(b + Number(l.margin_value))
  if (!rule || rule.method === 'fixed') return null
  const min = Number(rule.min_margin ?? 0)
  return rule.method === 'pct' ? r2(Math.max(b * (1 + rule.value / 100), b + min)) : r2(Math.max(b + rule.value, b + min))
}

export function lineGp(l: Pick<Line, 'buy' | 'freight_sell'>): number | null {
  if (l.buy == null || !l.freight_sell) return null
  return Math.round(((l.freight_sell - l.buy) / l.freight_sell) * 1000) / 10
}

/** Amount in `cur` converted to the line's sell currency using card fx. */
export function toSell(amount: number | null, cur: string | null, sellCur: string, fx: Record<string, number>): number | null {
  if (amount == null) return null
  if (!cur || cur === sellCur) return amount
  const rate = fx[cur]
  return rate ? amount * rate : null
}

export function allIn(l: Line, fx: Record<string, number>): number | null {
  if (l.freight_sell == null) return null
  const o = toSell(l.origin_sell, l.origin_currency, l.sell_currency, fx)
  const d = toSell(l.dest_sell, l.dest_currency, l.sell_currency, fx)
  if ((l.origin_sell != null && o == null) || (l.dest_sell != null && d == null)) return null
  return r2(Number(l.freight_sell) + (o ?? 0) + (d ?? 0))
}

export function money(n: number | null | undefined, cur?: string | null, dp?: number): string {
  if (n == null || Number.isNaN(Number(n))) return '–'
  const v = Number(n)
  const digits = dp ?? (Math.abs(v) < 20 && v % 1 !== 0 ? 2 : 0)
  const s = v.toLocaleString('en-NZ', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return cur ? `${cur} ${s}` : s
}

export function fmtDate(iso: string | null | undefined, long = false): string {
  if (!iso) return '–'
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
}

export const laneKey = (l: Pick<Line, 'product' | 'origin_code' | 'dest_code' | 'container_type'>) =>
  `${l.product}|${l.origin_code}|${l.dest_code}|${l.container_type ?? ''}`

export const DEFAULT_TERMS = {
  included: 'Ocean or air freight, origin terminal handling, documentation, NZ port and terminal charges, customs clearance up to 5 tariff lines, delivery to Auckland metro.',
  excluded: 'Duty, GST and government levies. MPI and customs inspections if required. Demurrage, detention and storage. Hazardous, oversize or overweight cargo. Carrier surcharges announced after the issue date.',
  terms: 'Rates apply to cargo ready for shipment within the validity dates. Subject to space and equipment at booking. Payment per your account terms. All business under UB Freight standard trading terms, available on request.',
}
