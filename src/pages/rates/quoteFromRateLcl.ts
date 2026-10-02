import { newQuoteResponseLine, saveQuoteResponseLines, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { createQuote, emptyQuoteDraft } from '../quotes/quotesApi'
import { serviceTypeForIncoterm } from './incotermLegs'
import { createQuoteResponse, updateQuoteResponseHeader } from '../quotes/quoteResponsesApi'
import type { LclRateOption } from './lclRateSearchApi'
import { withExtraLines } from '../quotes/rateOptionCartage'

// ── LCL ──────────────────────────────────────────────────────────────────────

export function buildLclBuyLinesFromOption(o: LclRateOption): QuoteResponseLine[] {
  const cur = o.currency || 'NZD'
  const wm = o.wm > 0 ? o.wm : 1
  const cbm = o.cbm > 0 ? o.cbm : wm
  const lines: QuoteResponseLine[] = []
  let ord = 0

  // Ocean freight — per W/M, floored at the per-B/L minimum via min_buy / min_sell
  const f = newQuoteResponseLine(ord++, cur)
  f.description = 'Ocean freight LCL'
  f.charge_group = 'freight'
  f.vendor = o.coLoaderName
  f.unit = 'Per W/M'
  f.qty = String(wm)
  f.buy_currency = cur; f.sell_currency = cur
  f.buy_rate = String(o.ratePerWm)
  f.sell_rate = String(o.sellPerWm > 0 ? o.sellPerWm : o.ratePerWm)
  if (o.minCharge > 0) f.min_buy = String(o.minCharge)
  const sellMin = o.sellMin > 0 ? o.sellMin : o.minCharge
  if (sellMin > 0) f.min_sell = String(sellMin)
  lines.push(f)

  // Lane charges (BAF/LSS/…) — freight-family, per W/M
  for (const c of o.laneCharges) {
    const l = newQuoteResponseLine(ord++, cur)
    l.description = c.label || c.code || 'Lane charge'
    l.charge_group = 'freight'
    l.vendor = o.coLoaderName
    l.unit = 'Per W/M'
    l.qty = String(wm)
    l.buy_currency = cur; l.sell_currency = cur
    l.buy_rate = String(c.perWm)
    l.sell_rate = String(c.sellPerWm > 0 ? c.sellPerWm : c.perWm)
    if (c.min != null) { l.min_buy = String(c.min); l.min_sell = String(c.min) }
    lines.push(l)
  }

  // rate_surcharges — per_bl / flat / per_cbm / per_wm, each in its own currency
  // (percent & container/TEU bases skipped; contingent ones are never on o.surcharges)
  for (const s of o.surcharges) {
    if (s.basis === 'percent' || s.basis === 'per_container' || s.basis === 'per_teu') continue
    const sc = s.currency || cur
    const l = newQuoteResponseLine(ord++, sc)
    l.description = s.label
    l.charge_group = s.scope === 'origin' ? 'origin' : s.scope === 'dest' ? 'dest' : 'freight'
    l.vendor = o.coLoaderName
    l.buy_currency = sc; l.sell_currency = sc
    l.buy_rate = String(s.amount)
    l.sell_rate = String(s.sellAmount > 0 ? s.sellAmount : s.amount)
    if (s.basis === 'per_cbm') { l.unit = 'Per CBM'; l.qty = String(cbm) }
    else if (s.basis === 'per_wm') { l.unit = 'Per W/M'; l.qty = String(wm) }
    else { l.unit = s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; l.qty = '1' }
    if (s.minAmount != null) { l.min_buy = String(s.minAmount); l.min_sell = String(s.minAmount) }
    lines.push(l)
  }

  // UBF LCL local/port charges — already priced (qty × rate, min applied), pushed as flat lines
  for (const c of o.localCharges ?? []) {
    const l = newQuoteResponseLine(ord++, c.buyCurrency || cur)
    l.description = c.label
    l.charge_group = c.group
    l.vendor = c.vendorName || 'UB Freight'
    l.unit = 'Flat'; l.qty = '1'
    l.buy_currency = c.buyCurrency || cur; l.sell_currency = c.sellCurrency || c.buyCurrency || cur
    l.buy_rate = c.buyAmount === 0 && c.sellAmount > 0 ? '' : String(c.buyAmount)
    l.sell_rate = String(c.sellAmount)
    lines.push(l)
  }
  return lines
}

export async function createQuoteWithLclBuyRates(args: {
  customerAccountId: string
  customerName: string
  fromPortCode: string
  toPortCode: string
  option: LclRateOption
  movement?: string | null
  incoterm?: string | null
  extraLines?: QuoteResponseLine[]  // e.g. chosen cartage
}): Promise<{ quoteId: string }> {
  const draft = {
    ...emptyQuoteDraft(),
    shipment_mode: 'sea',
    shipment_type: 'LCL',
    from_port_code: args.fromPortCode,
    to_port_code: args.toPortCode,
    movement_type: args.movement ?? null,
    incoterms: args.incoterm ?? null,
    service_type: serviceTypeForIncoterm(args.incoterm),
    customer_account_id: args.customerAccountId,
    customer_name: args.customerName,
  }
  const { id: quoteId } = await createQuote(draft)
  // LCL: no container groups
  const { id: responseId } = await createQuoteResponse(quoteId)
  await saveQuoteResponseLines(responseId, withExtraLines(buildLclBuyLinesFromOption(args.option), args.extraLines))
  await updateQuoteResponseHeader(responseId, {
    ...(args.option.currency ? { currency: args.option.currency } : {}),
    carrier: args.option.coLoaderName || null,
    transit_time_days: args.option.transitDays != null ? String(args.option.transitDays) : null,
    via_port: args.option.via || null,
  })
  return { quoteId }
}
