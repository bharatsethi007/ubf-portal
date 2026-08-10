import { Text, View } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import { nf } from '../../reportsUi'
import SectionHeader from './SectionHeader'
import DataTable from './DataTable'
import ColumnChart from './ColumnChart'
import Donut from './Donut'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'
import { monthShort, num } from './pdfReportHelpers'

type Props = { data: SalesReportData }

function actionTitle(data: SalesReportData): string {
  const lanes = data.lanes ?? []
  const totalJobs = lanes.reduce((s, l) => s + num(l.jobs), 0)
  const top = lanes[0]
  if (!top) return 'No trade lane volume for this period'
  return `${top.origin} → ${top.destination} leads with ${nf.format(num(top.jobs))} jobs (${((num(top.jobs) / totalJobs) * 100).toFixed(0)}% of top lanes)`
}

const COLS = [
  { key: 'route', label: 'Origin → dest', flex: 1.4 },
  { key: 'dir', label: 'Direction', flex: 0.7 },
  { key: 'mode', label: 'Mode', flex: 0.5 },
  { key: 'jobs', label: 'Jobs', align: 'right' as const, flex: 0.55 },
  { key: 'teu', label: 'TEU', align: 'right' as const, flex: 0.5 },
  { key: 'cbm', label: 'CBM', align: 'right' as const, flex: 0.55 },
]

export default function TradeLanesExhibit({ data }: Props) {
  const lanes = data.lanes ?? []
  const trend = data.volumeTrend ?? []
  const modeMix = data.modeMix ?? []

  const chartPoints = trend.map((p) => ({ label: monthShort(p.month), value: p.jobs }))
  const donutSlices = modeMix.map((m) => ({
    label: m.label,
    value: m.jobs,
    color: m.label === 'Air' ? C.accent : C.navy,
  }))

  const rows = lanes.map((l) => ({
    route: `${l.origin} → ${l.destination}`,
    dir: l.direction ? l.direction.charAt(0).toUpperCase() + l.direction.slice(1) : '—',
    mode: l.mode ? l.mode.charAt(0).toUpperCase() + l.mode.slice(1) : '—',
    jobs: nf.format(num(l.jobs)),
    teu: nf.format(num(l.teu)),
    cbm: nf.format(Math.round(num(l.cbm))),
  }))

  return (
    <>
      <SectionHeader n={3} title="Trade lanes & volume" />
      <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14 }}>{actionTitle(data)}</Text>

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>Jobs by month</Text>
          <ColumnChart points={chartPoints} height={80} highlightLast />
        </View>
        <View style={{ flex: 0.85 }}>
          <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>Mode mix (jobs)</Text>
          <Donut slices={donutSlices.length ? donutSlices : [{ label: 'None', value: 1, color: C.hair }]} size={90} />
        </View>
      </View>

      <Text style={{ fontSize: 8, color: C.muted, marginBottom: 8 }}>
        Volume view — lane-level revenue is not available.
      </Text>

      <DataTable columns={COLS} rows={rows} />
      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </>
  )
}
