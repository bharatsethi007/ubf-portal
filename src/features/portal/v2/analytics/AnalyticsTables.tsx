import { Link } from 'react-router-dom'
import { Plane, Ship } from 'lucide-react'
import type { PortMap } from '../../../../hooks/usePorts'
import { detailPath, fmtDay, fmtMoney, fmtNum, placeName, shortCode, titleCase } from '../homeModel'
import { money2, type ADelay, type ALane, type AParty } from './analyticsApi'

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="pv3-cell-sub">—</span>
  const tone = v >= 85 ? 'green' : v >= 65 ? 'amber' : 'red'
  return <span className={`pv3-an__pct pv3-an__pct--${tone}`}>{v}%</span>
}

function Days({ actual, sched }: { actual: number | null; sched?: number | null }) {
  if (actual != null) return <span>{Math.round(actual)} d</span>
  if (sched != null) return <span title="Scheduled, not yet measured from tracked arrivals">{Math.round(sched)} d <i className="pv3-cell-sub" style={{ display: 'inline' }}>sched.</i></span>
  return <span className="pv3-cell-sub">—</span>
}

export function LanesTable({ lanes, ports }: { lanes: ALane[]; ports: PortMap }) {
  const max = Math.max(1, ...lanes.map((l) => l.n))
  return (
    <section className="pv3-card pv3-table-card pv3-rise">
      <header className="pv3-card__head"><h2>Lanes</h2><span className="pv3-muted">Volume, cost and reliability by route</span></header>
      <div className="pv3-table-wrap">
        <table className="pv3-table pv3-an__table">
          <thead><tr><th>Lane</th><th>Shipments</th><th>Weight</th><th>Freight</th><th>Per kg</th><th>Transit</th><th>On time</th><th>CO₂e</th></tr></thead>
          <tbody>
            {lanes.map((l) => (
              <tr key={`${l.origin}-${l.destination}-${l.mode}`} className="pv3-an__static">
                <td>
                  <div className="pv3-an__lane">
                    {l.mode === 'air' ? <Plane size={14} /> : <Ship size={14} />}
                    <div>
                      <b className="pv3-mono">{shortCode(l.origin)} → {shortCode(l.destination)}</b>
                      <span className="pv3-cell-sub">{placeName(l.origin, ports)} to {placeName(l.destination, ports)}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="pv3-an__nbar"><span>{l.n}</span><i><b style={{ width: `${(l.n / max) * 100}%` }} /></i></div>
                </td>
                <td>{fmtNum(l.kg / 1000, true)} t</td>
                <td>{fmtMoney(l.spend, 'NZD', true)}</td>
                <td>{l.cost_per_kg != null ? money2(l.cost_per_kg) : '—'}</td>
                <td><Days actual={l.transit_days} sched={l.sched_days} /></td>
                <td><Pct v={l.on_time_pct} /></td>
                <td>{fmtNum(l.co2_kg / 1000, true)} t</td>
              </tr>
            ))}
            {!lanes.length && <tr><td colSpan={8} className="pv3-empty-cell">No shipments in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function PartiesTable({ parties, ports }: { parties: AParty[]; ports: PortMap }) {
  return (
    <section className="pv3-card pv3-table-card pv3-rise">
      <header className="pv3-card__head"><h2>Supplier scorecard</h2><span className="pv3-muted">Who ships the most, how fast and how reliably</span></header>
      <div className="pv3-table-wrap">
        <table className="pv3-table pv3-an__table">
          <thead><tr><th>Supplier</th><th>Ships from</th><th>Shipments</th><th>Weight</th><th>Freight</th><th>Transit</th><th>On time</th><th>Last shipped</th></tr></thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.party} className="pv3-an__static">
                <td><b className="pv3-an__party" title={titleCase(p.party)}>{titleCase(p.party)}</b></td>
                <td className="pv3-ellipsis">{(p.origins ?? []).filter(Boolean).slice(0, 2).map((o) => placeName(o, ports)).join(', ') || '—'}</td>
                <td>{p.n}</td>
                <td>{fmtNum(p.kg / 1000, true)} t</td>
                <td>{fmtMoney(p.spend, 'NZD', true)}</td>
                <td><Days actual={p.transit_days} /></td>
                <td><Pct v={p.on_time_pct} /></td>
                <td>{fmtDay(p.last)}</td>
              </tr>
            ))}
            {!parties.length && <tr><td colSpan={8} className="pv3-empty-cell">No shipments in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DelaysCard({ delays, ports }: { delays: ADelay[]; ports: PortMap }) {
  return (
    <section className="pv3-card pv3-table-card pv3-rise">
      <header className="pv3-card__head"><h2>Biggest delays</h2><span className="pv3-muted">Arrived more than 2 days after the ETA</span></header>
      {delays.length ? (
        <ul className="pv3-an__delays">
          {delays.map((d) => (
            <li key={d.job_unique}>
              <Link to={detailPath(d)}>
                <b>+{d.delay} d</b>
                <span>{placeName(d.origin, ports)} → {placeName(d.destination, ports)}</span>
                <span className="pv3-cell-sub">{titleCase(d.party)} · {d.vessel ?? ''} · ETA {fmtDay(d.eta)}, arrived {fmtDay(d.arrived)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pv3-muted pv3-an__none">No late arrivals among tracked shipments. On-time figures grow as live tracking covers more of your shipments.</p>
      )}
    </section>
  )
}
