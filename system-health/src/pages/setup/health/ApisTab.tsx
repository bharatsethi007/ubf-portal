import { useState } from 'react'
import { Empty, Skeleton } from '../../tower/towerUi'
import { type ApiRow, useHealthRpc } from './healthApi'
import { ago, fmtBytes, HourBars, ms, StatusPill, type Tone } from './healthUi'
import ApiLogDrawer from './ApiLogDrawer'

const CATS = ['AI', 'Messaging', 'Tracking', 'TMS', 'Courier', 'Storage']

/* Probe decides reachability; real traffic decides if calls are failing. */
export function apiTone(a: ApiRow): Tone {
  const errRate = a.calls ? a.errors / a.calls : 0
  if (a.probe_ok === false) return 'bad'
  if (a.calls >= 5 && errRate >= 0.5) return 'bad'
  if (errRate >= 0.1 || (a.uptime_7d != null && a.uptime_7d < 98)) return 'warn'
  if (a.probe_ok == null && !a.calls) return 'idle'
  return 'ok'
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

function ApiCard({ a, i, onOpen }: { a: ApiRow; i: number; onOpen: () => void }) {
  const tone = apiTone(a)
  const errPct = a.calls ? Math.round((a.errors / a.calls) * 100) : 0
  return (
    <button type="button" className="tw-card sh-api" style={{ animationDelay: `${i * 35}ms` }} onClick={onOpen}
      title={`Open ${a.name} call log`}>
      <div className="sh-api__top">
        <div className="sh-api__logo">{initials(a.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sh-api__name">{a.name} {a.important && <span className="sh-star" title="Important, full logs">★</span>}</div>
          <div className="sh-api__sub">{a.cost_note ?? a.category}</div>
        </div>
        <StatusPill tone={tone} />
      </div>
      <div className="sh-api__stats tw-num">
        <div>Calls<b>{a.calls.toLocaleString()}</b></div>
        <div>Errors<b className={a.errors ? 'bad' : ''}>{a.errors ? `${errPct}%` : '0'}</b></div>
        <div>Avg<b>{ms(a.avg_ms)}</b></div>
        <div>Data<b>{fmtBytes(a.bytes_out + a.bytes_in)}</b></div>
      </div>
      <HourBars data={a.series} tone={a.errors ? 'warn' : 'ok'} />
      {a.last_err_msg && tone !== 'ok' && (
        <div className="sh-api__err" title={a.last_err_msg}>{ago(a.last_err)} · {a.last_err_msg}</div>
      )}
      <div className="sh-api__foot">
        <span>Probe {a.probe_at ? `${a.probe_ok ? 'up' : 'down'} · ${ms(a.probe_ms)} · ${ago(a.probe_at)}` : 'pending'}</span>
        <span>{a.uptime_7d != null ? `${a.uptime_7d}% 7d` : ''}</span>
      </div>
    </button>
  )
}

export default function ApisTab() {
  const [hours, setHours] = useState(24)
  const [open, setOpen] = useState<ApiRow | null>(null)
  const { data, loading, error } = useHealthRpc<ApiRow[]>('system_api_summary', { p_hours: hours })

  if (error) return <Empty title="Could not load APIs">{error}</Empty>
  if (loading && !data) {
    return <div className="sh-apis">{Array.from({ length: 8 }, (_, i) => <div key={i} className="tw-card" style={{ padding: 16 }}><Skeleton h={120} /></div>)}</div>
  }
  const rows = data ?? []
  const noTraffic = rows.every((r) => r.calls === 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 14px', gap: 12, flexWrap: 'wrap' }}>
        <span className="tw-stamp">Click a card for its call log. ★ = request and response bodies kept 14 days.</span>
        <div className="sh-seg" role="group" aria-label="Window">
          {[1, 24, 168].map((h) => (
            <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)}>
              {h === 1 ? '1h' : h === 24 ? '24h' : '7d'}
            </button>
          ))}
        </div>
      </div>
      {noTraffic && (
        <div className="sh-banner sh-banner--info" style={{ marginBottom: 16 }}>
          <span>Probes are live. <b>Call counts start once edge functions switch to <code>apiFetch</code></b>, rolled out function by function.</span>
        </div>
      )}
      {CATS.map((cat) => {
        const list = rows.filter((r) => r.category === cat)
        if (!list.length) return null
        return (
          <section key={cat}>
            <div className="sh-cat">{cat}</div>
            <div className="sh-apis">
              {list.map((a, i) => <ApiCard key={a.code} a={a} i={i} onOpen={() => setOpen(a)} />)}
            </div>
          </section>
        )
      })}
      {open && <ApiLogDrawer api={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
