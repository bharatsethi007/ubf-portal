import type { QuotesMode, StatsPeriod } from '../quotesStatsApi'

export const PERIOD_LABEL: Record<StatsPeriod, string> = {
  week: 'This week', month: 'This month', quarter: 'This quarter', year: 'This year',
}

// 0.4 -> "24m", 5.5 -> "5.5h", 50 -> "2.1d"
export function fmtHrs(h: number | null | undefined): string {
  if (h == null) return '–'
  const v = Number(h)
  if (v < 1) return `${Math.max(1, Math.round(v * 60))}m`
  if (v < 48) return `${v.toFixed(1)}h`
  return `${(v / 24).toFixed(1)}d`
}

export function fmtPct(v: number | null | undefined): string {
  return v == null ? '–' : `${Number(v)}%`
}

export function fmtDay(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function modeLabel(m: QuotesMode): string {
  return m === 'all' ? 'All modes' : m.toUpperCase()
}
