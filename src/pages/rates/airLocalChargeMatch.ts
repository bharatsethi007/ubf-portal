import { supabase } from '../../supabase'
import type { AirQuoteLane, AirRateOption } from './airRateSearchApi'

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
}

type SheetMeta = { id: string; airline_codes: string[]; created_at: string }
type LineRow = {
  sheet_id: string
  label: string
  charge_code: string | null
  basis: string
  cartage_type: string | null
  buy_amount: number | null
  buy_currency: string | null
  sell_amount: number | null
  sell_currency: string | null
  min_buy: number | null
  min_sell: number | null
  vendor_name: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

async function fetchSheets(direction: 'origin' | 'dest', airport: string, movement: string | null | undefined): Promise<SheetMeta[]> {
  const t = today()
  let q = supabase
    .from('air_local_charge_sheets')
    .select('id, airline_codes, created_at')
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
    airline_codes: Array.isArray(r.airline_codes) ? r.airline_codes.map(String) : [],
    created_at: String(r.created_at),
  }))
}

// Prefer an airline-specific sheet over a generic (all-airlines) one, then newest.
function pickSheet(sheets: SheetMeta[], airline: string): SheetMeta | null {
  const eligible = sheets.filter((s) => s.airline_codes.length === 0 || s.airline_codes.includes(airline))
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    const aSpec = a.airline_codes.length > 0 ? 1 : 0
    const bSpec = b.airline_codes.length > 0 ? 1 : 0
    if (aSpec !== bSpec) return bSpec - aSpec
    return a.created_at < b.created_at ? 1 : -1
  })
  return eligible[0]
}

function computeLine(l: LineRow, group: 'origin' | 'dest', freightBuy: number, freightSell: number, chargeableKg: number): OptionAirLocalCharge | null {
  const buyAmt = l.buy_amount == null ? 0 : Number(l.buy_amount)
  const sellRaw = l.sell_amount == null ? buyAmt : Number(l.sell_amount)

  const side = (amount: number, min: number | null, freight: number) => {
    let base: number
    if (l.basis === 'per_kg') base = amount * chargeableKg
    else if (l.basis === 'percent') base = (amount / 100) * freight
    else base = amount // per_awb, per_shipment
    return min != null ? Math.max(base, Number(min)) : base
  }

  const buy = side(buyAmt, l.min_buy, freightBuy)
  const sell = side(sellRaw, l.min_sell, freightSell)
  if (buy === 0 && sell === 0) return null

  return {
    label: l.label || l.charge_code || 'Local charge',
    group,
    basis: l.basis,
    cartageType: l.cartage_type || null,
    buyAmount: Math.round(buy * 100) / 100,
    buyCurrency: l.buy_currency || '',
    sellAmount: Math.round(sell * 100) / 100,
    sellCurrency: l.sell_currency || l.buy_currency || '',
    vendorName: l.vendor_name || null,
  }
}

export async function attachAirLocalCharges(lane: AirQuoteLane, options: AirRateOption[]): Promise<AirRateOption[]> {
  for (const o of options) o.localCharges = []
  const from = lane.from_port_code
  const to = lane.to_port_code
  if (!from || !to || options.length === 0) return options

  const [originSheets, destSheets] = await Promise.all([
    fetchSheets('origin', from, lane.movement),
    fetchSheets('dest', to, lane.movement),
  ])
  const sheetIds = [...new Set([...originSheets, ...destSheets].map((s) => s.id))]
  if (sheetIds.length === 0) return options

  const { data: lineData, error } = await supabase
    .from('air_local_charge_lines')
    .select('sheet_id, label, charge_code, basis, cartage_type, buy_amount, buy_currency, sell_amount, sell_currency, min_buy, min_sell, vendor_name')
    .in('sheet_id', sheetIds)
    .order('ord', { ascending: true })
  if (error) throw error

  const linesBySheet = new Map<string, LineRow[]>()
  for (const raw of ((lineData as Record<string, any>[]) ?? [])) {
    const id = String(raw.sheet_id)
    if (!linesBySheet.has(id)) linesBySheet.set(id, [])
    linesBySheet.get(id)!.push({
      sheet_id: id,
      label: raw.label ? String(raw.label) : '',
      charge_code: raw.charge_code ? String(raw.charge_code) : null,
      basis: raw.basis ? String(raw.basis) : 'per_kg',
      cartage_type: raw.cartage_type ? String(raw.cartage_type) : null,
      buy_amount: raw.buy_amount == null ? null : Number(raw.buy_amount),
      buy_currency: raw.buy_currency ? String(raw.buy_currency) : null,
      sell_amount: raw.sell_amount == null ? null : Number(raw.sell_amount),
      sell_currency: raw.sell_currency ? String(raw.sell_currency) : null,
      min_buy: raw.min_buy == null ? null : Number(raw.min_buy),
      min_sell: raw.min_sell == null ? null : Number(raw.min_sell),
      vendor_name: raw.vendor_name ? String(raw.vendor_name) : null,
    })
  }

  for (const o of options) {
    const charges: OptionAirLocalCharge[] = []
    const oSheet = pickSheet(originSheets, o.airlineCode)
    if (oSheet) for (const l of (linesBySheet.get(oSheet.id) ?? [])) {
      const c = computeLine(l, 'origin', o.freightTotal, o.freightSellTotal, o.chargeableKg)
      if (c) charges.push(c)
    }
    const dSheet = pickSheet(destSheets, o.airlineCode)
    if (dSheet) for (const l of (linesBySheet.get(dSheet.id) ?? [])) {
      const c = computeLine(l, 'dest', o.freightTotal, o.freightSellTotal, o.chargeableKg)
      if (c) charges.push(c)
    }
    o.localCharges = charges
  }
  return options
}
