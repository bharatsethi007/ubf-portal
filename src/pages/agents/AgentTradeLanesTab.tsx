import { useEffect, useState, type ReactNode } from 'react'
import { fmt } from '../../components/Customers/profileUi'
import { fetchAgentTradeLanes, type AgentTradeLane } from './agentsApi'

export function TradeLanesTab({ accountId }: { accountId: string }) {
  const [lanes, setLanes] = useState<AgentTradeLane[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAgentTradeLanes(accountId)
      .then((rows) => {
        if (!cancelled) setLanes(rows)
      })
      .catch(() => {
        if (!cancelled) setLanes([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId])

  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Trade lanes</h3>
        <span className="text-muted-foreground">Shipments billed to this agent's account</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lane</th>
              <th>Mode</th>
              <th>Direction</th>
              <th style={{ textAlign: 'right' }}>Shipments</th>
              <th>Last</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground pad-inline">
                  Loading…
                </td>
              </tr>
            ) : lanes.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground pad-inline">
                  No trade lanes yet.
                </td>
              </tr>
            ) : (
              lanes.map((l, i) => (
                <tr key={i}>
                  <td>
                    <span className="cp-lane">
                      <span>{l.origin ?? '—'}</span>
                      <span className="cp-arrow"> → </span>
                      <span>{l.destination ?? '—'}</span>
                    </span>
                  </td>
                  <td>{l.mode ? l.mode[0].toUpperCase() + l.mode.slice(1) : '—'}</td>
                  <td>{l.direction ? l.direction[0].toUpperCase() + l.direction.slice(1) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt.int(l.shipments)}</td>
                  <td>{fmt.date(l.last_shipment)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`cp-tab ${active ? 'cp-tab--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
