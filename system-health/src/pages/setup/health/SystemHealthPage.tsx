import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Database, HardDrive, Plug, RotateCw, Server } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TOWER_CSS } from '../../tower/towerTheme'
import { CountUp, Skeleton } from '../../tower/towerUi'
import { HEALTH_CSS } from './healthTheme'
import { HealthTick, type Overview, runProbe, useHealthRpc } from './healthApi'
import { ago, Dot, fmtBytes, type Tone } from './healthUi'
import { freshTone } from './SyncTab'
import ApisTab from './ApisTab'
import SyncTab from './SyncTab'
import BackendTab from './BackendTab'
import StorageTab from './StorageTab'

type TabKey = 'apis' | 'sync' | 'backend' | 'storage'
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'apis', label: 'APIs', icon: Plug },
  { key: 'sync', label: 'TWF sync', icon: Database },
  { key: 'backend', label: 'Backend', icon: Server },
  { key: 'storage', label: 'Storage', icon: HardDrive },
]

function overallTone(o: Overview): Tone {
  const sync = freshTone(o.sync_last)
  if (o.apis_down > 0 || sync === 'bad') return 'bad'
  if (sync === 'warn' || o.cron_failed_24h > 0 || (o.calls_24h && o.errors_24h / o.calls_24h > 0.05)) return 'warn'
  return 'ok'
}
const HEADLINE: Record<Tone, string> = {
  ok: 'All systems normal', warn: 'Needs attention', bad: 'Something is down', idle: 'Collecting data',
}

function Hero({ onTab }: { onTab: (k: TabKey) => void }) {
  const { data: o } = useHealthRpc<Overview>('system_overview', {}, 30_000)
  if (!o) return <div className="sh-hero">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="tw-card tw-kpi"><Skeleton h={70} /></div>)}</div>
  const tone = overallTone(o)
  const sync = freshTone(o.sync_last)
  const issues = [
    o.apis_down ? `${o.apis_down} API${o.apis_down > 1 ? 's' : ''} unreachable` : null,
    sync !== 'ok' ? `TWF sync ${ago(o.sync_last)}` : null,
    o.cron_failed_24h ? `${o.cron_failed_24h} job failures` : null,
  ].filter(Boolean)

  return (
    <div className="sh-hero">
      <div className="tw-card sh-status">
        <div className="sh-status__l">System status</div>
        <div className="sh-status__v"><Dot tone={tone} pulse />{HEADLINE[tone]}</div>
        <div className="sh-status__s">{issues.length ? issues.join(' · ') : `${o.apis_total} APIs, sync, database and storage checked`}</div>
      </div>
      <button type="button" className="tw-card tw-kpi sh-api" onClick={() => onTab('apis')} style={{ animationDelay: '40ms' }}>
        <div className="tw-kpi__l">API calls 24h</div>
        <CountUp className="tw-kpi__v" value={o.calls_24h} />
        <div className="tw-kpi__s">{o.errors_24h ? <span className="tw-dn">{o.errors_24h} errors</span> : 'No errors'} · {fmtBytes(o.bytes_24h)}</div>
      </button>
      <button type="button" className="tw-card tw-kpi sh-api" onClick={() => onTab('sync')} style={{ animationDelay: '80ms' }}>
        <div className="tw-kpi__l">TWF sync</div>
        <div className="tw-kpi__v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot tone={sync} />{ago(o.sync_last)}</div>
        <div className="tw-kpi__s">Expected hourly</div>
      </button>
      <button type="button" className="tw-card tw-kpi sh-api" onClick={() => onTab('backend')} style={{ animationDelay: '120ms' }}>
        <div className="tw-kpi__l">Database</div>
        <CountUp className="tw-kpi__v" value={o.db_bytes} format={fmtBytes} />
        <div className="tw-kpi__s">{o.cron_failed_24h ? <span className="tw-dn">{o.cron_failed_24h} job failures 24h</span> : 'Jobs healthy'}</div>
      </button>
      <button type="button" className="tw-card tw-kpi sh-api" onClick={() => onTab('storage')} style={{ animationDelay: '160ms' }}>
        <div className="tw-kpi__l">S3 storage</div>
        <CountUp className="tw-kpi__v" value={o.s3_bytes ?? 0} format={fmtBytes} />
        <div className="tw-kpi__s">Auckland bucket</div>
      </button>
    </div>
  )
}

export default function SystemHealthPage() {
  const [tab, setTab] = useState<TabKey>('apis')
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(new Date())

  const refresh = async () => {
    setBusy(true)
    try {
      const r = await runProbe('probe')
      toast.success(`Probed ${r.total ?? 0} APIs · ${r.up ?? 0} up`)
    } catch (e) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setTick((t) => t + 1); setStamp(new Date()); setBusy(false)
    }
  }

  return (
    <HealthTick.Provider value={tick}>
      <div className="tw-root">
        <style>{TOWER_CSS + HEALTH_CSS}</style>
        <div className="tw-head">
          <div>
            <div className="tw-crumb"><Link to="/setup" style={{ color: 'inherit' }}>Setup</Link> › System health</div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Activity size={22} color="#0B1A3A" />System health</h1>
          </div>
          <div className="tw-tools">
            <span className="tw-stamp">Updated {stamp.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</span>
            <button type="button" className="tw-ib" title="Run probes now" aria-label="Run probes now" onClick={refresh} disabled={busy}>
              <RotateCw size={16} className={busy ? 'sh-spin' : ''} />
            </button>
          </div>
        </div>

        <Hero onTab={setTab} />

        <div className="sh-tabs" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <div key={tab} style={{ animation: 'tw-rise .35s var(--ease) both' }}>
          {tab === 'apis' && <ApisTab />}
          {tab === 'sync' && <SyncTab />}
          {tab === 'backend' && <BackendTab />}
          {tab === 'storage' && <StorageTab />}
        </div>
      </div>
    </HealthTick.Provider>
  )
}
