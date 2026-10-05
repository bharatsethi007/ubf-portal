import { useState } from 'react'
import { Database } from 'lucide-react'
import { Empty, Skeleton, Widget } from '../../tower/towerUi'
import { type Sync, type SyncRun, useHealthRpc } from './healthApi'
import { ago, Dot, hoursSince, Mono, nzTime, StatusPill, type Tone } from './healthUi'

const MODULE_NAME: Record<string, string> = { FIA: 'Import Air', FIS: 'Import Sea', FEA: 'Export Air', FES: 'Export Sea' }

/* Sync is hourly. Over 3h is late, over 24h is down. */
export function freshTone(iso: string | null | undefined): Tone {
  const h = hoursSince(iso)
  if (!Number.isFinite(h)) return 'idle'
  return h > 24 ? 'bad' : h > 3 ? 'warn' : 'ok'
}

function dur(a: string, b: string | null) {
  if (!b) return 'running'
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

function RunRow({ r, open, onToggle }: { r: SyncRun; open: boolean; onToggle: () => void }) {
  const tone: Tone = r.status === 'ok' ? 'ok' : r.status === 'error' ? 'bad' : 'warn'
  return (
    <div>
      <div className="sh-run" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onToggle() }}>
        <div className="sh-run__rail"><Dot tone={tone} pulse={r.status === 'running'} /></div>
        <div>
          <div className="sh-run__t">{nzTime(r.started_at)} · {r.source}{r.script ? ` · ${r.script}` : ''}</div>
          <div className="sh-run__s">{r.message ?? (r.status === 'running' ? 'In progress' : '—')}</div>
          {r.modules && (
            <div className="sh-chips">
              {Object.entries(r.modules).map(([k, v]) => <span key={k} className="sh-chip tw-num">{k} {Number(v).toLocaleString()}</span>)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <StatusPill tone={tone}>{r.status === 'ok' ? 'Done' : r.status === 'error' ? 'Failed' : 'Running'}</StatusPill>
          <div className="sh-run__s tw-num">{dur(r.started_at, r.finished_at)}{r.rows_written != null ? ` · ${r.rows_written.toLocaleString()} rows` : ''}</div>
        </div>
      </div>
      {open && <div style={{ padding: '0 18px 14px 52px' }}><Mono>{r.log || 'No log captured for this run.'}</Mono></div>}
    </div>
  )
}

export default function SyncTab() {
  const { data, loading, error } = useHealthRpc<Sync>('system_sync')
  const [openRun, setOpenRun] = useState<number | null>(null)

  if (error) return <Empty title="Could not load sync status">{error}</Empty>
  if (!data) return <div style={{ display: 'grid', gap: 12 }}><Skeleton h={90} /><Skeleton h={260} /></div>
  const d = data!
  const last = d.modules.reduce<string | null>((m, x) => (!m || (x.last_run && x.last_run > m) ? x.last_run : m), null)
  const tone = freshTone(last)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {tone !== 'ok' && (
        <div className={`sh-banner sh-banner--${tone === 'bad' ? 'bad' : 'warn'}`}>
          <Database size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>TWF sync last ran {ago(last)}</b> ({nzTime(last)}). Expected hourly. Check the sync box and the scheduled task on the ERP server.</span>
        </div>
      )}

      <div className="sh-fresh">
        {d.modules.map((m, i) => {
          const t = freshTone(m.last_run)
          return (
            <div key={m.module} className="tw-card sh-fresh__c" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="sh-fresh__l"><Dot tone={t} pulse={t === 'ok'} />{m.module} · {MODULE_NAME[m.module] ?? ''}</div>
              <div className="sh-fresh__v">{ago(m.last_run)}</div>
              <div className="sh-fresh__s">Last ERP change {ago(m.last_modified)}</div>
            </div>
          )
        })}
        {d.tables.map((t, i) => {
          const tt = freshTone(t.synced_at)
          return (
            <div key={t.name} className="tw-card sh-fresh__c" style={{ animationDelay: `${(i + 4) * 40}ms` }}>
              <div className="sh-fresh__l"><Dot tone={tt} />{t.name}</div>
              <div className="sh-fresh__v">{ago(t.synced_at)}</div>
              <div className="sh-fresh__s">{nzTime(t.synced_at)}</div>
            </div>
          )
        })}
      </div>

      <div className="tw-grid">
        <Widget title="Sync runs" count={d.runs.length} hot={d.runs.some((r) => r.status === 'error')} style={{ gridColumn: 'span 8' }}>
          {d.runs.length ? (
            <div className="sh-timeline">
              {d.runs.map((r) => (
                <RunRow key={r.id} r={r} open={openRun === r.id} onToggle={() => setOpenRun(openRun === r.id ? null : r.id)} />
              ))}
            </div>
          ) : (
            <div className="tw-wb">
              <Empty title="No run logs yet">Runs appear once the on-prem sync script writes to sync_runs.</Empty>
            </div>
          )}
        </Widget>

        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Widget title="Other feeds">
            <div className="tw-wb">
              <div className="tw-rowx"><span><Dot tone={hoursSince(d.fx?.last_applied_at) > 26 ? 'warn' : d.fx?.last_applied_at ? 'ok' : 'idle'} />Exchange rates (daily)</span><span className="m">{ago(d.fx?.last_applied_at)}</span></div>
              <div className="tw-rowx">
                <span><Dot tone={d.portconnect_24h.total ? (d.portconnect_24h.ok === d.portconnect_24h.total ? 'ok' : 'warn') : 'idle'} />PortConnect refresh 24h</span>
                <span className="tw-num">{d.portconnect_24h.ok}/{d.portconnect_24h.total}</span>
              </div>
            </div>
          </Widget>
          <Widget title="Manual sync requests" count={d.jobs.length}>
            <div className="tw-wb">
              {d.jobs.length ? d.jobs.map((j) => (
                <div key={j.id} className="tw-rowx" title={j.message ?? ''}>
                  <span><Dot tone={j.status === 'done' ? 'ok' : j.status === 'error' ? 'bad' : 'warn'} />#{j.id} · {j.requested_by?.split('@')[0]}</span>
                  <span className="m">{nzTime(j.requested_at)}</span>
                </div>
              )) : <Empty title="None" />}
            </div>
          </Widget>
        </div>
      </div>
    </div>
  )
}
