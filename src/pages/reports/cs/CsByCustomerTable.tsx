import type { CsComplaintsByCustomerRow } from './csReportsApi'

type Props = {
  rows: CsComplaintsByCustomerRow[]
  loading: boolean
  onSelectCustomer: (accountId: string, customerName: string) => void
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function fmtDays(v: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(1)
}

export default function CsByCustomerTable({ rows, loading, onSelectCustomer }: Props) {
  return (
    <div className="card quotes-page__card">
      <header className="quotes-page__head">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>By customer</h2>
      </header>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Complaints</th>
              <th>Open</th>
              <th>At-risk touches</th>
              <th>Last complaint</th>
              <th>Avg resolution (days)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-muted-foreground">No complaints for this period.</td></tr>
            ) : rows.map((r) => {
              const id = r.account_id ?? ''
              const name = r.customer_name?.trim() || id || '—'
              return (
                <tr
                  key={id || name}
                  className={id ? 'row-clickable' : undefined}
                  onClick={() => { if (id) onSelectCustomer(id, name) }}
                >
                  <td>{name}</td>
                  <td>{r.complaints}</td>
                  <td>{r.open_complaints}</td>
                  <td>{r.at_risk_touches}</td>
                  <td>{fmtDate(r.last_complaint_at)}</td>
                  <td>{fmtDays(r.avg_resolution_days)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
