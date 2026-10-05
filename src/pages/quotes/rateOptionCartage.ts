import { newQuoteResponseLine, type QuoteResponseLine } from './quoteResponseLinesApi'

/** Cartage line shown on rate option cards (built in NewQuoteSearch, rendered in rate cards). */
export type RateOptionCartage = {
  leg: 'origin' | 'dest'
  label: string
  amount: number          // sell (courier charge or UBF rate)
  cost?: number           // buy, when the courier returns cost separately
  confidence?: string
  status: string
  source?: 'ubf' | 'gss' | 'bascik'
  carrier?: string
  carrierShort?: string
  carrierLogo?: string
  canChange?: boolean
  onChange?: () => void
}

/** The chosen cartage as a quote response line (NZD, flat), appended when a rate is used. */
export function cartageResponseLines(c: RateOptionCartage | null | undefined): QuoteResponseLine[] {
  if (!c || c.status !== 'ok' || !(c.amount > 0)) return []
  const l = newQuoteResponseLine(0, 'NZD')
  const who = c.carrierShort || (c.source === 'ubf' ? 'UBF' : c.carrier) || ''
  l.description = who && !c.label.includes(who) ? `${c.label} · ${who}` : c.label
  l.charge_group = c.leg === 'dest' ? 'destination' : 'origin' // charge_groups codes
  l.vendor = c.source === 'ubf' ? 'UB Freight' : (c.carrier || who)
  l.unit = 'Flat'
  l.qty = '1'
  l.buy_currency = 'NZD'; l.sell_currency = 'NZD'
  l.buy_rate = String(c.cost != null && c.cost > 0 ? c.cost : c.amount)
  l.sell_rate = String(c.amount)
  return [l]
}

/** Append extra lines after the rate lines, keeping ord sequential. */
export function withExtraLines(lines: QuoteResponseLine[], extra?: QuoteResponseLine[]): QuoteResponseLine[] {
  if (!extra || extra.length === 0) return lines
  return [...lines, ...extra.map((l, i) => ({ ...l, ord: lines.length + i }))]
}
