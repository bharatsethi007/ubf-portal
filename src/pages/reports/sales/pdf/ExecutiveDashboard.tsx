import { View, Text } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import { cf } from '../../reportsUi'
import HeaderBand from './HeaderBand'
import KpiCard from './KpiCard'
import HBar from './HBar'
import Donut from './Donut'
import { C, pdfStyles, fmtReportDate } from './pdfTheme'
import { buildTakeaways, nveDonutSlices, num, reportTitle } from './pdfReportHelpers'

type Props = { data: SalesReportData }

export default function ExecutiveDashboard({ data }: Props) {
  const { kpis, meta } = data
  const dateStr = fmtReportDate(meta.generatedAt)
  const assigned = data.leaderboard.filter((r) => !r.is_unassigned)
  const top8 = [...assigned].sort((a, b) => num(b.gross_profit) - num(a.gross_profit)).slice(0, 8)
  const maxGp = top8.reduce((m, r) => Math.max(m, num(r.gross_profit)), 0)
  const bullets = buildTakeaways(data.leaderboard)

  const donutSlices = data.modeMix?.length
    ? data.modeMix.map((m) => ({ label: m.label, value: m.jobs, color: m.label === 'Air' ? C.accent : C.navy }))
    : data.newVsExisting?.length
      ? nveDonutSlices(data.newVsExisting)
      : [{ label: 'Jobs', value: assigned.reduce((s, r) => s + num(r.jobs), 0), color: C.navy }]

  return (
    <View>
      <HeaderBand
        title={reportTitle(data)}
        subtitle={`${meta.periodLabel} · to ${dateStr}`}
        compact
      />

      <View style={{ flexDirection: 'row', marginBottom: 18 }}>
        <KpiCard label="Total revenue" value={cf.format(kpis.revenue)} />
        <KpiCard label="Total gross profit" value={cf.format(kpis.grossProfit)} />
        <KpiCard label="Blended margin" value={`${kpis.blendedMargin.toFixed(1)}%`} />
        <KpiCard label="Active reps" value={String(kpis.activeReps)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <View style={{ flex: 1.2 }}>
          <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>Gross profit by rep</Text>
          {top8.map((row) => (
            <HBar
              key={row.sales_manager ?? 'r'}
              label={row.sales_manager?.trim() || '—'}
              value={num(row.gross_profit)}
              max={maxGp}
              display={cf.format(num(row.gross_profit))}
              annotation={row.margin != null ? `${num(row.margin).toFixed(1)}% GM` : undefined}
              labelWidth={88}
            />
          ))}
        </View>
        <View style={{ flex: 0.9 }}>
          <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>
            {data.modeMix?.length ? 'Mode mix (jobs)' : 'GP mix'}
          </Text>
          <Donut slices={donutSlices} size={100} />
        </View>
      </View>

      <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>Key takeaways</Text>
      {bullets.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
          <Text style={{ width: 10, fontSize: 9, color: C.navy }}>•</Text>
          <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.45, color: C.body }}>{b}</Text>
        </View>
      ))}

      <Text style={pdfStyles.footnote}>
        Gross profit on recent jobs firms up as supplier costs post, so current-period margins may read high versus prior periods.
      </Text>
    </View>
  )
}
