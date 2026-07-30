import type { ExchangeRate, FxSyncState } from './fxRatesApi'

export const ACCENT = '#3B5BFE'

export function formatRate(rate: number): string {
  return Number.isFinite(rate) ? rate.toFixed(4) : '—'
}

export function correctedBuy(mid: number, buyCorr: number): number {
  return mid * (1 + buyCorr / 100)
}

export function correctedSell(mid: number, sellCorr: number): number {
  return mid * (1 + sellCorr / 100)
}

export function lastUpdatedLabel(rates: ExchangeRate[], sync: FxSyncState | null): string | null {
  if (rates.length > 0) {
    return rates.reduce((max, r) => (r.as_of > max ? r.as_of : max), rates[0].as_of)
  }
  if (sync?.last_applied_at) {
    return new Date(sync.last_applied_at).toLocaleString()
  }
  return null
}

export function pairKey(base: string, quote: string): string {
  return `${base}/${quote}`
}

export function pairsEqual(a: ExchangeRate[], b: ExchangeRate[]): boolean {
  if (a.length !== b.length) return false
  return a.every((row, i) => (
    row.buy_correction_pct === b[i].buy_correction_pct
    && row.sell_correction_pct === b[i].sell_correction_pct
  ))
}
