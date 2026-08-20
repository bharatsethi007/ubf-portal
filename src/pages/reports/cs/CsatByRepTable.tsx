import { fmtPct } from './CsatKpiCards'
import type { CsatByRepRow } from './csatApi'

type Props = { rows: CsatByRepRow[]; loading: boolean }

export default function CsatByRepTable({ rows, loading }: Props) {
  return (
    <div className="card quotes-page__card">
      <header className="quotes-page__head">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>By rep</h3>
      </header>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Initials</th>
              <th>Responses</th>
              <th>Avg score</th>
              <th>CSAT %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="text-muted-foreground">No rep data for this period.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.staff_user_id ?? r.initials ?? '—'}>
                <td>{r.initials?.trim() || '—'}</td>
                <td>{r.responses}</td>
                <td>{r.avg_score != null ? Number(r.avg_score).toFixed(2) : '—'}</td>
                <td>{fmtPct(r.csat_pct, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
