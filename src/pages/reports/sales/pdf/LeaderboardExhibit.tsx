import { View, Text } from '@react-pdf/renderer'
import type { LeaderboardRow, SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import HBar from './HBar'
import { C, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

const COLS = [
  { key: 'rank', label: '#', flex: 0.35, align: 'left' as const },
  { key: 'name', label: 'SALES MANAGER', flex: 1.6, align: 'left' as const },
  { key: 'accounts', label: 'ACCOUNTS', flex: 0.75, align: 'right' as const },
  { key: 'jobs', label: 'JOBS', flex: 0.55, align: 'right' as const },
  { key: 'revenue', label: 'REVENUE', flex: 0.95, align: 'right' as const },
  { key: 'gp', label: 'GROSS PROFIT', flex: 0.95, align: 'right' as const },
  { key: 'gm', label: 'GM%', flex: 0.55, align: 'right' as const },
  { key: 'avg', label: 'AVG GP/JOB', flex: 0.85, align: 'right' as const },
  { key: 'vs', label: 'VS PRIOR', flex: 0.75, align: 'right' as const },
]

function vsPriorCell(gp: number, prev: number | null) {
  if (prev == null || prev === 0) return { text: '—', color: C.muted }
  const pct = ((gp - prev) / prev) * 100
  if (pct >= 0) return { text: `▲ ${pct.toFixed(1)}%`, color: C.pos }
  return { text: `▼ ${Math.abs(pct).toFixed(1)}%`, color: C.neg }
}

function actionTitle(ranked: LeaderboardRow[]): string {
  const top = ranked.find((r) => !r.is_unassigned)
  if (!top) return 'Sales leaderboard'
  const name = top.sales_manager?.trim() || '—'
  const margin = top.margin != null ? `${num(top.margin).toFixed(1)}%` : '—'
  return `${name} leads on GP at ${cf.format(num(top.gross_profit))} (${margin} GM)`
}

function TableRow({
  row, rank, muted,
}: { row: LeaderboardRow; rank: string | number; muted?: boolean }) {
  const cellStyle = muted ? pdfStyles.tdMuted : pdfStyles.td
  const vs = vsPriorCell(num(row.gross_profit), row.prev_gross_profit)
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
    vs.text,
  ]
  return (
    <View style={{ flexDirection: 'row' }} wrap={false}>
      {COLS.map((col, i) => {
        const style = {
          ...cellStyle,
          flex: col.flex,
          textAlign: col.align,
          ...(i === 5 && !muted ? { color: C.accent, fontWeight: 600 as const } : {}),
          ...(i === 8 ? { color: vs.color, fontWeight: 600 as const } : {}),
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
      <Text style={pdfStyles.exhibitLabel}>Exhibit 1</Text>
      <Text style={pdfStyles.actionTitle}>{actionTitle(data.leaderboard)}</Text>

      <View style={{ marginBottom: 18 }}>
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

      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.navy, borderBottomStyle: 'solid' }}>
        {COLS.map((col) => (
          <Text key={col.key} style={[pdfStyles.th, { flex: col.flex, textAlign: col.align }]}>{col.label}</Text>
        ))}
      </View>

      {assigned.map((row, i) => (
        <TableRow key={row.sales_manager ?? i} row={row} rank={i + 1} />
      ))}
      {unassigned ? <TableRow row={unassigned} rank="—" muted /> : null}

      <Text style={pdfStyles.source}>
        Source: UBF portal sales leaderboard · {data.meta.periodLabel} period · generated {data.meta.generatedAt.toLocaleString('en-NZ')}
        {data.meta.scoped ? ' · scoped to single rep' : ''}
      </Text>
    </View>
  )
}
