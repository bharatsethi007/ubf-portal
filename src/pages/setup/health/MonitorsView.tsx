import { useHealthRpc, type ApiRow } from './healthApi'
import { ago, fmtBytes, ms, type Tone } from './healthUi'
import type { Uptime, UptimeDay } from './logsApi'

export function apiTone(a: ApiRow): Tone {
  const errRate = a.calls ? a.errors / a.calls : 0
  if (a.probe_ok === false) return 'bad'
  if (a.calls >= 5 && errRate >= 0.5) return 'bad'
  if (errRate >= 0.1) return 'warn'
  if (a.probe_ok == null && !a.calls) return 'idle'
  return 'ok'
}
const LABEL: Record<Tone, string> = { ok: 'Up', warn: 'Degraded', bad: 'Down', idle: 'Pending' }

function dayTone(d: UptimeDay): string {
  if (!d.n) return ''
  const p = d.ok / d.n
  return p >= 0.999 ? 'ok' : p >= 0.9 ? 'warn' : 'bad'
}

function Bars({ days }: { days: UptimeDay[] | undefined }) {
  const list = days ?? []
  return (
    <div className="bs-up" aria-hidden="true">
      {list.map((d) => (
        <i key={d.d} className={dayTone(d)}
          title={`${new Date(d.d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} · ${d.n ? `${Math.round((d.ok / d.n) * 1000) / 10}% of ${d.n} checks` : 'no data'}`} />
      ))}
    </div>
  )
}

function pct(days: UptimeDay[] | undefined): string {
  const n = (days ?? []).reduce((a, d) => a + d.n, 0)
  const ok = (days ?? []).reduce((a, d) => a + d.ok, 0)
  return n ? `${(Math.floor((ok / n) * 10000) / 100).toFixed(2)}%` : '—'
}

export default function MonitorsView({ onOpen }: { onOpen: (code: string) => void }) {
  const { data: rows, error } = useHealthRpc<ApiRow[]>('system_api_summary', { p_hours: 24 })
  const { data: up } = useHealthRpc<Uptime>('system_uptime', { p_days: 30 }, 300_000)
  if (error) return <div className="bs-panel bs-empty"><b>Could not load monitors</b>{error}</div>

  const list = rows ?? []
  const counts = list.reduce((a, r) => { a[apiTone(r)]++; return a }, { ok: 0, warn: 0, bad: 0, idle: 0 } as Record<Tone, number>)

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['ok', 'warn', 'bad'] as Tone[]).map((t) => (
          <div key={t} className="bs-panel" style={{ padding: '12px 16px', minWidth: 150, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`bs-dot bs-dot--${t}`} />
            <span style={{ color: 'var(--muted)' }}>{LABEL[t]}</span>
            <b className="bs-num" style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--ink)' }}>{counts[t]}</b>
          </div>
        ))}
        <div className="bs-panel" style={{ padding: '12px 16px', flex: 1, minWidth: 220, color: 'var(--muted)', fontSize: 12.5, display: 'flex', alignItems: 'center' }}>
          Probed every 15 min, unauthenticated, never billed. Calls and errors are real traffic, last 24h.
        </div>
      </div>

      <div className="bs-panel" style={{ overflowX: 'auto' }}>
        <table className="bs-mon">
          <thead>
            <tr>
              <th>Monitor</th><th>Status</th><th className="r">Calls 24h</th><th className="r">Errors</th>
              <th className="r">Avg · p95</th><th className="r">Data</th><th>Checked</th><th>Last 30 days</th><th className="r">Uptime</th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 8 }, (_, i) => (
              <tr key={i}><td colSpan={9}><div className="tw-skel" style={{ height: 22 }} /></td></tr>
            ))}
            {list.map((a) => {
              const t = apiTone(a)
              return (
                <tr key={a.code} onClick={() => onOpen(a.code)} title={`Open ${a.name} logs`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`bs-dot bs-dot--${t}${t === 'bad' ? ' bs-dot--pulse' : ''}`} />
                      <div>
                        <div className="name">{a.name}{a.important && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 11 }}>●</span>}</div>
                        <div className="sub">{a.category} · {a.cost_note}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`bs-state ${t === 'bad' ? 'bs-state--open' : t === 'ok' ? 'bs-state--res' : ''}`}
                      style={t === 'warn' ? { background: 'var(--amber-soft)', color: 'var(--amber)' } : t === 'idle' ? { background: 'var(--line-soft)', color: 'var(--muted)' } : undefined}>
                      {LABEL[t]}
                    </span>
                    {a.last_err_msg && t !== 'ok' && <div className="sub bs-mono" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--red)' }} title={a.last_err_msg}>{a.last_err_msg}</div>}
                  </td>
                  <td className="r bs-num">{a.calls.toLocaleString()}</td>
                  <td className="r bs-num" style={{ color: a.errors ? 'var(--red)' : 'var(--faint)' }}>{a.errors}</td>
                  <td className="r bs-mono" style={{ fontSize: 12 }}>{ms(a.avg_ms)} · {ms(a.p95_ms)}</td>
                  <td className="r bs-mono" style={{ fontSize: 12 }}>{fmtBytes(a.bytes_out + a.bytes_in)}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.probe_at ? `${ago(a.probe_at)} · ${ms(a.probe_ms)}` : 'pending'}</td>
                  <td><Bars days={up?.[a.code]} /></td>
                  <td className="r bs-mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{pct(up?.[a.code])}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
