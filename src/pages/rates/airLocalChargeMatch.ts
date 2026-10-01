import { supabase } from '../../supabase'
import type { AirQuoteLane, AirRateOption } from './airRateSearchApi'
import type { AirCargoClass, AirProduct } from './airConsol'

// A matched + priced origin/destination air local charge attached to an option.
// Amounts are NOT folded into the option headline — FX across currencies is
// applied later in the quote response grid (same convention as FCL local charges).
export type OptionAirLocalCharge = {
  label: string
  group: 'origin' | 'dest'
  basis: string
  cartageType: string | null // null = ordinary charge; 'LTL' | 'FCL' = cartage
  buyAmount: number
  buyCurrency: string
  sellAmount: number
  sellCurrency: string
  vendorName: string | null
  condition?: string | null
}

type SheetMeta = { id: string; airline_codes: string[]; dest_codes: string[]; product: AirProduct; cargo: 'general' | 'dg'; created_at: string }
type LineRow = {
  sheet_id: string
  label: string
  charge_code: string | null
  charge_group: string | null
  basis: string
  percent_base: string
  cartage_type: string | null
  buy_amount: number | null
  buy_currency: string | null
  sell_amount: number | null
  sell_currency: string | null
  min_buy: number | null
  min_sell: number | null
  vendor_name: string | null
  cargo_class: string
  min_kg: number | null
  max_kg: number | null
  contingent: boolean
  condition: string | null
}

const today = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown) => (v == null ? null : Number(v))
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

async function fetchSheets(direction: 'origin' | 'dest', airport: string, movement: string | null | undefined): Promise<SheetMeta[]> {
  const t = today()
  let q = supabase
    .from('air_local_charge_sheets')
    .select('id, airline_codes, dest_airport_codes, air_product, cargo_class, created_at')
    .eq('direction', direction)
    .in('status', ['active', 'validated'])
    .contains('airport_codes', [airport])
    .or(`valid_from.is.null,valid_from.lte.${t}`)
    .or(`valid_to.is.null,valid_to.gte.${t}`)
  if (movement) q = q.eq('movement', movement)
  const { data, error } = await q
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    id: String(r.id),
    airline_codes: strs(r.airline_codes),
    dest_codes: strs(r.dest_airport_codes),
    product: (r.air_product === 'consol' || r.air_product === 'personal_effects') ? r.air_product : 'direct',
    cargo: r.cargo_class === 'dg' ? 'dg' : 'general',
    created_at: String(r.created_at),
  }))
}

// Same product only. DG cargo prefers a DG sheet, else general. Then airline-specific,
// then destination-specific, then newest.
function pickSheet(sheets: SheetMeta[], o: AirRateOption, toCode: string, cargo: AirCargoClass, isOrigin: boolean): SheetMeta | null {
  const eligible = sheets.filter((s) =>
    s.product === o.airProduct
    && (s.airline_codes.length === 0 || s.airline_codes.includes(o.airlineCode))
    && (!isOrigin || s.dest_codes.length === 0 || s.dest_codes.includes(toCode))
    && (s.cargo === 'general' || cargo === 'dg'))
  if (eligible.length === 0) return null
  const rank = (s: SheetMeta) => (cargo === 'dg' && s.cargo === 'dg' ? 4 : 0) + (s.airline_codes.length > 0 ? 2 : 0) + (isOrigin && s.dest_codes.length > 0 ? 1 : 0)
  eligible.sort((a, b) => (rank(b) - rank(a)) || (a.created_at < b.created_at ? 1 : -1))
  return eligible[0]
}

function lineApplies(l: LineRow, cargo: AirCargoClass, kg: number): boolean {
  if (l.cargo_class === 'general' && cargo === 'temp') return false
  if (l.cargo_class === 'temp' && cargo !== 'temp') return false
  if (l.min_kg != null && kg < l.min_kg) return false
  if (l.max_kg != null && kg > l.max_kg) return false
  return true
}

type Ctx = { freightBuy: number; freightSell: number; kg: number; suppliers: number; cartBuy: number; cartSell: number }

function computeLine(l: LineRow, sheetGroup: 'origin' | 'dest', c: Ctx): OptionAirLocalCharge | null {
  const buyAmt = l.buy_amount == null ? 0 : Number(l.buy_amount)
  const sellRaw = l.sell_amount == null ? buyAmt : Number(l.sell_amount)
  const onCartage = l.percent_base === 'cartage'

  const side = (amount: number, min: number | null, freight: number, cart: number) => {
    let base: number
    if (l.basis === 'per_kg') base = amount * c.kg
    else if (l.basis === 'percent') base = (amount / 100) * (onCartage ? cart : freight)
    else if (l.basis === 'per_supplier') base = amount * c.suppliers
    else base = amount // per_awb, per_shipment
    return min != null ? Math.max(base, Number(min)) : base
  }

  const buy = side(buyAmt, l.min_buy, c.freightBuy, c.cartBuy)
  const sell = side(sellRaw, l.min_sell, c.freightSell, c.cartSell)
  if (buy === 0 && sell === 0) return null

  const group = l.charge_group === 'destination' || l.charge_group === 'dest' ? 'dest' : l.charge_group === 'origin' ? 'origin' : sheetGroup
  const basis = l.basis === 'per_supplier' ? `per supplier × ${c.suppliers}` : onCartage ? '% of cartage' : l.basis
  return {
    label: l.label || l.charge_code || 'Local charge',
    group,
    basis,
    cartageType: l.cartage_type || null,
    buyAmount: Math.round(buy * 100) / 100,
    buyCurrency: l.buy_currency || '',
    sellAmount: Math.round(sell * 100) / 100,
    sellCurrency: l.sell_currency || l.buy_currency || '',
    vendorName: l.vendor_name || null,
    condition: l.condition,
  }
}

