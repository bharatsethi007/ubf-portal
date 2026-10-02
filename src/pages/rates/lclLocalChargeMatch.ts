import { supabase } from '../../supabase'
import type { LclQuoteLane, LclRateOption } from './lclRateSearchApi'

// Sea LCL Local/Port Charges (local_charge_sheets mode='lcl') matched onto LCL options.
// Sheet pick: same direction + port + movement, co-loader-specific beats generic, newest wins.

export type OptionLclLocalCharge = {
  label: string
  group: 'origin' | 'dest'
  basis: string
  qty: number
  buyAmount: number
  buyCurrency: string
  sellAmount: number
  sellCurrency: string
  vendorName: string | null
}

type SheetMeta = { id: string; co_loader_codes: string[]; created_at: string }
type LineRow = {
  sheet_id: string; label: string; charge_code: string | null; basis: string
  buy_amount: number | null; buy_currency: string | null; sell_amount: number | null; sell_currency: string | null
  min_buy: number | null; min_sell: number | null; vendor_name: string | null
}

const today = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown) => (v == null ? null : Number(v))

async function fetchSheets(direction: 'origin' | 'dest', port: string, movement: string | null | undefined): Promise<SheetMeta[]> {
  const t = today()
  let q = supabase
    .from('local_charge_sheets')
    .select('id, co_loader_codes, created_at')
    .eq('mode', 'lcl')
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
    co_loader_codes: Array.isArray(r.co_loader_codes) ? r.co_loader_codes.map(String) : [],
    created_at: String(r.created_at),
  }))
}

function pickSheet(sheets: SheetMeta[], coLoader: string): SheetMeta | null {
  const eligible = sheets.filter((s) => s.co_loader_codes.length === 0 || s.co_loader_codes.includes(coLoader))
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    const d = (b.co_loader_codes.length > 0 ? 1 : 0) - (a.co_loader_codes.length > 0 ? 1 : 0)
    return d !== 0 ? d : (a.created_at < b.created_at ? 1 : -1)
  })
  return eligible[0]
}

function computeLine(l: LineRow, group: 'origin' | 'dest', o: LclRateOption): OptionLclLocalCharge | null {
  const buyAmt = l.buy_amount ?? 0
  const sellRaw = l.sell_amount ?? buyAmt
  const cbm = o.cbm > 0 ? o.cbm : o.wm
  const qty = l.basis === 'per_wm' ? o.wm : l.basis === 'per_cbm' ? cbm : 1
  const side = (amount: number, min: number | null, freight: number) => {
    const base = l.basis === 'percent' ? (amount / 100) * freight : amount * qty
    return min != null ? Math.max(base, min) : base
  }
  const buy = side(buyAmt, l.min_buy, o.freightTotal)
  const sell = side(sellRaw, l.min_sell, o.freightSellTotal)
  if (buy === 0 && sell === 0) return null
  return {
    label: l.label || l.charge_code || 'Local charge',
    group,
    basis: l.basis,
    qty,
    buyAmount: Math.round(buy * 100) / 100,
    buyCurrency: l.buy_currency || l.sell_currency || '',
    sellAmount: Math.round(sell * 100) / 100,
    sellCurrency: l.sell_currency || l.buy_currency || '',
    vendorName: l.vendor_name,
  }
}

export async function attachLclLocalCharges(lane: LclQuoteLane, options: LclRateOption[]): Promise<LclRateOption[]> {
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

  const { data, error } = await supabase
    .from('local_charge_lines')
    .select('sheet_id, label, charge_code, basis, buy_amount, buy_currency, sell_amount, sell_currency, min_buy, min_sell, vendor_name')
    .in('sheet_id', sheetIds)
    .order('ord', { ascending: true })
  if (error) throw error

  const bySheet = new Map<string, LineRow[]>()
  for (const r of ((data as Record<string, any>[]) ?? [])) {
    const id = String(r.sheet_id)
    if (!bySheet.has(id)) bySheet.set(id, [])
    bySheet.get(id)!.push({
      sheet_id: id, label: r.label ? String(r.label) : '', charge_code: r.charge_code ? String(r.charge_code) : null,
      basis: r.basis ? String(r.basis) : 'per_wm',
      buy_amount: num(r.buy_amount), buy_currency: r.buy_currency ? String(r.buy_currency) : null,
      sell_amount: num(r.sell_amount), sell_currency: r.sell_currency ? String(r.sell_currency) : null,
      min_buy: num(r.min_buy), min_sell: num(r.min_sell), vendor_name: r.vendor_name ? String(r.vendor_name) : null,
    })
  }

  for (const o of options) {
    for (const [sheets, group] of [[originSheets, 'origin'], [destSheets, 'dest']] as const) {
      const s = pickSheet(sheets, o.coLoaderCode)
      if (!s) continue
      for (const l of bySheet.get(s.id) ?? []) {
        const c = computeLine(l, group, o)
        if (c) o.localCharges.push(c)
      }
    }
  }
  return options
}
