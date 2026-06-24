import { useNavigate } from 'react-router-dom'
import { Plane, Ship, Star } from 'lucide-react'
import type { Shipment } from '../types/shipment'
import { fmtShort, shipmentLabel } from '../utils/format'
import { countryFromPort, tradelaneLabel } from '../utils/ports'
import StatusPill from './StatusPill'

type Props = {
  rows: Shipment[]
  watchlist: Set<number>
  onToggleWatch: (jobUnique: number) => void
}

export default function ShipmentsTable({ rows, watchlist, onToggleWatch }: Props) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return <div className="empty card">No shipments match your filters.</div>
  }

  return (
    <div className="table-wrap card">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-star" aria-label="Watchlist" />
            <th>Shipment Number</th>
            <th>Tradelane</th>
            <th>Status</th>
            <th>Shipper</th>
            <th>Client</th>
            <th>Origin</th>
            <th>Destination</th>
            <th>ETD</th>
            <th>ETA</th>
            <th>Vessel/AWB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const starred = watchlist.has(s.job_unique)
            return (
              <tr
                key={s.job_unique}
                className="row-clickable"
                onClick={() => navigate(`/shipments/${s.job_unique}`)}
              >
                <td>
                  <button
                    type="button"
                    className={`star-btn${starred ? ' starred' : ''}`}
                    aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                    aria-pressed={starred}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleWatch(s.job_unique)
                    }}
                  >
                    <Star size={14} fill={starred ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td>
                  <span className="link-mono">{shipmentLabel(s)}</span>
                </td>
                <td>
                  <span className="tradelane">
                    {s.mode === 'air' ? <Plane size={12} /> : <Ship size={12} />}
                    {tradelaneLabel(s.mode, s.direction, s.origin)}
                  </span>
                </td>
                <td><StatusPill status={s.status} /></td>
                <td className="muted">—</td>
                <td>{s.customers?.name ?? '—'}</td>
                <td>
                  <span className="port-cell">
                    <span className="flag">{flagFor(countryFromPort(s.origin))}</span>
                    <span className="mono">{s.origin ?? '—'}</span>
                  </span>
                </td>
                <td>
                  <span className="port-cell">
                    <span className="flag">{flagFor(countryFromPort(s.destination))}</span>
                    <span className="mono">{s.destination ?? '—'}</span>
                  </span>
                </td>
                <td className="mono">{fmtShort(s.etd)}</td>
                <td className="mono">{fmtShort(s.eta)}</td>
                <td>{s.vessel_flight ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function flagFor(country: string): string {
  const flags: Record<string, string> = {
    Australia: '🇦🇺',
    'New Zealand': '🇳🇿',
    China: '🇨🇳',
    Fiji: '🇫🇯',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
  }
  return flags[country] ?? '🏳️'
}
