import { supabase } from '../../supabase'

export type QuoteResponseLine = {
  id: string
  ord: number
  description: string
  is_service_charge: boolean
  charge_group: string
  vendor: string
  unit: string
  qty: string
  buy_currency: string
  sell_currency: string
  min_buy: string
  min_sell: string
  buy_rate: string
  sell_rate: string
  tax: string
  ex_rate_buy: string
  ex_rate_sell: string
}

export function newQuoteResponseLine(ord = 0, currency = 'NZD'): QuoteResponseLine {
  return {
    id: crypto.randomUUID(),
    ord,
    description: '',
    is_service_charge: false,
    charge_group: 'freight',
    vendor: '',
    unit: '',
    qty: '1',
    buy_currency: currency,
    sell_currency: currency,
    min_buy: '',
    min_sell: '',
    buy_rate: '',
    sell_rate: '',
    tax: 'no_tax',
    ex_rate_buy: '1',
    ex_rate_sell: '1',
  }
}

function numStr(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}

function parseNumField(s: string): number | null {
  return Number(s) || null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mapRow(row: Record<string, unknown>): QuoteResponseLine {
  return {
    id: String(row.id),
    ord: Number(row.ord) || 0,
    description: (row.description as string | null) ?? '',
    is_service_charge: Boolean(row.is_service_charge),
    charge_group: (row.charge_group as string | null) || 'freight',
    vendor: (row.vendor as string | null) ?? '',
    unit: (row.unit as string | null) ?? '',
    qty: numStr(row.qty),
    buy_currency: (row.buy_currency as string | null) || 'NZD',
    sell_currency: (row.sell_currency as string | null) || 'NZD',
    min_buy: numStr(row.min_buy),
    min_sell: numStr(row.min_sell),
    buy_rate: numStr(row.buy_rate),
    sell_rate: numStr(row.sell_rate),
    tax: (row.tax as string | null) ?? '',
    ex_rate_buy: numStr(row.ex_rate_buy) || '1',
    ex_rate_sell: numStr(row.ex_rate_sell) || '1',
  }
}

function isEmptyLine(line: QuoteResponseLine): boolean {
  const nums = [line.qty, line.min_buy, line.min_sell, line.buy_rate, line.sell_rate]
  return !line.description.trim() && !line.buy_rate.trim() && !line.sell_rate.trim()
    && nums.every((n) => !n.trim() || n.trim() === '1')
}

// Per-line computation, all converted into the response's final currency.
export function computeResponseLine(line: QuoteResponseLine): {
  effectiveBuy: number
  effectiveSell: number
  totalBuy: number
  totalSell: number
} {
  const qty = Number(line.qty) || 0
  const buy = Number(line.buy_rate) || 0
  const sell = Number(line.sell_rate) || 0
  const minBuy = line.min_buy.trim() ? Number(line.min_buy) : null
  const minSell = line.min_sell.trim() ? Number(line.min_sell) : null
  const exBuy = Number(line.ex_rate_buy) || 1
  const exSell = Number(line.ex_rate_sell) || 1

  const effectiveBuy = minBuy != null && buy < minBuy ? minBuy : buy
  const effectiveSell = minSell != null && sell < minSell ? minSell : sell

  return {
    effectiveBuy,
    effectiveSell,
    totalBuy: round2(qty * effectiveBuy * exBuy),
    totalSell: round2(qty * effectiveSell * exSell),
  }
}

export type ResponseTotals = {
  subTotal: number
  totalTax: number
  totalSell: number
  totalBuy: number
  netProfit: number
  marginPct: number
}

// taxRateByCode maps a tax code (e.g. 'gst_15') to its percentage (e.g. 15).
export function computeResponseTotals(
  lines: QuoteResponseLine[],
  taxRateByCode: Record<string, number> = {},
): ResponseTotals {
  let subTotal = 0
  let totalBuy = 0
  let totalTax = 0
  for (const line of lines) {
    const c = computeResponseLine(line)
    subTotal += c.totalSell
    totalBuy += c.totalBuy
    const rate = line.tax ? taxRateByCode[line.tax] ?? 0 : 0
    totalTax += c.totalSell * (rate / 100)
  }
  subTotal = round2(subTotal)
  totalBuy = round2(totalBuy)
  totalTax = round2(totalTax)
  const netProfit = round2(subTotal - totalBuy)
  const marginPct = subTotal > 0 ? round2((netProfit / subTotal) * 100) : 0
  return { subTotal, totalTax, totalSell: subTotal, totalBuy, netProfit, marginPct }
}

export async function fetchQuoteResponseLines(responseId: string): Promise<QuoteResponseLine[]> {
  const { data, error } = await supabase
    .from('quote_response_lines')
    .select('*')
    .eq('response_id', responseId)
    .order('ord')
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function saveQuoteResponseLines(
  responseId: string,
  lines: QuoteResponseLine[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('quote_response_lines')
    .delete()
    .eq('response_id', responseId)
  if (delErr) throw delErr

  const rows = lines
    .filter((line) => !isEmptyLine(line))
    .map((line, index) => {
      const c = computeResponseLine(line)
      return {
        id: line.id,
        response_id: responseId,
        ord: index,
        description: line.description.trim() || null,
        is_service_charge: line.is_service_charge,
        charge_group: line.charge_group || 'freight',
        vendor: line.vendor.trim() || null,
        unit: line.unit.trim() || null,
        qty: parseNumField(line.qty),
        buy_currency: line.buy_currency.trim() || null,
        sell_currency: line.sell_currency.trim() || null,
        min_buy: parseNumField(line.min_buy),
        min_sell: parseNumField(line.min_sell),
        buy_rate: parseNumField(line.buy_rate),
        sell_rate: parseNumField(line.sell_rate),
        tax: line.tax.trim() || null,
        ex_rate_buy: parseNumField(line.ex_rate_buy) ?? 1,
        ex_rate_sell: parseNumField(line.ex_rate_sell) ?? 1,
        total_buy: c.totalBuy,
        total_sell: c.totalSell,
      }
    })

  if (!rows.length) return
  const { error: insErr } = await supabase.from('quote_response_lines').insert(rows)
  if (insErr) throw insErr
}

export async function updateResponseTotals(
  responseId: string,
  totals: ResponseTotals,
): Promise<void> {
  const { error } = await supabase
    .from('quote_responses')
    .update({
      sub_total: totals.subTotal,
      total_sell: totals.totalSell,
      total_tax: totals.totalTax,
      total_buy: totals.totalBuy,
      net_profit: totals.netProfit,
      margin_pct: totals.marginPct,
    })
    .eq('id', responseId)
  if (error) throw error
}
