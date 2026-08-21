import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, X } from 'lucide-react'
import { Lane } from '../../../components/Customers/profileUi'
import type { ViewMode } from './conferencesApi'
import { fetchAgentBrief, type AgentBrief } from './agentBriefApi'
import { buildTalkingPoints, money } from './agentBriefUi'
import './conferenceBrief.css'

type Props = {
  agentId: string
  agentName: string
  viewMode: ViewMode
  onClose: () => void
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'd MMM yyyy')
}

export default function AgentBriefPanel({ agentId, agentName, onClose }: Props) {
  const navigate = useNavigate()
  const [brief, setBrief] = useState<AgentBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAgentBrief(agentId, force)
        setBrief(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load brief')
      } finally {
        setLoading(false)
      }
    },
    [agentId],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const talkingPoints = brief?.linked ? buildTalkingPoints(brief) : []

  return (
    <div
      className="conf-brief__backdrop"
      style={{ justifyContent: 'center', alignItems: 'center' }}
      onClick={onClose}
    >
      <div
        className="conf-brief__panel"
        style={{
          width: '70vw',
          maxWidth: 1100,
          height: '70vh',
          maxHeight: '85vh',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          animation: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="conf-brief__head">
          <div>
            <h2 className="conf-brief__title">{agentName}</h2>
            <button
              type="button"
              className="text-link conf-brief__profile-link"
              onClick={() => navigate(`/agents/${agentId}`)}
            >
              Open full profile →
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Refresh brief"
              title="Refresh"
              onClick={() => void load(true)}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" className="agent-modal__close" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {loading && <p className="text-muted-foreground">Loading brief…</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && brief && !brief.linked && (
          <p className="text-muted-foreground">
            This agent isn&apos;t linked to an ERP account yet — no shipment or invoice history to show.
          </p>
        )}

        {!loading && !error && brief?.linked && (
          <>
            <div className="conf-brief__chips">
              <div className="conf-brief__chip">
                <div className="conf-brief__chip-num">{brief.shipments_total}</div>
                <div className="conf-brief__chip-label">Shipments</div>
                <div className="conf-brief__chip-sub">· {brief.shipments_12m} in last 12m</div>
              </div>
              <div className="conf-brief__chip">
                <div className="conf-brief__chip-num">{money(brief.revenue_total)}</div>
                <div className="conf-brief__chip-label">Invoicing</div>
              </div>
              <div
                className={`conf-brief__chip${brief.unpaid_count > 0 ? ' conf-brief__chip--danger' : ' conf-brief__chip--ok'}`}
              >
                <div className="conf-brief__chip-num">
                  {brief.unpaid_count > 0
                    ? `${brief.unpaid_count} unpaid · ${money(brief.unpaid_balance)}`
                    : 'No unpaid invoices'}
                </div>
                <div className="conf-brief__chip-label">Unpaid</div>
              </div>
              <div className="conf-brief__chip">
                <div className="conf-brief__chip-num">{fmtDate(brief.last_shipment)}</div>
                <div className="conf-brief__chip-label">Last shipment</div>
              </div>
            </div>

            <div className="conf-brief__talking">
              <strong>Talking points</strong>
              {talkingPoints.length ? (
                <ul>
                  {talkingPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p>No flags — relationship looks healthy.</p>
              )}
            </div>

            {brief.recent_lanes.length > 0 && (
              <section className="conf-brief__section">
                <h3 className="conf-brief__section-title">Top lanes</h3>
                <div className="table-wrap">
                  <table className="data-table conf-brief__table">
                    <thead>
                      <tr>
                        <th>Lane</th>
                        <th>Mode</th>
                        <th>Dir</th>
                        <th>Shipments</th>
                        <th>Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brief.recent_lanes.map((lane, i) => (
                        <tr key={`${lane.origin}-${lane.destination}-${i}`}>
                          <td>
                            <Lane origin={lane.origin} destination={lane.destination} />
                          </td>
                          <td>{lane.mode ?? '—'}</td>
                          <td>{lane.direction ?? '—'}</td>
                          <td>{lane.shipments}</td>
                          <td>{fmtDate(lane.last_etd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {brief.unpaid_invoices.length > 0 && (
              <section className="conf-brief__section">
                <h3 className="conf-brief__section-title">Unpaid invoices</h3>
                <ul className="conf-brief__invoices">
                  {brief.unpaid_invoices.map((inv, i) => (
                    <li key={`${inv.invoice_no}-${i}`}>
                      {inv.invoice_no ?? '—'} · {inv.currency ?? 'NZD'}{' '}
                      {money(inv.balance)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
