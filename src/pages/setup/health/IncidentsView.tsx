import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useHealthRpc } from './healthApi'
import { nzTime } from './healthUi'
import type { AlertsData, SystemAlert } from './logsApi'
import AlertSettings from './AlertSettings'

function duration(a: SystemAlert) {
  const end = a.resolved_at ? new Date(a.resolved_at).getTime() : Date.now()
  const m = Math.max(1, Math.round((end - new Date(a.opened_at).getTime()) / 60000))
  return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function Row({ a }: { a: SystemAlert }) {
  const open = !a.resolved_at
  const tone = !open ? 'ok' : a.severity === 'critical' ? 'bad' : 'warn'
  const Icon = !open ? CheckCircle2 : a.severity === 'critical' ? AlertOctagon : AlertTriangle
  return (
    <div className="bs-inc">
      <div className={`ic ${tone}`}><Icon size={15} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3>{a.title}</h3>
          <span className={`bs-state ${open ? 'bs-state--open' : 'bs-state--res'}`}>
            <span className={`bs-dot ${open ? 'bs-dot--bad bs-dot--pulse' : 'bs-dot--ok'}`} />{open ? 'Ongoing' : 'Resolved'}
          </span>
          {open && a.severity === 'critical' && <span className="bs-badge bs-badge--red">CRITICAL</span>}
        </div>
        {a.detail && <p>{a.detail}</p>}
      </div>
      <div className="meta">
        <div>started {nzTime(a.opened_at)}</div>
        <div>{open ? `ongoing ${duration(a)}` : `lasted ${duration(a)}`}</div>
        <div>{a.notified_open_at ? 'notified' : 'not notified'}</div>
      </div>
    </div>
  )
}

export default function IncidentsView({ onRefresh }: { onRefresh: () => void }) {
  const { data, error } = useHealthRpc<AlertsData>('system_alerts_list', { p_limit: 200 }, 30_000)
  if (error) return <div className="bs-panel bs-empty"><b>Could not load incidents</b>{error}</div>
  const list = data?.alerts ?? []
  const open = list.filter((a) => !a.resolved_at)
  const past = list.filter((a) => a.resolved_at)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14, alignItems: 'start' }} className="bs-inc-grid">
      <style>{'@media (max-width:1100px){.bs-inc-grid{grid-template-columns:1fr!important}}'}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="bs-panel">
          <div className="bs-ph"><h2>Ongoing</h2><span className={`bs-badge${open.length ? ' bs-badge--red' : ''}`}>{open.length}</span></div>
          {open.length ? open.map((a) => <Row key={a.id} a={a} />) : (
            <div className="bs-empty"><b>No ongoing incidents</b>All rules passing. Checked every 5 min.</div>
          )}
        </div>
        <div className="bs-panel">
          <div className="bs-ph"><h2>History</h2><small>{past.length} resolved</small></div>
          {past.length ? past.map((a) => <Row key={a.id} a={a} />) : <div className="bs-empty">Nothing resolved yet.</div>}
        </div>
      </div>
      {data && <AlertSettings settings={data.settings} isAdmin={data.is_admin} onSaved={onRefresh} />}
    </div>
  )
}
