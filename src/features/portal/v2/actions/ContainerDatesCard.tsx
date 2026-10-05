import { Package } from 'lucide-react'
import TaskActionRow from './TaskActionRow'
import { shortDay, type PortalContainerDates } from './portalActionsApi'
import { usePortalActions } from './usePortalActions'

const TONE: Record<string, string> = {
  overdue: 'bg-red-50 text-red-700', today: 'bg-red-50 text-red-700', soon: 'bg-amber-50 text-amber-700',
  ok: 'bg-emerald-50 text-emerald-700', collected: 'bg-slate-100 text-slate-600', returned: 'bg-slate-100 text-slate-600', unknown: 'text-slate-400',
}

function Day({ iso, status, est, title }: { iso: string | null; status?: string; est?: boolean; title?: string }) {
  if (!iso) return <span className="text-slate-400">—</span>
  return (
    <span title={title} className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${status ? TONE[status] ?? '' : 'text-slate-700'}`}>
      {est ? '~' : ''}{shortDay(iso)}
    </span>
  )
}

function emptyCell(d: PortalContainerDates) {
  if (d.empty_returned_on) return <Day iso={d.empty_returned_on} status="returned" title="Empty returned" />
  if (d.empty_ready_at) return <span className="text-xs text-emerald-700">Ready</span>
  if (d.planned_return_date) return <Day iso={d.planned_return_date} status={d.return_after_free_time ? 'soon' : undefined} title={d.return_after_free_time ? 'After free time ends' : 'Planned'} />
  return <span className="text-slate-400">—</span>
}

/** Shipment page: free time per container plus anything we need from the customer on this booking. */
export default function ContainerDatesCard({ bookingId, docsTo }: { bookingId: string; docsTo?: string | null }) {
  const { tasks, dates, loading, busy, respond } = usePortalActions(bookingId)
  if (loading || (dates.length === 0 && tasks.length === 0)) return null

  return (
    <section className="pv3-card pv3-rise" style={{ padding: 20, marginBottom: 16 }}>
      {tasks.length > 0 && (
        <>
          <header className="pv3-card__head"><h2>We need from you <span className="pv3-count pv3-count--red">{tasks.length}</span></h2></header>
          <div className="mb-4">
            {tasks.map((t) => (
              <TaskActionRow key={t.id} task={t} dates={dates} busy={busy === t.id} docsTo={docsTo} onRespond={(r) => respond(t, r)} />
            ))}
          </div>
        </>
      )}

      {dates.length > 0 && (
        <>
          <header className="pv3-card__head">
            <h2><Package size={16} /> Container dates</h2>
            <span className="pv3-muted" style={{ fontSize: 12 }}>~ means estimated until the vessel discharges</span>
          </header>
          <div className="pv3-table-wrap">
            <table className="pv3-table">
              <thead>
                <tr>
                  <th>Container</th><th>Port free until</th><th>Collected</th><th>Delivery</th>
                  <th>Free days</th><th>Free time ends</th><th>Empty</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d.container_no} style={{ cursor: 'default' }}>
                    <td><span className="pv3-mono pv3-strong">{d.container_no}</span>{d.container_type ? <span className="pv3-cell-sub">{d.container_type}</span> : null}</td>
                    <td><Day iso={d.port_last_free_day} status={d.gated_out_on ? 'collected' : d.port_status} title="Last free day at the port" /></td>
                    <td><Day iso={d.gated_out_on} /></td>
                    <td>{d.planned_delivery_date ? <><Day iso={d.planned_delivery_date} />{d.delivery_window ? <span className="pv3-cell-sub">{d.delivery_window}</span> : null}</> : <span className="text-slate-400">—</span>}</td>
                    <td>{d.detention_free_days}</td>
                    <td><Day iso={d.last_detention_day} status={d.detention_status} est={d.detention_is_estimate} title="Last day to return the empty before detention" /></td>
                    <td>{emptyCell(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
