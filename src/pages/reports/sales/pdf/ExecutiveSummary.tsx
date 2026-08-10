import { View, Text } from '@react-pdf/renderer'
import type { LeaderboardRow, SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

function vsPriorText(gp: number, prev: number | null): string | null {
  if (prev == null || prev === 0) return null
  const pct = ((gp - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `${arrow} ${Math.abs(pct).toFixed(1)}% vs prior`
}

function execActionTitle(data: SalesReportData): string {
  const { kpis, meta } = data
  return `${cf.format(kpis.revenue)} in revenue and ${cf.format(kpis.grossProfit)} gross profit at ${kpis.blendedMargin.toFixed(1)}% blended margin over ${meta.periodLabel}`
}

function buildBullets(rows: LeaderboardRow[]): string[] {
  const ranked = rows.filter((r) => !r.is_unassigned)
  if (!ranked.length) return ['No assigned sales data for this period.']

  const bullets: string[] = []
  const byGp = [...ranked].sort((a, b) => num(b.gross_profit) - num(a.gross_profit))
  const top = byGp[0]
  const topName = top.sales_manager?.trim() || '—'
  const topMargin = top.margin != null ? `${num(top.margin).toFixed(1)}%` : '—'
  const topVs = vsPriorText(num(top.gross_profit), top.prev_gross_profit)
  bullets.push(
    `${topName} leads on gross profit at ${cf.format(num(top.gross_profit))} (${topMargin} GM)${topVs ? `, ${topVs}` : ''}.`,
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

  const withPrev = ranked.filter((r) => r.prev_gross_profit != null && num(r.prev_gross_profit) > 0)
  if (withPrev.length) {
    const mover = [...withPrev].sort((a, b) => {
      const da = (num(a.gross_profit) - num(a.prev_gross_profit)) / num(a.prev_gross_profit)
      const db = (num(b.gross_profit) - num(b.prev_gross_profit)) / num(b.prev_gross_profit)
      return db - da
    })[0]
    const pct = ((num(mover.gross_profit) - num(mover.prev_gross_profit)) / num(mover.prev_gross_profit)) * 100
    if (pct > 0) {
      bullets.push(`${mover.sales_manager?.trim()} shows the strongest GP growth vs prior (+${pct.toFixed(1)}%).`)
    }
  }

  const totalRev = ranked.reduce((s, r) => s + num(r.revenue), 0)
  if (ranked.length >= 3 && totalRev > 0 && bullets.length < 5) {
    const top3Share = (byGp.slice(0, 3).reduce((s, r) => s + num(r.revenue), 0) / totalRev) * 100
    bullets.push(`Top 3 reps account for ${top3Share.toFixed(0)}% of assigned revenue in this period.`)
  }

  return bullets.slice(0, 5)
}

function KpiCell({ label, value, accent, last }: { label: string; value: string; accent?: string; last?: boolean }) {
  return (
    <View style={{
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRightWidth: last ? 0 : 0.5,
      borderRightColor: C.hair,
      borderRightStyle: 'solid',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 2, height: 10, backgroundColor: accent ?? C.hair }} />
        <Text style={{ fontSize: 8, color: C.muted }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{value}</Text>
    </View>
  )
}

export default function ExecutiveSummary({ data }: Props) {
  const { kpis } = data
  const bullets = buildBullets(data.leaderboard)
  return (
    <View>
      <Text style={pdfStyles.exhibitLabel}>Executive Summary</Text>
      <Text style={pdfStyles.actionTitle}>{execActionTitle(data)}</Text>

      <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: C.hair, borderStyle: 'solid', marginBottom: 32 }}>
        <KpiCell label="Total revenue" value={cf.format(kpis.revenue)} accent={C.navy} />
        <KpiCell label="Total gross profit" value={cf.format(kpis.grossProfit)} accent={C.accent} />
        <KpiCell label="Blended margin" value={`${kpis.blendedMargin.toFixed(1)}%`} accent={C.navy} />
        <KpiCell label="Active reps" value={nf.format(kpis.activeReps)} accent={C.navy} last />
      </View>

      <Text style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
        Key takeaways
      </Text>
      {bullets.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 8, paddingLeft: 2 }}>
          <Text style={{ width: 12, fontSize: 9, color: C.navy }}>•</Text>
          <Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.5, color: C.body }}>{b}</Text>
        </View>
      ))}

      <Text style={pdfStyles.footnote}>
        Gross profit on recent jobs firms up as supplier costs post, so current-period margins may read high versus prior periods.
      </Text>
      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </View>
  )
}
