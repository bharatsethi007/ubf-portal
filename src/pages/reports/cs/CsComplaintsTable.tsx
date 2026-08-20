import { type CSSProperties } from 'react'
import type { CsComplaintsListRow } from './csReportsApi'

type Props = { rows: CsComplaintsListRow[]; loading: boolean }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function severityStyle(severity: string | null): CSSProperties {
  const s = (severity ?? '').toLowerCase()
  if (s === 'high' || s === 'critical') return { color: '#B23B3B', fontWeight: 600 }
  if (s === 'medium') return { color: '#B4791F', fontWeight: 600 }
  if (s === 'low') return { color: 'var(--muted-foreground)' }
  return {}
}

export default function CsComplaintsTable({ rows, loading }: Props) {
  return (
    <div className="card quotes-page__card">
      <header className="quotes-page__head">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Complaint register</h2>
      </header>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Age (days)</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-muted-foreground">No complaints for this period.</td></tr>
            ) : rows.map((r) => {
              const tip = [r.subject, r.body].filter(Boolean).join('\n\n') || undefined
              return (
                <tr key={r.comm_id}>
                  <td>{fmtDate(r.occurred_at)}</td>
                  <td>{r.customer_name?.trim() || r.account_id || '—'}</td>
                  <td>{r.complaint_type ?? '—'}</td>
                  <td style={severityStyle(r.complaint_severity)}>{r.complaint_severity ?? '—'}</td>
                  <td>{r.complaint_status ?? '—'}</td>
                  <td>{r.age_days ?? '—'}</td>
                  <td title={tip}>{r.subject?.trim() || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
