import type { Leaderboard, MixRow } from './leaderboardApi'

// Validated categorical order (dataviz reference palette, light). Fixed order, never cycled.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
export const OTHER = '#a3a39e'
const STATUS: Record<string, string> = { Open: '#2a78d6', Won: '#047857', 'Cross win': '#4a3aa7', Lost: '#b91c1c' }
const MAX_SLICES = 5

export type Slice = { label: string; n: number; pct: number; color: string; won?: number; lost?: number }
export type InsightChart = { key: string; title: string; headline: string; total: number; slices: Slice[]; empty: string }
export type RankRow = { label: string; n: number; won: number }

let names: Intl.DisplayNames | null = null
export function countryName(cc: string): string {
  if (!cc || cc === '??') return 'Unknown'
  try { names ??= new Intl.DisplayNames(['en'], { type: 'region' }); return names.of(cc) ?? cc } catch { return cc }
}

const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0)
const winRate = (r: { won?: number; lost?: number; n: number }) => {
  const decided = (r.won ?? 0) + (r.lost ?? 0)
  return decided ? Math.round(((r.won ?? 0) / decided) * 100) : null
}

/** Top N slices, the rest folded into "Other". Colors follow position in the fixed order. */
function toSlices(rows: MixRow[], colorFor?: (label: string) => string): { slices: Slice[]; total: number } {
  const sorted = [...rows].filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
  const total = sorted.reduce((s, r) => s + r.n, 0)
  const head = sorted.length > MAX_SLICES + 1 ? sorted.slice(0, MAX_SLICES) : sorted
  const rest = sorted.slice(head.length)
  const slices: Slice[] = head.map((r, i) => ({ ...r, pct: pct(r.n, total), color: colorFor?.(r.label) ?? SERIES[i] }))
  if (rest.length) {
    const n = rest.reduce((s, r) => s + r.n, 0)
    const won = rest.reduce((s, r) => s + (r.won ?? 0), 0)
    slices.push({ label: `Other (${rest.length})`, n, won, pct: pct(n, total), color: OTHER })
  }
  return { slices, total }
}

export function buildInsights(lb: Leaderboard): { charts: InsightChart[]; lanes: RankRow[]; takeaways: string[] } {
  const m = lb.mix
  if (!m) return { charts: [], lanes: [], takeaways: [] }
  const t = lb.totals

  const status = toSlices(m.status, (l) => STATUS[l] ?? OTHER)
  const mode = toSlices(m.mode)
  const dir = toSlices(m.direction.map((r) => ({ ...r, label: r.label === 'Unknown' ? 'Not set' : r.label })))
  const staff = toSlices(lb.staff.map((s) => ({ label: s.name, n: s.quotes, won: s.won, lost: s.lost })))
  const dest = toSlices(m.destination.map((r) => ({ ...r, label: countryName(r.label) })))
  const lost = toSlices(m.lost_reason)

  const lead = (x: { slices: Slice[] }) => x.slices[0]
  const charts: InsightChart[] = [
    { key: 'status', title: 'Pipeline status', total: status.total, slices: status.slices, empty: 'No quotes',
      headline: `${t.open} open, ${t.won} won, ${t.lost} lost` },
    { key: 'mode', title: 'Quotes by mode', total: mode.total, slices: mode.slices, empty: 'No quotes',
      headline: lead(mode) ? `${lead(mode).label} leads at ${lead(mode).pct}% of quotes` : '' },
    { key: 'direction', title: 'Import vs export', total: dir.total, slices: dir.slices, empty: 'No quotes',
      headline: lead(dir) ? `${lead(dir).label} is ${lead(dir).pct}% of the mix` : '' },
    { key: 'staff', title: 'Workload by sales support', total: staff.total, slices: staff.slices, empty: 'No quotes',
      headline: lead(staff) ? `${lead(staff).label} handles ${lead(staff).pct}%` : '' },
    { key: 'destination', title: 'Destination countries', total: dest.total, slices: dest.slices, empty: 'No quotes',
      headline: lead(dest) ? `${lead(dest).label} is the top destination (${lead(dest).n})` : '' },
    { key: 'lost', title: 'Why quotes are lost', total: lost.total, slices: lost.slices, empty: 'No lost quotes in this period',
      headline: lead(lost) ? `Top reason: ${lead(lost).label}` : 'Nothing lost yet' },
  ]

  const lanes: RankRow[] = m.lane.map((r) => {
    const [o, d] = r.label.split('>')
    return { label: `${countryName(o)} → ${countryName(d)}`, n: r.n, won: r.won ?? 0 }
  })

  // Plain-English findings a manager would act on.
  const takeaways: string[] = []
  if (t.quotes) takeaways.push(`${t.quotes} quotes for ${t.customers} customers. ${t.open} still open (${pct(t.open, t.quotes)}%).`)
  const decided = t.won + t.lost
  if (decided) takeaways.push(`Win rate ${t.win_rate ?? 0}% on ${decided} decided quotes.`)
  else if (t.quotes) takeaways.push('No quotes decided yet in this period. Win rate will show once customers answer.')
  const modeRates = m.mode.map((r) => ({ label: r.label, rate: winRate(r), n: r.n })).filter((r) => r.rate != null && r.n >= 3)
  if (modeRates.length > 1) {
    const best = modeRates.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a))
    const worst = modeRates.reduce((a, b) => ((b.rate ?? 0) < (a.rate ?? 0) ? b : a))
    // Only worth saying when there is a real gap between modes.
    if ((best.rate ?? 0) - (worst.rate ?? 0) >= 10) takeaways.push(`${best.label} converts best at ${best.rate}% win rate, ${worst.label} lowest at ${worst.rate}%.`)
  }
  if (lead(staff) && staff.slices.length > 1 && lead(staff).pct >= 50) takeaways.push(`${lead(staff).label} carries ${lead(staff).pct}% of the workload. Check the balance.`)
  if (lead(dest)) takeaways.push(`${lead(dest).label} is the busiest destination with ${lead(dest).n} quotes.`)
  if (lead(lost) && lost.total >= 3) takeaways.push(`${lead(lost).pct}% of losses are "${lead(lost).label}".`)
  const unset = m.direction.find((r) => r.label === 'Unknown')
  if (unset && unset.n >= 3) takeaways.push(`${unset.n} quotes have no import/export set.`)
  return { charts, lanes, takeaways }
}

/** SVG arc path for a donut slice. Angles in radians, 0 = 12 o'clock, clockwise. Shared by screen and PDF. */
export function arcPath(cx: number, cy: number, r: number, ri: number, a0: number, a1: number): string {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6
  if (full) a1 = a0 + Math.PI * 2 - 1e-4
  const p = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)].map((v) => v.toFixed(2)).join(' ')
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${p(ri, a0)} Z`
}

/** Slice angles with a small gap between slices (surface gap, per mark spec). */
export function sliceAngles(slices: Slice[], gap = 0.03): { a0: number; a1: number }[] {
  const total = slices.reduce((s, x) => s + x.n, 0) || 1
  const g = slices.length > 1 ? gap : 0
  let a = 0
  return slices.map((s) => {
    const span = (s.n / total) * Math.PI * 2
    const out = { a0: a + g / 2, a1: a + span - g / 2 }
    a += span
    return out
  })
}

export { winRate }
