import { fetchEffectiveRates } from '../setup/fxRatesApi'
import type { QuoteResponseLine } from './quoteResponseLinesApi'

const round4 = (n: number) => String(Math.round(n * 10000) / 10000)

/** Fill live ex-rates into lines for a response in `currency` (default NZD). Same rule as the grid. */
export async function withLiveFx(lines: QuoteResponseLine[], currency = 'NZD'): Promise<QuoteResponseLine[]> {
  let rates = new Map<string, { buy: number; sell: number }>()
  try { rates = await fetchEffectiveRates(currency) } catch { /* leave as-is; grid fills on open */ }
  const ex = (cur: string, side: 'buy' | 'sell', cur0: string) => {
    if (!cur || cur === currency) return '1'
    const e = rates.get(cur)
    return e ? round4(side === 'buy' ? e.buy : e.sell) : cur0
  }
  return lines.map((l) => ({ ...l, ex_rate_buy: ex(l.buy_currency, 'buy', l.ex_rate_buy), ex_rate_sell: ex(l.sell_currency, 'sell', l.ex_rate_sell) }))
}
