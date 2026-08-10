import type { LeaderboardRow, SalesReportData } from '../salesExportApi'
import type { NewVsExistingRow } from '../../salesAnalyticsNewVsExisting'
import { cf } from '../../reportsUi'

export const num = (v: unknown) => Number(v || 0)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthShort(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} '${y.slice(2)}`
}

export function reportTitle(data: SalesReportData): string {
  return data.meta.scopedRep
    ? `${data.meta.scopedRep} — Sales Review`
    : 'Sales Performance Review'
}

export function vsPriorText(gp: number, prev: number | null): string | null {
  if (prev == null || prev === 0) return null
  const pct = ((gp - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`
}

export function buildTakeaways(rows: LeaderboardRow[]): string[] {
  const ranked = rows.filter((r) => !r.is_unassigned)
  if (!ranked.length) return ['No assigned sales data for this period.']

  const bullets: string[] = []
  const byGp = [...ranked].sort((a, b) => num(b.gross_profit) - num(a.gross_profit))
  const top = byGp[0]
  const topName = top.sales_manager?.trim() || '—'
  const topMargin = top.margin != null ? `${num(top.margin).toFixed(1)}%` : '—'
  const topVs = vsPriorText(num(top.gross_profit), top.prev_gross_profit)
  bullets.push(
    `${topName} leads on gross profit at ${cf.format(num(top.gross_profit))} (${topMargin} GM)${topVs ? `, ${topVs} vs prior` : ''}.`,
  )

  const withMargin = ranked.filter((r) => r.margin != null && num(r.revenue) > 0)
  if (withMargin.length) {
    const bestGm = [...withMargin].sort((a, b) => num(b.margin) - num(a.margin))[0]
    if (bestGm.sales_manager?.trim() !== top.sales_manager?.trim()) {
      bullets.push(
        `${bestGm.sales_manager?.trim()} delivers the highest GM at ${num(bestGm.margin).toFixed(1)}% on ${cf.format(num(bestGm.revenue))} revenue.`,
      )
    }
  }

  const totalRev = ranked.reduce((s, r) => s + num(r.revenue), 0)
  if (ranked.length >= 3 && totalRev > 0 && bullets.length < 5) {
    const top3Share = (byGp.slice(0, 3).reduce((s, r) => s + num(r.revenue), 0) / totalRev) * 100
    bullets.push(`Top 3 reps account for ${top3Share.toFixed(0)}% of assigned revenue in this period.`)
  }

  return bullets.slice(0, 5)
}

export function nveDonutSlices(rows: NewVsExistingRow[]) {
  const assigned = rows.filter((r) => !r.is_unassigned)
  const newGp = assigned.reduce((s, r) => s + num(r.new_gp), 0)
  const existGp = assigned.reduce((s, r) => s + num(r.existing_gp), 0)
  return [
    { label: 'New GP', value: newGp, color: '#F7941D' },
    { label: 'Existing GP', value: existGp, color: '#0A2472' },
  ].filter((s) => s.value > 0)
}

export function dashboardInsight(data: SalesReportData): string {
  const { kpis, meta } = data
  const scope = meta.scopedRep ? `${meta.scopedRep} · ` : ''
  return `${scope}${cf.format(kpis.revenue)} revenue, ${cf.format(kpis.grossProfit)} gross profit at ${kpis.blendedMargin.toFixed(1)}% margin (${meta.periodLabel})`
}
