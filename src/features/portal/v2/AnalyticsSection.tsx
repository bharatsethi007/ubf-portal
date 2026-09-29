import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PortMap } from '../../../hooks/usePorts'
import type { Analytics } from './usePortalHome'
import { fmtMoney, fmtNum, placeName, shortCode } from './homeModel'

const NAVY = '#0B1A3A'
const ORANGE = '#F7941D'

function monthLabel(m: string): string {
  const d = new Date(`${m}-01T00:00:00`)
  return d.toLocaleDateString('en-NZ', { month: 'short' })
}

function ChartTip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="pv3-tip">
      <div className="pv3-tip__label">{label ? new Date(`${label}-01T00:00:00`).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' }) : ''}</div>
      {payload.map((p) => (
        <div key={p.name} className="pv3-tip__row"><i style={{ background: p.color }} />{p.name}<b>{money ? fmtMoney(p.value) : fmtNum(p.value)}</b></div>
      ))}
    </div>
  )
}

export default function AnalyticsSection({ data, ports, currency }: { data: Analytics | null; ports: PortMap; currency: string }) {
  if (!data) {
    return (
      <div className="pv3-analytics">
        {[0, 1, 2].map((i) => <div key={i} className="pv3-card pv3-skel-card" />)}
      </div>
    )
  }
  const t = data.totals
  const hasAir = data.months.some((m) => m.air > 0)
  const hasSea = data.months.some((m) => m.sea > 0)
  const maxLane = Math.max(1, ...data.lanes.map((l) => l.n))
  const ot = data.ontime.n >= 5 ? Math.round((data.ontime.on_time / data.ontime.n) * 100) : null

  return (
    <>
      <div className="pv3-section-head">
        <h2>Analytics</h2>
        <span className="pv3-muted">Last 12 months</span>
      </div>
      <div className="pv3-totals pv3-rise" style={{ animationDelay: '.1s' }}>
        <div><span>Shipments</span><b>{fmtNum(t.shipments)}</b></div>
        {t.teu > 0 && <div><span>TEU</span><b>{fmtNum(t.teu)}</b></div>}
        <div><span>Weight</span><b>{fmtNum(t.kg / 1000, true)} t</b></div>
        <div><span>Volume</span><b>{fmtNum(t.cbm)} m³</b></div>
        <div><span>Freight spend</span><b>{fmtMoney(t.spend, currency, true)}</b></div>
        {ot !== null && <div><span>On time</span><b>{ot}%</b></div>}
      </div>

      <div className="pv3-analytics">
        <section className="pv3-card pv3-chart pv3-rise" style={{ animationDelay: '.15s' }}>
          <header className="pv3-card__head"><h2>Shipments per month</h2>
            <div className="pv3-legend pv3-legend--inline">
              {hasSea && <span><i className="pv3-legend__sq" style={{ background: NAVY }} />Sea</span>}
              {hasAir && <span><i className="pv3-legend__sq" style={{ background: ORANGE }} />Air</span>}
            </div>
          </header>
          <div className="pv3-chart__body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.months} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF0F4" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip cursor={{ fill: 'rgba(11,26,58,.04)' }} content={<ChartTip />} />
                {hasSea && <Bar dataKey="sea" name="Sea" stackId="a" fill={NAVY} radius={hasAir ? [0, 0, 0, 0] : [4, 4, 0, 0]} animationDuration={900} />}
                {hasAir && <Bar dataKey="air" name="Air" stackId="a" fill={ORANGE} radius={[4, 4, 0, 0]} animationDuration={900} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="pv3-card pv3-chart pv3-rise" style={{ animationDelay: '.22s' }}>
          <header className="pv3-card__head"><h2>Freight spend</h2><span className="pv3-muted">{fmtMoney(t.spend, currency)}</span></header>
          <div className="pv3-chart__body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.months} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pv3-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF0F4" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickFormatter={(v: number) => fmtMoney(v, currency, true)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} width={56} />
                <Tooltip content={<ChartTip money />} />
                <Area type="monotone" dataKey="spend" name="Spend" stroke="#2563EB" strokeWidth={2} fill="url(#pv3-spend)" animationDuration={1100} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="pv3-card pv3-lanes pv3-rise" style={{ animationDelay: '.29s' }}>
          <header className="pv3-card__head"><h2>Top lanes</h2><span className="pv3-muted">Avg transit</span></header>
          {data.lanes.length === 0 ? <p className="pv3-muted">No lanes yet.</p> : (
            <ul>
              {data.lanes.slice(0, 6).map((l, i) => {
                const days = l.transit_days ?? l.sched_days
                return (
                  <li key={`${l.origin}-${l.destination}-${l.mode}`}>
                    <div className="pv3-lanes__row">
                      <span className="pv3-lanes__name" title={`${placeName(l.origin, ports)} to ${placeName(l.destination, ports)}`}>
                        <b className="pv3-mono">{shortCode(l.origin)} → {shortCode(l.destination)}</b>
                        <span>{placeName(l.origin, ports)} to {placeName(l.destination, ports)}</span>
                      </span>
                      <span className="pv3-lanes__n">{l.n}</span>
                      <span className="pv3-lanes__days">{days != null ? `${Math.round(days)} d` : '—'}</span>
                    </div>
                    <span className="pv3-lanes__bar"><span style={{ width: `${(l.n / maxLane) * 100}%`, animationDelay: `${0.4 + i * 0.07}s` }} /></span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="pv3-foot">Transit from actual dates where known, otherwise scheduled.</p>
        </section>
      </div>
    </>
  )
}
