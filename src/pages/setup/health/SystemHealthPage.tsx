import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Database, HardDrive, Radio, RefreshCw, Server, Siren, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TOWER_CSS } from '../../tower/towerTheme'
import { HEALTH_CSS } from './healthTheme'
import { BS_CSS } from './bsTheme'
import { HealthTick, type Overview, runProbe, useHealthRpc } from './healthApi'
import { ago, fmtBytes, type Tone } from './healthUi'
import type { AlertsData } from './logsApi'
import { freshTone } from './SyncTab'
import LogsView from './LogsView'
import MonitorsView from './MonitorsView'
import IncidentsView from './IncidentsView'
import SyncTab from './SyncTab'
import BackendTab from './BackendTab'
import StorageTab from './StorageTab'

type Key = 'logs' | 'monitors' | 'incidents' | 'sync' | 'database' | 'storage'
type Nav = { key: Key; label: string; icon: LucideIcon; blurb: string }
const GROUPS: { title: string; items: Nav[] }[] = [
  { title: 'Telemetry', items: [
    { key: 'logs', label: 'Live tail', icon: ScrollText, blurb: 'Every outbound API call, probe failure, sync run, job failure and alert in one stream.' },
    { key: 'monitors', label: 'Monitors', icon: Radio, blurb: 'Reachability and real-traffic health for each external API.' },
  ] },
  { title: 'Alerting', items: [
    { key: 'incidents', label: 'Incidents', icon: Siren, blurb: 'Open and past alerts, who gets told, and the rules.' },
  ] },
  { title: 'Infrastructure', items: [
    { key: 'sync', label: 'TWF sync', icon: Database, blurb: 'CyberFreight FDB to Supabase sync freshness and run logs.' },
    { key: 'database', label: 'Database', icon: Server, blurb: 'Postgres size, connections, cache and scheduled jobs.' },
    { key: 'storage', label: 'Storage', icon: HardDrive, blurb: 'S3 bucket size by area and read/write checks.' },
  ] },
]
const ALL = GROUPS.flatMap((g) => g.items)

function overallTone(o: Overview | null, openAlerts: number, critical: boolean): Tone {
  if (!o) return 'idle'
  if (critical || o.apis_down > 0) return 'bad'
  if (openAlerts > 0 || freshTone(o.sync_last) !== 'ok' || o.cron_failed_24h > 0) return 'warn'
  return 'ok'
}
const HEAD: Record<Tone, string> = { ok: 'All systems normal', warn: 'Needs attention', bad: 'Incident ongoing', idle: 'Checking…' }

function Sidebar({ active, onPick }: { active: Key; onPick: (k: Key) => void }) {
  const { data: o } = useHealthRpc<Overview>('system_overview', {}, 30_000)
  const { data: al } = useHealthRpc<AlertsData>('system_alerts_list', { p_limit: 50 }, 30_000)
  const open = (al?.alerts ?? []).filter((a) => !a.resolved_at)
  const tone = overallTone(o, open.length, open.some((a) => a.severity === 'critical'))
  return (
    <nav className="bs-side" aria-label="System health">
      <div className="bs-brand"><i><Activity size={14} /></i>System health</div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="bs-sec">{g.title}</div>
          {g.items.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className="bs-nav" aria-current={active === key ? 'page' : undefined} onClick={() => onPick(key)}>
              <Icon size={15} />{label}
              {key === 'incidents' && open.length > 0 && <span className="bs-badge bs-badge--red">{open.length}</span>}
              {key === 'logs' && o && o.errors_24h > 0 && <span className="bs-badge">{o.errors_24h}</span>}
            </button>
          ))}
        </div>
      ))}
      <div className="bs-side-foot">
        <b><span className={`bs-dot bs-dot--${tone} bs-dot--pulse`} />{HEAD[tone]}</b>
        {o && <span>{o.calls_24h.toLocaleString()} calls 24h · {fmtBytes(o.bytes_24h)}</span>}
        {o && <span>Sync {ago(o.sync_last)} · DB {fmtBytes(o.db_bytes)}</span>}
      </div>
    </nav>
  )
}

export default function SystemHealthPage() {
  const [active, setActive] = useState<Key>('logs')
  const [logSource, setLogSource] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(new Date())
  const nav = ALL.find((n) => n.key === active)!

  const refresh = async () => {
    setBusy(true)
    try {
      const r = await runProbe('probe')
      toast.success(`Probed ${r.total ?? 0} APIs · ${r.up ?? 0} up`)
    } catch (e) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : e}`)
    } finally { setTick((t) => t + 1); setStamp(new Date()); setBusy(false) }
  }
  const pick = (k: Key) => { if (k !== 'logs') setLogSource(null); setActive(k) }

  return (
    <HealthTick.Provider value={tick}>
      <style>{TOWER_CSS + HEALTH_CSS + BS_CSS}</style>
      <div className="bs-root">
        <Sidebar active={active} onPick={pick} />
        <main className="bs-main">
          <header className="bs-head">
            <span className="bs-crumb"><Link to="/setup">Setup</Link> /</span>
            <h1>{nav.label}</h1>
            <span className="bs-crumb" style={{ marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nav.blurb}</span>
            <span className="bs-gap" />
            <span className="bs-crumb bs-num" style={{ whiteSpace: 'nowrap' }}>
              {stamp.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <button type="button" className="bs-btn bs-ib" title="Run probes now" aria-label="Run probes now" onClick={refresh} disabled={busy}>
              <RefreshCw size={14} className={busy ? 'bs-spin' : ''} />
            </button>
          </header>
          <div className={`bs-body${['sync', 'database', 'storage'].includes(active) ? ' tw-root' : ''}`} key={active + (logSource ?? '')}>
            {active === 'logs' && <LogsView initialSource={logSource} />}
            {active === 'monitors' && <MonitorsView onOpen={(code) => { setLogSource(code); setActive('logs') }} />}
            {active === 'incidents' && <IncidentsView onRefresh={() => setTick((t) => t + 1)} />}
            {active === 'sync' && <SyncTab />}
            {active === 'database' && <BackendTab />}
            {active === 'storage' && <StorageTab />}
          </div>
        </main>
      </div>
    </HealthTick.Provider>
  )
}
