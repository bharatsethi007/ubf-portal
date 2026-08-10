import { View, Text } from '@react-pdf/renderer'
import type { LeaderboardRow, SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import HBar from './HBar'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

const COLS = [
  { key: 'rank', label: '#', flex: 0.35, num: false },
  { key: 'name', label: 'SALES MANAGER', flex: 1.6, num: false },
  { key: 'accounts', label: 'ACCOUNTS', flex: 0.75, num: true },
  { key: 'jobs', label: 'JOBS', flex: 0.55, num: true },
  { key: 'revenue', label: 'REVENUE', flex: 0.95, num: true },
  { key: 'gp', label: 'GROSS PROFIT', flex: 0.95, num: true },
  { key: 'gm', label: 'GM%', flex: 0.55, num: true },
  { key: 'avg', label: 'AVG GP/JOB', flex: 0.85, num: true },
  { key: 'vs', label: 'VS PRIOR', flex: 0.75, num: true },
]

function vsPriorText(gp: number, prev: number | null): string {
  if (prev == null || prev === 0) return '—'
  const pct = ((gp - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`
}

function actionTitle(rows: LeaderboardRow[], periodLabel: string): string {
  const assigned = rows.filter((r) => !r.is_unassigned)
  const byGp = [...assigned].sort((a, b) => num(b.gross_profit) - num(a.gross_profit))
  const top = byGp[0]
  if (!top) {
    const totalGp = assigned.reduce((s, r) => s + num(r.gross_profit), 0)
    return `Assigned reps generated ${cf.format(totalGp)} gross profit in the ${periodLabel} window`
  }
  const name = top.sales_manager?.trim() || '—'
  const margin = top.margin != null ? `${num(top.margin).toFixed(1)}%` : '—'
  return `${name} leads on GP at ${cf.format(num(top.gross_profit))} (${margin} GM)`
}

function TableRow({
  row, rank, muted,
}: { row: LeaderboardRow; rank: string | number; muted?: boolean }) {
  const cellStyle = muted ? pdfStyles.tdMuted : pdfStyles.td
  const name = row.is_unassigned ? 'Unassigned' : (row.sales_manager?.trim() || '—')
  const values = [
    String(rank),
    name,
    nf.format(num(row.accounts)),
    nf.format(num(row.jobs)),
    cf.format(num(row.revenue)),
    cf.format(num(row.gross_profit)),
    row.margin != null ? `${num(row.margin).toFixed(1)}%` : '—',
    row.avg_gp_job != null ? cf.format(num(row.avg_gp_job)) : '—',
    vsPriorText(num(row.gross_profit), row.prev_gross_profit),
  ]
  return (
    <View style={{ flexDirection: 'row' }} wrap={false}>
      {COLS.map((col, i) => {
        const style = {
          ...cellStyle,
          flex: col.flex,
          textAlign: col.num ? 'right' as const : 'left' as const,
          ...(col.num ? pdfStyles.num : {}),
          ...(i === 5 && !muted ? { color: C.accent, fontWeight: 600 as const } : {}),
        }
        return (
          <Text key={col.key} style={style}>
            {values[i]}
          </Text>
        )
      })}
    </View>
  )
}

export default function LeaderboardExhibit({ data }: Props) {
  const assigned = data.leaderboard.filter((r) => !r.is_unassigned)
  const unassigned = data.leaderboard.find((r) => r.is_unassigned)
  const maxGp = assigned.reduce((m, r) => Math.max(m, num(r.gross_profit)), 0)

  return (
    <View>
      <Text style={pdfStyles.exhibitLabel}>Exhibit 1 — Sales Leaderboard</Text>
      <Text style={pdfStyles.actionTitle}>{actionTitle(data.leaderboard, data.meta.periodLabel)}</Text>

      <View style={{ marginBottom: 24 }}>
        {assigned.map((row) => {
          const gm = row.margin != null ? `${num(row.margin).toFixed(1)}% GM` : undefined
          return (
            <HBar
              key={row.sales_manager ?? 'row'}
              label={row.sales_manager?.trim() || '—'}
              value={num(row.gross_profit)}
              max={maxGp}
              display={cf.format(num(row.gross_profit))}
              annotation={gm}
            />
          )
        })}
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' }}>
        {COLS.map((col) => (
          <Text key={col.key} style={[pdfStyles.th, { flex: col.flex, textAlign: col.num ? 'right' : 'left' }]}>{col.label}</Text>
        ))}
      </View>

      {assigned.map((row, i) => (
        <TableRow key={row.sales_manager ?? i} row={row} rank={i + 1} />
      ))}
      {unassigned ? <TableRow row={unassigned} rank="—" muted /> : null}

      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </View>
  )
}
