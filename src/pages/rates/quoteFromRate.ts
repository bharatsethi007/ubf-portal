import { newQuoteResponseLine, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
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
    if (s.basis === 'per_container') { l.unit = 'Per container'; l.qty = String(totalContainers) }
    else if (s.basis === 'per_teu') { l.unit = 'Per TEU'; l.qty = String(totalTeu) }
    else { l.unit = s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; l.qty = '1' }
    lines.push(l)
  }
  return lines
}
