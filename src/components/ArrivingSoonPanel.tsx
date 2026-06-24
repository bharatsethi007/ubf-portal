import { useNavigate } from 'react-router-dom'
import type { Shipment } from '../types/shipment'
import { fmtShort, shipmentLabel } from '../utils/format'

type Props = {
  rows: Shipment[]
  loading?: boolean
}

export default function ArrivingSoonPanel({ rows, loading }: Props) {
  const navigate = useNavigate()

  return (
    <aside className="arriving-soon card">
      <div className="arriving-soon__head">
        <h2>Arriving soon</h2>
        <span className="arriving-soon__count">{rows.length}</span>
      </div>

      {loading ? (
        <p className="arriving-soon__empty muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="arriving-soon__empty muted">No arrivals in the next 7 days.</p>
      ) : (
        <ul className="arriving-soon__list">
          {rows.map((s) => (
            <li key={s.job_unique}>
              <button
                type="button"
                className="arriving-soon__row"
                onClick={() => navigate(`/shipments/${s.job_unique}`)}
              >
                <span className="arriving-soon__id mono">{shipmentLabel(s)}</span>
                <span className="arriving-soon__client">{s.customers?.name ?? '—'}</span>
                <span className="arriving-soon__meta">
                  <span className="mono">{s.destination ?? '—'}</span>
                  <span className="arriving-soon__eta mono">{fmtShort(s.eta)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
