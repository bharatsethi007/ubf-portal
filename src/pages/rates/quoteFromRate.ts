import { newQuoteResponseLine, saveQuoteResponseLines, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { createQuote, emptyQuoteDraft, updateQuote } from '../quotes/quotesApi'
import { saveQuoteCargo, type QuoteCargoLine } from '../quotes/quoteCargoApi'
import { emptyContainerGroup, replaceQuoteContainers, type ContainerSize } from '../quotes/quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from '../quotes/quoteResponsesApi'
import { containerTotals, normSize, type RateOption } from './rateSearchApi'
import type { LclRateOption } from './lclRateSearchApi'
import type { AirRateOption } from './airRateSearchApi'

export function buildBuyLinesFromOption(o: RateOption, containers: { size: string; qty: number }[]): QuoteResponseLine[] {
  const { qtyByCode } = containerTotals(containers)
  // Only the container codes this card actually prices ('rated'). Per-container /
  // per-TEU charges must not count equipment the card has no freight rate for.
  const ratedCodes = new Set(o.chips.map((c) => c.container_type))
  const ratedContainers = [...qtyByCode.entries()].reduce((n, [code, q]) => n + (ratedCodes.has(code) ? q : 0), 0)
  const ratedTeu = [...qtyByCode.entries()].reduce((n, [code, q]) => n + (ratedCodes.has(code) ? (code.startsWith('40') ? 2 : 1) * q : 0), 0)
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
    const ct = s.container_type ? normSize(s.container_type) : null
    const scopedQty = ct ? (qtyByCode.get(ct) ?? 0) : null
    if (ct && scopedQty === 0) continue // scoped to a container not on this booking
    const l = newQuoteResponseLine(ord++, cur)
    l.description = s.label
    l.charge_group = s.scope === 'origin' ? 'origin' : s.scope === 'dest' ? 'dest' : 'freight'
    l.vendor = o.carrierName
    l.buy_currency = cur; l.sell_currency = cur
    l.buy_rate = String(s.amount)
    l.sell_rate = String(s.sell_amount > 0 ? s.sell_amount : s.amount)
    if (s.basis === 'per_container') { l.unit = 'Per container'; l.qty = String(ct ? scopedQty : ratedContainers) }
    else if (s.basis === 'per_teu') { l.unit = 'Per TEU'; l.qty = String(ct ? (ct.startsWith('40') ? 2 : 1) * (scopedQty ?? 0) : ratedTeu) }
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
  await updateQuoteResponseHeader(responseId, {
    ...(args.option.currency ? { currency: args.option.currency } : {}),
    carrier: args.option.carrierLineName || args.option.carrierName || null,
    transit_time_days: args.option.transitDays != null ? String(args.option.transitDays) : null,
    via_port: args.option.via || null,
  })
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
  await updateQuoteResponseHeader(responseId, {
    ...(args.option.currency ? { currency: args.option.currency } : {}),
    carrier: args.option.coLoaderName || null,
    transit_time_days: args.option.transitDays != null ? String(args.option.transitDays) : null,
    via_port: args.option.via || null,
  })
  return { quoteId }
}

// ── Air ──────────────────────────────────────────────────────────────────────

export function buildAirBuyLinesFromOption(o: AirRateOption, selectedKeys?: string[]): QuoteResponseLine[] {
  const sel = selectedKeys ? new Set(selectedKeys) : null
  const inc = (k: string) => !sel || sel.has(k)
  const cur = o.currency || 'NZD'
  const billedKg = o.billedKg > 0 ? o.billedKg : o.chargeableKg
  const lines: QuoteResponseLine[] = []
  let ord = 0

  if (inc('f:air')) {
    const f = newQuoteResponseLine(ord++, cur)
    f.description = 'Air freight'
    f.charge_group = 'freight'
    f.vendor = o.airlineName
    f.unit = 'Per kg'
    f.qty = String(billedKg)
    f.buy_currency = cur; f.sell_currency = cur
    f.buy_rate = String(o.appliedRatePerKg)
    f.sell_rate = String(o.sellRatePerKg > 0 ? o.sellRatePerKg : o.appliedRatePerKg)
    if (o.minCharge > 0) {
      f.min_buy = String(o.minCharge)   // flat MIN — now correctly a floor on the line total
      const sr = o.sellRatePerKg > 0 ? o.sellRatePerKg : o.appliedRatePerKg
      const sellMin = o.appliedRatePerKg > 0 ? Math.round(o.minCharge * sr / o.appliedRatePerKg * 100) / 100 : o.minCharge
      f.min_sell = String(sellMin)
    }
    lines.push(f)
  }

  o.surcharges.forEach((s, i) => {
    if (!inc(`s:${i}`)) return
    const l = newQuoteResponseLine(ord++, cur)
    l.description = s.label
    l.charge_group = s.scope === 'origin' ? 'origin' : s.scope === 'dest' ? 'dest' : 'freight'
    l.vendor = o.airlineName
    l.buy_currency = cur; l.sell_currency = cur
    if (s.basis === 'per_kg') { l.unit = 'Per kg'; l.qty = String(o.chargeableKg); l.buy_rate = String(s.amount); l.sell_rate = String(s.sellAmount > 0 ? s.sellAmount : s.amount) }
    else if (s.basis === 'per_cbm') { const cbm = o.cbm > 0 ? o.cbm : 1; l.unit = 'Per CBM'; l.qty = String(cbm); l.buy_rate = String(s.amount); l.sell_rate = String(s.sellAmount > 0 ? s.sellAmount : s.amount) }
    else if (s.basis === 'percent') { l.unit = '% of freight'; l.qty = '1'; l.buy_rate = String(Math.round((s.amount / 100) * o.freightTotal * 100) / 100); l.sell_rate = String(Math.round((s.sellAmount / 100) * o.freightSellTotal * 100) / 100) }
    else { l.unit = s.basis === 'per_awb' ? 'Per AWB' : s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; l.qty = '1'; l.buy_rate = String(s.amount); l.sell_rate = String(s.sellAmount > 0 ? s.sellAmount : s.amount) }
    lines.push(l)
  })
  return lines
}

export async function createQuoteWithAirBuyRates(args: {
  customerAccountId: string
  customerName: string
  fromPortCode: string
  toPortCode: string
  incoterm: string | null
  cargoEntryMode: 'total' | 'individual'
  cargoLines: QuoteCargoLine[]
  option: AirRateOption
  selectedKeys?: string[]
}): Promise<{ quoteId: string }> {
  const draft = {
    ...emptyQuoteDraft(),
    shipment_mode: 'air',
    shipment_type: 'Air',
    from_port_code: args.fromPortCode,
    to_port_code: args.toPortCode,
    incoterms: args.incoterm,
    customer_account_id: args.customerAccountId,
    customer_name: args.customerName,
  }
  const { id: quoteId } = await createQuote(draft)
  await updateQuote(quoteId, { cargo_entry_mode: args.cargoEntryMode })
  await saveQuoteCargo(quoteId, args.cargoLines, 'air')
  const { id: responseId } = await createQuoteResponse(quoteId)
  await saveQuoteResponseLines(responseId, buildAirBuyLinesFromOption(args.option, args.selectedKeys))
  await updateQuoteResponseHeader(responseId, {
    ...(args.option.currency ? { currency: args.option.currency } : {}),
    carrier: args.option.airlineName || null,
    transit_time_days: args.option.transitDays != null ? String(args.option.transitDays) : null,
    via_port: args.option.via || null,
  })
  return { quoteId }
}