// Price one sheet: plain lines first, then %-of-cartage lines on the cartage subtotal.
function priceSheet(lines: LineRow[], group: 'origin' | 'dest', o: AirRateOption, lane: AirQuoteLane, cargo: AirCargoClass) {
  const ctx: Ctx = { freightBuy: o.freightTotal, freightSell: o.freightSellTotal, kg: o.chargeableKg, suppliers: Math.max(1, lane.suppliers ?? 1), cartBuy: 0, cartSell: 0 }
  const charges: OptionAirLocalCharge[] = []
  const possible: OptionAirLocalCharge[] = []
  const applicable = lines.filter((l) => lineApplies(l, cargo, o.chargeableKg))
  for (const l of applicable.filter((x) => x.percent_base !== 'cartage')) {
    const c = computeLine(l, group, ctx)
    if (!c) continue
    if (l.contingent) { possible.push(c); continue }
    charges.push(c)
    if (c.cartageType) { ctx.cartBuy += c.buyAmount; ctx.cartSell += c.sellAmount }
  }
  for (const l of applicable.filter((x) => x.percent_base === 'cartage')) {
    const c = computeLine(l, group, ctx)
    if (c) (l.contingent ? possible : charges).push(c)
  }
  return { charges, possible }
}

function toLine(raw: Record<string, any>): LineRow {
  return {
    sheet_id: String(raw.sheet_id),
    label: raw.label ? String(raw.label) : '',
    charge_code: raw.charge_code ? String(raw.charge_code) : null,
    charge_group: raw.charge_group ? String(raw.charge_group) : null,
    basis: raw.basis ? String(raw.basis) : 'per_kg',
    percent_base: raw.percent_base ? String(raw.percent_base) : 'freight',
    cartage_type: raw.cartage_type ? String(raw.cartage_type) : null,
    buy_amount: num(raw.buy_amount),
    buy_currency: raw.buy_currency ? String(raw.buy_currency) : null,
    sell_amount: num(raw.sell_amount),
    sell_currency: raw.sell_currency ? String(raw.sell_currency) : null,
    min_buy: num(raw.min_buy),
    min_sell: num(raw.min_sell),
    vendor_name: raw.vendor_name ? String(raw.vendor_name) : null,
    cargo_class: raw.cargo_class ? String(raw.cargo_class) : 'any',
    min_kg: num(raw.min_kg),
    max_kg: num(raw.max_kg),
    contingent: !!raw.contingent,
    condition: raw.condition ? String(raw.condition) : null,
  }
}

export async function attachAirLocalCharges(lane: AirQuoteLane, options: AirRateOption[]): Promise<AirRateOption[]> {
  for (const o of options) { o.localCharges = []; o.possibleCharges = [] }
  const from = lane.from_port_code
  const to = lane.to_port_code
  if (!from || !to || options.length === 0) return options
  const cargo: AirCargoClass = lane.cargoClass ?? 'general'

  const [originSheets, destSheets] = await Promise.all([
    fetchSheets('origin', from, lane.movement),
    fetchSheets('dest', to, lane.movement),
  ])
  const sheetIds = [...new Set([...originSheets, ...destSheets].map((s) => s.id))]
  if (sheetIds.length === 0) return options

  const { data: lineData, error } = await supabase
    .from('air_local_charge_lines')
    .select('sheet_id, label, charge_code, charge_group, basis, percent_base, cartage_type, buy_amount, buy_currency, sell_amount, sell_currency, min_buy, min_sell, vendor_name, cargo_class, min_kg, max_kg, contingent, condition')
    .in('sheet_id', sheetIds)
    .order('ord', { ascending: true })
  if (error) throw error

  const linesBySheet = new Map<string, LineRow[]>()
  for (const raw of ((lineData as Record<string, any>[]) ?? [])) {
    const l = toLine(raw)
    if (!linesBySheet.has(l.sheet_id)) linesBySheet.set(l.sheet_id, [])
    linesBySheet.get(l.sheet_id)!.push(l)
  }

  for (const o of options) {
    for (const [sheets, group] of [[originSheets, 'origin'], [destSheets, 'dest']] as const) {
      const sheet = pickSheet(sheets, o, to, cargo, group === 'origin')
      if (!sheet) continue
      const { charges, possible } = priceSheet(linesBySheet.get(sheet.id) ?? [], group, o, lane, cargo)
      o.localCharges.push(...charges)
      o.possibleCharges.push(...possible)
    }
  }
  return options
}
