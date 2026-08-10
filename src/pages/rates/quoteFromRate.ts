import { newQuoteResponseLine, saveQuoteResponseLines, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { createQuote, emptyQuoteDraft } from '../quotes/quotesApi'
import { emptyContainerGroup, replaceQuoteContainers, type ContainerSize } from '../quotes/quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from '../quotes/quoteResponsesApi'
import { containerTotals, type RateOption } from './rateSearchApi'

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
