import { useState } from 'react'
import { Empty, Skeleton, Widget } from '../../tower/towerUi'
import { type Backend, useHealthRpc } from './healthApi'
import { ago, Dot, fmtBytes, Gauge, Mono, nzTime, ShareRow, type Tone } from './healthUi'

const pctTone = (p: number): Tone => (p >= 85 ? 'bad' : p >= 65 ? 'warn' : 'ok')

export default function BackendTab() {
  const { data, loading, error } = useHealthRpc<Backend>('system_backend')
  const [tab, setTab] = useState(0)

  if (error) return <Empty title="Could not load backend">{error}</Empty>
  if (!data) return <div style={{ display: 'grid', gap: 12 }}><Skeleton h={130} /><Skeleton h={300} /></div>
  const b = data!
  const dbPct = (b.db_bytes / b.db_limit_bytes) * 100
  const connPct = (b.conn_total / b.conn_max) * 100
  const cronFailing = b.cron.filter((c) => c.last_status === 'failed')
  const maxTable = Math.max(1, ...b.tables.map((t) => t.bytes))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tw-card" style={{ padding: '18px 20px' }}>
        <div className="sh-gauges">
          <Gauge pct={dbPct} tone={pctTone(dbPct)} label="Database size" sub={`${fmtBytes(b.db_bytes)} of ${fmtBytes(b.db_limit_bytes)}`} />
          <Gauge pct={connPct} tone={pctTone(connPct)} label="Client connections"
            sub={`${b.conn_total} of ${b.conn_max} · ${b.conn_active} active`} />
          <Gauge pct={b.cache_hit ?? 0} tone={(b.cache_hit ?? 0) >= 99 ? 'ok' : (b.cache_hit ?? 0) >= 95 ? 'warn' : 'bad'}
            label="Cache hit rate" sub="Reads served from memory" />
          <Gauge pct={b.cron_24h.ok + b.cron_24h.failed ? (b.cron_24h.ok / (b.cron_24h.ok + b.cron_24h.failed)) * 100 : 100}
            tone={b.cron_24h.failed ? 'warn' : 'ok'} label="Scheduled jobs 24h"
            sub={`${b.cron_24h.ok.toLocaleString()} ok · ${b.cron_24h.failed} failed${b.cron_24h.transient ? ` · ${b.cron_24h.transient} restarts` : ''}`} />
        </div>
        {b.long_queries > 0 && (
          <div className="tw-note"><Dot tone="warn" />{b.long_queries} quer{b.long_queries === 1 ? 'y' : 'ies'} running over 30 seconds</div>
        )}
      </div>

      <div className="tw-grid">
        <Widget title="Scheduled jobs" count={b.cron.length} hot={!!cronFailing.length} style={{ gridColumn: 'span 8' }}
          tabs={{ items: ['All jobs', `Failures 7d (${b.cron_failures.length})`, `Outbound HTTP (${b.http_24h.errors}/${b.http_24h.total})`], value: tab, onChange: setTab }}>
          <div className="tw-tw">
            {tab === 0 && (
              <table className="tw-t">
                <thead><tr><th>Job</th><th>Schedule</th><th>Last run</th><th className="r">Took</th><th className="r">Status</th></tr></thead>
                <tbody>
                  {b.cron.map((c, i) => (
                    <tr key={c.name} style={{ animationDelay: `${i * 15}ms`, cursor: 'default' }} title={c.last_msg ?? ''}>
                      <td className="ink">{c.name}</td>
                      <td className="m"><code style={{ fontSize: 12 }}>{c.schedule}</code></td>
                      <td className="m">{ago(c.last_start)}</td>
                      <td className="r tw-num m">{c.last_secs != null ? `${c.last_secs}s` : '—'}</td>
                      <td className="r">
                        {!c.active ? <span className="tw-pill tw-pill--grey">Paused</span>
                          : c.last_status === 'succeeded' ? <span className="tw-pill tw-pill--green">OK</span>
                          : c.last_status === 'failed' ? <span className="tw-pill tw-pill--red">Failed</span>
                          : <span className="tw-pill tw-pill--grey">{c.last_status ?? 'Never'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 1 && (b.cron_failures.length ? (
              <div className="tw-wb" style={{ display: 'grid', gap: 12 }}>
                {b.cron_failures.map((f, i) => (
                  <div key={i}>
                    <div className="tw-rowx" style={{ borderTop: 0 }}><span className="ink"><Dot tone="bad" />{f.name}</span><span className="m">{nzTime(f.at)}</span></div>
                    <Mono>{f.msg ?? 'No message'}</Mono>
                  </div>
                ))}
              </div>
            ) : <div className="tw-wb"><Empty title="No failures in 7 days" /></div>)}
            {tab === 2 && (b.http_errors.length ? (
              <div className="tw-wb" style={{ display: 'grid', gap: 12 }}>
                {b.http_errors.map((h, i) => (
                  <div key={i}>
                    <div className="tw-rowx" style={{ borderTop: 0 }}><span className="ink"><Dot tone="bad" />{h.status ?? 'Timeout / network'}</span><span className="m">{nzTime(h.at)}</span></div>
                    {h.msg && <Mono>{h.msg}</Mono>}
                  </div>
                ))}
              </div>
            ) : <div className="tw-wb"><Empty title="No outbound errors in 24h" /></div>)}
          </div>
        </Widget>

        <Widget title="Largest tables" style={{ gridColumn: 'span 4' }}>
          <div className="tw-wb">
            {b.tables.map((t, i) => (
              <ShareRow key={t.name} label={t.name} value={t.bytes} max={maxTable} delay={i * 40}
                right={<>{fmtBytes(t.bytes)} <span className="m" style={{ color: 'var(--faint)' }}>· {t.rows.toLocaleString()}</span></>} />
            ))}
          </div>
        </Widget>
      </div>
    </div>
  )
}
