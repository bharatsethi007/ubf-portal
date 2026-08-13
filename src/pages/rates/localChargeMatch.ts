import { supabase } from '../../supabase'
import type { RateOption, QuoteLane } from './rateSearchApi'

// Local copy of the size→canonical map to avoid a runtime import cycle with rateSearchApi.
const SIZE_TO_CANONICAL: Record<string, string> = {
  '20': '20GP', '40': '40GP', '20HC': '20HC', '40HC': '40HQ', '40HQ': '40HQ', '20GP': '20GP', '40GP': '40GP',
}
function norm(size: string): string { return SIZE_TO_CANONICAL[size] ?? size }

export type OptionLocalCharge = {
  label: string
  group: 'origin' | 'dest'
  basis: string
  buyAmount: number
  buyCurrency: string
  sellAmount: number
  sellCurrency: string
  vendorName: string | null
}

type SheetMeta = { id: string; shipping_line_codes: string[]; created_at: string }
type LineRow = {
  sheet_id: string
  label: string
  charge_code: string | null
  container_types: string[]
  basis: string
  buy_amount: number | null
  buy_currency: string | null
  sell_amount: number | null
  sell_currency: string | null
  min_buy: number | null
  min_sell: number | null
  vendor_name: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

async function fetchSheets(direction: 'origin' | 'dest', port: string, movement: string | null | undefined): Promise<SheetMeta[]> {
  const t = today()
  let q = supabase
    .from('local_charge_sheets')
    .select('id, shipping_line_codes, created_at')
    .eq('direction', direction)
    .in('status', ['active', 'validated'])
    .contains('port_codes', [port])
    .or(`valid_from.is.null,valid_from.lte.${t}`)
    .or(`valid_to.is.null,valid_to.gte.${t}`)
  if (movement) q = q.eq('movement', movement)
  const { data, error } = await q
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    id: String(r.id),
    shipping_line_codes: Array.isArray(r.shipping_line_codes) ? r.shipping_line_codes.map(String) : [],
    created_at: String(r.created_at),
  }))
}

// Among sheets eligible for this carrier, prefer a carrier-specific sheet over a
// generic (all-carriers) one, then the most recently created.
function pickSheet(sheets: SheetMeta[], carrier: string): SheetMeta | null {
  const eligible = sheets.filter((s) => s.shipping_line_codes.length === 0 || s.shipping_line_codes.includes(carrier))
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    const aSpec = a.shipping_line_codes.length > 0 ? 1 : 0
    const bSpec = b.shipping_line_codes.length > 0 ? 1 : 0
    if (aSpec !== bSpec) return bSpec - aSpec
    return a.created_at < b.created_at ? 1 : -1
  })
  return eligible[0]
}

function computeLine(
  l: LineRow,
  group: 'origin' | 'dest',
  freightBuy: number,
  freightSell: number,
  qtyByCode: Map<string, number>,
  totalContainers: number,
): OptionLocalCharge | null {
  const buyAmt = l.buy_amount == null ? 0 : Number(l.buy_amount)
  const sellRaw = l.sell_amount == null ? buyAmt : Number(l.sell_amount)
  const applicable = l.container_types && l.container_types.length
    ? l.container_types.reduce((sum, ct) => sum + (qtyByCode.get(norm(ct)) ?? 0), 0)
    : totalContainers

  const side = (amount: number, min: number | null, freight: number) => {
    let base: number
    if (l.basis === 'per_container') base = amount * applicable
    else if (l.basis === 'percent') base = (amount / 100) * freight
    else base = amount // per_bl, per_shipment
    return min != null ? Math.max(base, Number(min)) : base
  }

  const buy = side(buyAmt, l.min_buy, freightBuy)
  const sell = side(sellRaw, l.min_sell, freightSell)
  if (buy === 0 && sell === 0) return null

  return {
    label: l.label || l.charge_code || 'Local charge',
    group,
    basis: l.basis,
    buyAmount: Math.round(buy * 100) / 100,
    buyCurrency: l.buy_currency || '',
    sellAmount: Math.round(sell * 100) / 100,
    sellCurrency: l.sell_currency || l.buy_currency || '',
    vendorName: l.vendor_name || null,
  }
}

// Attaches matched + priced origin/destination local charges to each rate option.
// Mutates and returns the same array. Totals are NOT folded into the option's
// headline total — FX across currencies is applied later in the quote response grid.
export async function attachLocalCharges(lane: QuoteLane, options: RateOption[]): Promise<RateOption[]> {
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
    .from('local_charge_lines')
    .select('sheet_id, label, charge_code, container_types, basis, buy_amount, buy_currency, sell_amount, sell_currency, min_buy, min_sell, vendor_name')
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
      container_types: Array.isArray(raw.container_types) ? raw.container_types.map(String) : [],
      basis: raw.basis ? String(raw.basis) : 'per_container',
      buy_amount: raw.buy_amount == null ? null : Number(raw.buy_amount),
      buy_currency: raw.buy_currency ? String(raw.buy_currency) : null,
      sell_amount: raw.sell_amount == null ? null : Number(raw.sell_amount),
      sell_currency: raw.sell_currency ? String(raw.sell_currency) : null,
      min_buy: raw.min_buy == null ? null : Number(raw.min_buy),
      min_sell: raw.min_sell == null ? null : Number(raw.min_sell),
      vendor_name: raw.vendor_name ? String(raw.vendor_name) : null,
    })
  }

  const qtyByCode = new Map<string, number>()
  let totalContainers = 0
  for (const c of lane.containers) {
    const code = norm(c.size)
    qtyByCode.set(code, (qtyByCode.get(code) ?? 0) + c.qty)
    totalContainers += c.qty
  }

  for (const o of options) {
    const charges: OptionLocalCharge[] = []
    const oSheet = pickSheet(originSheets, o.carrierCode)
    if (oSheet) {
      for (const l of (linesBySheet.get(oSheet.id) ?? [])) {
        const c = computeLine(l, 'origin', o.freightTotal, o.freightSellTotal, qtyByCode, totalContainers)
        if (c) charges.push(c)
      }
    }
    const dSheet = pickSheet(destSheets, o.carrierCode)
    if (dSheet) {
      for (const l of (linesBySheet.get(dSheet.id) ?? [])) {
        const c = computeLine(l, 'dest', o.freightTotal, o.freightSellTotal, qtyByCode, totalContainers)
        if (c) charges.push(c)
      }
    }
    o.localCharges = charges
  }
  return options
}
