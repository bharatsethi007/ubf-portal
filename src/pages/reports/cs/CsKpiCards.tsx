import { KpiRail, NAVY, nf } from '../reportsUi'
import type { CsComplaintsSummary } from './csReportsApi'

type Props = { summary: CsComplaintsSummary | null; loading: boolean }

function fmtDays(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return nf.format(Number(v))
}

export default function CsKpiCards({ summary, loading }: Props) {
  const s = summary
  const dash = loading ? '…' : '—'
  return (
    <KpiRail
      items={[
        { label: 'Open complaints', value: loading ? '…' : nf.format(s?.open_complaints ?? 0), accent: NAVY },
        { label: 'Total (period)', value: loading ? '…' : nf.format(s?.total_complaints ?? 0) },
        { label: 'Resolved', value: loading ? '…' : nf.format(s?.resolved_complaints ?? 0) },
        { label: 'Avg resolution (days)', value: loading ? '…' : (s ? fmtDays(s.avg_resolution_days) : dash) },
        { label: 'Accounts affected', value: loading ? '…' : nf.format(s?.accounts_affected ?? 0), accent: NAVY },
        { label: 'Repeat-offender accounts', value: loading ? '…' : nf.format(s?.repeat_accounts ?? 0) },
        { label: 'High-severity open', value: loading ? '…' : nf.format(s?.high_severity_open ?? 0) },
        { label: 'Negative-sentiment touches', value: loading ? '…' : nf.format(s?.negative_sentiment_comms ?? 0) },
      ]}
    />
  )
}
