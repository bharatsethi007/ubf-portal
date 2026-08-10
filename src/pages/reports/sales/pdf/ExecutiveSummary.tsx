import { View, Text } from '@react-pdf/renderer'
import type { LeaderboardRow, SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import { C, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

function vsPriorText(gp: number, prev: number | null): string | null {
  if (prev == null || prev === 0) return null
  const pct = ((gp - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `${arrow} ${Math.abs(pct).toFixed(1)}% vs prior`
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

  if (ranked.length >= 2 && bullets.length < 5) {
    const active = ranked.filter((r) => num(r.jobs) > 0).length
    bullets.push(`${active} of ${ranked.length} assigned reps recorded at least one job in the period.`)
  }

  return bullets.slice(0, 5)
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: C.hair, borderRightStyle: 'solid' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <View style={{ width: 2, height: 10, backgroundColor: accent ?? C.hair, borderRadius: 1 }} />
        <Text style={{ fontSize: 8, color: C.muted }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{value}</Text>
    </View>
  )
}

export default function ExecutiveSummary({ data }: Props) {
  const { kpis } = data
  const bullets = buildBullets(data.leaderboard)
  return (
    <View>
      <Text style={pdfStyles.kicker}>Executive summary</Text>
      <Text style={pdfStyles.actionTitle}>Period performance at a glance</Text>

      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.hair, borderStyle: 'solid', borderRadius: 4, marginBottom: 22, overflow: 'hidden' }}>
        <KpiCell label="Total revenue" value={cf.format(kpis.revenue)} accent={C.navy} />
        <KpiCell label="Total gross profit" value={cf.format(kpis.grossProfit)} accent={C.accent} />
        <KpiCell label="Blended margin" value={`${kpis.blendedMargin.toFixed(1)}%`} />
        <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={{ width: 2, height: 10, backgroundColor: C.navy, borderRadius: 1 }} />
            <Text style={{ fontSize: 8, color: C.muted }}>Active reps</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{nf.format(kpis.activeReps)}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 9, fontWeight: 600, color: C.navy, marginBottom: 8 }}>Key takeaways</Text>
      {bullets.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 6, paddingLeft: 2 }}>
          <Text style={{ width: 12, fontSize: 9, color: C.accent }}>•</Text>
          <Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.45, color: C.body }}>{b}</Text>
        </View>
      ))}

      <Text style={{ ...pdfStyles.source, marginTop: 18 }}>
        Gross profit on recent jobs firms up as supplier costs post, so current-period margins may read high versus prior periods.
      </Text>
    </View>
  )
}
