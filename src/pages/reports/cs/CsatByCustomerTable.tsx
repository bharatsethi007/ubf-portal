import { type CSSProperties } from 'react'
import { fmtPct } from './CsatKpiCards'
import type { CsatByCustomerRow } from './csatApi'

function scoreStyle(v: number | null): CSSProperties {
  if (v == null || Number.isNaN(v)) return {}
  if (v >= 4) return { color: '#1F8A4C', fontWeight: 600 }
  if (v >= 3) return { color: '#B4791F', fontWeight: 600 }
  return { color: '#B23B3B', fontWeight: 600 }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

type Props = {
  rows: CsatByCustomerRow[]
  loading: boolean
  onSelectAccount: (accountId: string, name: string) => void
}

export default function CsatByCustomerTable({ rows, loading, onSelectAccount }: Props) {
  return (
    <div className="card quotes-page__card">
      <header className="quotes-page__head">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>By customer</h3>
      </header>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Responses</th>
              <th>Avg score</th>
              <th>CSAT %</th>
              <th>Last response</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-muted-foreground">No CSAT responses for this period.</td></tr>
            ) : rows.map((r) => {
              const id = r.account_id ?? ''
              const name = r.customer_name?.trim() || id || '—'
              return (
                <tr
                  key={id || name}
                  className={id ? 'row-clickable' : undefined}
                  onClick={() => { if (id) onSelectAccount(id, name) }}
                >
                  <td>{name}</td>
                  <td>{r.responses}</td>
                  <td style={scoreStyle(r.avg_score)}>{r.avg_score != null ? Number(r.avg_score).toFixed(2) : '—'}</td>
                  <td>{fmtPct(r.csat_pct, false)}</td>
                  <td>{fmtDate(r.last_response_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
