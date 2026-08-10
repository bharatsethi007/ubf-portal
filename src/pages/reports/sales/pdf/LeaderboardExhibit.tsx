import { Text } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import SectionHeader from './SectionHeader'
import DataTable from './DataTable'
import NewVsExistingBlock from './NewVsExistingBlock'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'
import { num } from './pdfReportHelpers'

type Props = { data: SalesReportData }

function vsPriorNode(gp: number, prev: number | null) {
  if (prev == null || prev === 0) return '—'
  const pct = ((gp - prev) / prev) * 100
  const color = pct >= 0 ? C.pos : C.neg
  const arrow = pct >= 0 ? '▲' : '▼'
  return <Text style={{ color, fontWeight: 600 }}>{arrow} {Math.abs(pct).toFixed(1)}%</Text>
}

function actionTitle(data: SalesReportData): string {
  const assigned = data.leaderboard.filter((r) => !r.is_unassigned)
  const top = [...assigned].sort((a, b) => num(b.gross_profit) - num(a.gross_profit))[0]
  if (!top) return `No assigned rep data for ${data.meta.periodLabel}`
  const name = top.sales_manager?.trim() || '—'
  const margin = top.margin != null ? `${num(top.margin).toFixed(1)}%` : '—'
  return `${name} leads on GP at ${cf.format(num(top.gross_profit))} (${margin} GM)`
}

const COLS = [
  { key: 'rank', label: '#', flex: 0.35 },
  { key: 'name', label: 'Sales manager', flex: 1.5 },
  { key: 'accounts', label: 'Accounts', align: 'right' as const, flex: 0.7 },
  { key: 'jobs', label: 'Jobs', align: 'right' as const, flex: 0.55 },
  { key: 'revenue', label: 'Revenue', align: 'right' as const, flex: 0.85 },
  { key: 'gp', label: 'Gross profit', align: 'right' as const, accent: 'orange' as const, flex: 0.85 },
  { key: 'gm', label: 'GM%', align: 'right' as const, flex: 0.55 },
  { key: 'avg', label: 'Avg GP/job', align: 'right' as const, flex: 0.75 },
  { key: 'vs', label: 'Vs prior', align: 'right' as const, flex: 0.65 },
]

export default function LeaderboardExhibit({ data }: Props) {
  const assigned = data.leaderboard.filter((r) => !r.is_unassigned)
  const unassigned = data.leaderboard.find((r) => r.is_unassigned)

  const rows = assigned.map((row, i) => ({
    rank: String(i + 1),
    name: row.sales_manager?.trim() || '—',
    accounts: nf.format(num(row.accounts)),
    jobs: nf.format(num(row.jobs)),
    revenue: cf.format(num(row.revenue)),
    gp: cf.format(num(row.gross_profit)),
    gm: row.margin != null ? `${num(row.margin).toFixed(1)}%` : '—',
    avg: row.avg_gp_job != null ? cf.format(num(row.avg_gp_job)) : '—',
    vs: vsPriorNode(num(row.gross_profit), row.prev_gross_profit),
  }))

  if (unassigned) {
    rows.push({
      rank: '—',
      name: 'Unassigned',
      accounts: nf.format(num(unassigned.accounts)),
      jobs: nf.format(num(unassigned.jobs)),
      revenue: cf.format(num(unassigned.revenue)),
      gp: cf.format(num(unassigned.gross_profit)),
      gm: unassigned.margin != null ? `${num(unassigned.margin).toFixed(1)}%` : '—',
      avg: unassigned.avg_gp_job != null ? cf.format(num(unassigned.avg_gp_job)) : '—',
      vs: vsPriorNode(num(unassigned.gross_profit), unassigned.prev_gross_profit),
    })
  }

  const totals = {
    rank: '',
    name: 'Total (assigned)',
    accounts: nf.format(assigned.reduce((s, r) => s + num(r.accounts), 0)),
    jobs: nf.format(assigned.reduce((s, r) => s + num(r.jobs), 0)),
    revenue: cf.format(assigned.reduce((s, r) => s + num(r.revenue), 0)),
    gp: cf.format(assigned.reduce((s, r) => s + num(r.gross_profit), 0)),
    gm: '',
    avg: '',
    vs: '',
  }

  return (
    <>
      <SectionHeader n={1} title="Sales leaderboard" />
      <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14 }}>{actionTitle(data)}</Text>
      <DataTable columns={COLS} rows={rows} totals={totals} />
      {data.sections.newVsExisting && data.newVsExisting ? (
        <NewVsExistingBlock rows={data.newVsExisting} />
      ) : null}
      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </>
  )
}
