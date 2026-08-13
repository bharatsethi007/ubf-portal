import { newQuoteResponseLine, saveQuoteResponseLines, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { createQuote, emptyQuoteDraft } from '../quotes/quotesApi'
import { emptyContainerGroup, replaceQuoteContainers, type ContainerSize } from '../quotes/quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from '../quotes/quoteResponsesApi'
import { containerTotals, type RateOption } from './rateSearchApi'
import type { LclRateOption } from './lclRateSearchApi'

export function buildBuyLinesFromOption(o: RateOption, containers: { size: string; qty: number }[]): QuoteResponseLine[] {
  const { qtyByCode, totalContainers, totalTeu } = containerTotals(containers)
  const cur = o.currency || 'NZD'
  const lines: QuoteResponseLine[] = []
  let ord = 0
  for (const chip of o.chips) {
    const l = newQuoteResponseLine(ord++, cur)
    l.description = `Ocean freight ${chip.container_type}`
    l.charge_group = 'freight'
    l.vendor = o.carrierName
    l.unit = 'Per container'
    l.qty = String(qtyByCode.get(chip.container_type) ?? 1)
    l.buy_currency = cur; l.sell_currency = cur
    l.buy_rate = String(chip.base_rate)
    l.sell_rate = String(chip.sell_rate > 0 ? chip.sell_rate : chip.base_rate)
    lines.push(l)
  }
  for (const s of o.surcharges) {
    if (s.basis === 'per_cbm' || s.basis === 'percent') continue
    const l = newQuoteResponseLine(ord++, cur)
    l.description = s.label
    l.charge_group = s.scope === 'origin' ? 'origin' : s.scope === 'dest' ? 'dest' : 'freight'
    l.vendor = o.carrierName
    l.buy_currency = cur; l.sell_currency = cur
    l.buy_rate = String(s.amount)
    l.sell_rate = String(s.sell_amount > 0 ? s.sell_amount : s.amount)
    if (s.basis === 'per_container') { l.unit = 'Per container'; l.qty = String(totalContainers) }
    else if (s.basis === 'per_teu') { l.unit = 'Per TEU'; l.qty = String(totalTeu) }
    else { l.unit = s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; l.qty = '1' }
    lines.push(l)
  }
  for (const lc of o.localCharges) {
    const l = newQuoteResponseLine(ord++, lc.buyCurrency || cur)
    l.description = lc.label
    l.charge_group = lc.group
    l.vendor = lc.vendorName || o.carrierName
    l.unit = 'Flat'
    l.qty = '1'
    l.buy_currency = lc.buyCurrency || cur
    l.sell_currency = lc.sellCurrency || lc.buyCurrency || cur
    l.buy_rate = String(lc.buyAmount)
    l.sell_rate = String(lc.sellAmount)
    lines.push(l)
  }
  return lines
}

export async function createQuoteWithBuyRates(args: {
  customerAccountId: string
  customerName: string
  fromPortCode: string
  toPortCode: string
  containers: { size: string; qty: number }[]
  option: RateOption
}): Promise<{ quoteId: string }> {
  const draft = {
    ...emptyQuoteDraft(),
    from_port_code: args.fromPortCode,
    to_port_code: args.toPortCode,
    customer_account_id: args.customerAccountId,
    customer_name: args.customerName,
  }
  const { id: quoteId } = await createQuote(draft)
  const groups = args.containers.map((c, i) => ({
    ...emptyContainerGroup(i),
    container_size: c.size as ContainerSize,
    qty: c.qty,
  }))
  await replaceQuoteContainers(quoteId, groups)
  const { id: responseId } = await createQuoteResponse(quoteId)
  await saveQuoteResponseLines(responseId, buildBuyLinesFromOption(args.option, args.containers))
  if (args.option.currency) await updateQuoteResponseHeader(responseId, { currency: args.option.currency })
  return { quoteId }
}

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
    lines.push(l)
  }

  // rate_surcharges — per_bl / flat / per_cbm (percent & container/TEU bases skipped)
  for (const s of o.surcharges) {
    if (s.basis === 'percent' || s.basis === 'per_container' || s.basis === 'per_teu') continue
    const l = newQuoteResponseLine(ord++, cur)
    l.description = s.label
    l.charge_group = s.scope === 'origin' ? 'origin' : s.scope === 'dest' ? 'dest' : 'freight'
    l.vendor = o.coLoaderName
    l.buy_currency = cur; l.sell_currency = cur
    l.buy_rate = String(s.amount)
    l.sell_rate = String(s.sellAmount > 0 ? s.sellAmount : s.amount)
    if (s.basis === 'per_cbm') { l.unit = 'Per CBM'; l.qty = String(cbm) }
    else { l.unit = s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; l.qty = '1' }
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
}): Promise<{ quoteId: string }> {
  const draft = {
    ...emptyQuoteDraft(),
    shipment_mode: 'sea',
    shipment_type: 'LCL',
    from_port_code: args.fromPortCode,
    to_port_code: args.toPortCode,
    customer_account_id: args.customerAccountId,
    customer_name: args.customerName,
  }
  const { id: quoteId } = await createQuote(draft)
  // LCL: no container groups
  const { id: responseId } = await createQuoteResponse(quoteId)
  await saveQuoteResponseLines(responseId, buildLclBuyLinesFromOption(args.option))
  if (args.option.currency) await updateQuoteResponseHeader(responseId, { currency: args.option.currency })
  return { quoteId }
}
