// Currency conversion for rate cards.
// exchange_rates(base='NZD', quote=Q).rate = NZD per 1 unit of Q, so converting an
// amount expressed in Q into NZD is a multiply. useEffectiveRates('NZD') already folds
// the buy/sell correction % into the map values.
export type FxRates = Map<string, { buy: number; sell: number }>

export function toNzd(
  amount: number,
  currency: string | null | undefined,
  rates: FxRates,
  kind: 'buy' | 'sell',
): number | null {
  const cur = (currency || '').toUpperCase()
  if (!cur || cur === 'NZD') return amount
  const r = rates.get(cur)
  if (!r) return null
  return amount * (kind === 'sell' ? r.sell : r.buy)
}

export function fmtMoney(n: number, cur: string): string {
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function fmtNzd(n: number): string {
  return `NZD ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
