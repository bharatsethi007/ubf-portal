import { Text } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import SectionHeader from './SectionHeader'
import DataTable from './DataTable'
import HBar from './HBar'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'
import { num } from './pdfReportHelpers'

type Props = { data: SalesReportData }

function actionTitle(data: SalesReportData): string {
  const accounts = data.accounts ?? []
  const totalRev = accounts.reduce((s, a) => s + num(a.revenue), 0)
  const bookRev = data.kpis.revenue
  const share = bookRev > 0 ? (totalRev / bookRev) * 100 : 0
  return `Top ${accounts.length} accounts drive ${share.toFixed(0)}% of book revenue (${cf.format(totalRev)})`
}

const COLS = [
  { key: 'rank', label: 'Rank', flex: 0.4 },
  { key: 'customer', label: 'Customer', flex: 1.8 },
  { key: 'jobs', label: 'Jobs', align: 'right' as const, flex: 0.55 },
  { key: 'revenue', label: 'Revenue', align: 'right' as const, flex: 0.85 },
  { key: 'gp', label: 'Gross profit', align: 'right' as const, accent: 'orange' as const, flex: 0.85 },
  { key: 'gm', label: 'GM%', align: 'right' as const, flex: 0.55 },
  { key: 'open', label: 'Open balance', align: 'right' as const, flex: 0.85 },
]

export default function TopAccountsExhibit({ data }: Props) {
  const accounts = data.accounts ?? []
  const top10 = accounts.slice(0, 10)
  const maxRev = top10.reduce((m, a) => Math.max(m, num(a.revenue)), 0)

  const rows = accounts.map((a, i) => {
    const rev = num(a.revenue)
    const gp = num(a.gross_profit)
    return {
      rank: String(i + 1),
      customer: a.customer_name?.trim() || a.customer_account_id,
      jobs: nf.format(num(a.jobs)),
      revenue: cf.format(rev),
      gp: cf.format(gp),
      gm: rev > 0 ? `${((gp / rev) * 100).toFixed(1)}%` : '—',
      open: cf.format(num(a.open_balance)),
    }
  })

  return (
    <>
      <SectionHeader n={2} title="Top accounts" />
      <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14 }}>{actionTitle(data)}</Text>

      <Text style={{ ...pdfStyles.label, marginBottom: 8 }}>Top 10 by revenue</Text>
      {top10.map((a) => (
        <HBar
          key={a.customer_account_id}
          label={(a.customer_name?.trim() || a.customer_account_id).slice(0, 28)}
          value={num(a.revenue)}
          max={maxRev}
          display={cf.format(num(a.revenue))}
          labelWidth={100}
        />
      ))}

      <Text style={{ fontSize: 8, color: C.muted, marginTop: 12, marginBottom: 10 }}>
        Showing {accounts.length} of {data.accountsTotal ?? accounts.length} accounts
      </Text>

      <DataTable columns={COLS} rows={rows} />
      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </>
  )
}
