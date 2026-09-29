import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoney, fmtNum } from '../homeModel'
import { AIR, SEA, money2, monthLong, monthShort, type AMonth } from './analyticsApi'

const AXIS = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: '#64748B' } } as const
const GRID = <CartesianGrid vertical={false} stroke="#EEF0F4" />

type Fmt = (v: number) => string
type TipProps = { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; fmt: Fmt }

function Tip({ active, payload, label, fmt }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="pv3-tip">
      <div className="pv3-tip__label">{label ? monthLong(label) : ''}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="pv3-tip__row"><i style={{ background: p.color }} />{p.name}<b>{fmt(p.value)}</b></div>
      ))}
    </div>
  )
}

function Card({ title, value, sub, legend, children, delay }: { title: string; value?: string; sub?: string; legend?: { c: string; l: string }[]; children: ReactNode; delay: number }) {
  return (
    <section className="pv3-card pv3-chart pv3-rise" style={{ animationDelay: `${delay}s` }}>
      <header className="pv3-an__chead">
        <div>
          <h2>{title}</h2>
          {sub && <span className="pv3-muted">{sub}</span>}
        </div>
        {value && <b className="pv3-an__cval">{value}</b>}
      </header>
      {legend && legend.length > 1 && (
        <div className="pv3-legend pv3-legend--inline">{legend.map((x) => <span key={x.l}><i className="pv3-legend__sq" style={{ background: x.c }} />{x.l}</span>)}</div>
      )}
      <div className="pv3-chart__body">{children}</div>
    </section>
  )
}

/** Shipments per month, sea and air stacked, with a surface gap between segments. */
export function VolumeChart({ months, delay }: { months: AMonth[]; delay: number }) {
  const hasSea = months.some((m) => m.sea > 0), hasAir = months.some((m) => m.air > 0)
  const total = months.reduce((n, m) => n + m.sea + m.air, 0)
  const legend = [hasSea && { c: SEA, l: 'Sea' }, hasAir && { c: AIR, l: 'Air' }].filter(Boolean) as { c: string; l: string }[]
  return (
    <Card title="Shipments" sub="Booked per month" value={fmtNum(total)} legend={legend} delay={delay}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={months} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          {GRID}
          <XAxis dataKey="month" tickFormatter={monthShort} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip cursor={{ fill: 'rgba(11,26,58,.04)' }} content={<Tip fmt={(v) => fmtNum(v)} />} />
          {hasSea && <Bar dataKey="sea" name="Sea" stackId="m" fill={SEA} stroke="#FFFFFF" strokeWidth={2} radius={hasAir ? 0 : [4, 4, 0, 0]} animationDuration={800} />}
          {hasAir && <Bar dataKey="air" name="Air" stackId="m" fill={AIR} stroke="#FFFFFF" strokeWidth={2} radius={[4, 4, 0, 0]} animationDuration={800} />}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function SpendChart({ months, total, delay }: { months: AMonth[]; total: number; delay: number }) {
  return (
    <Card title="Freight spend" sub="Invoiced per month, NZD" value={fmtMoney(total, 'NZD', true)} delay={delay}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={months} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pv3-an-spend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEA} stopOpacity={0.22} /><stop offset="100%" stopColor={SEA} stopOpacity={0} />
            </linearGradient>
          </defs>
          {GRID}
          <XAxis dataKey="month" tickFormatter={monthShort} {...AXIS} />
          <YAxis tickFormatter={(v: number) => fmtMoney(v, 'NZD', true)} width={56} {...AXIS} />
          <Tooltip content={<Tip fmt={(v) => fmtMoney(v, 'NZD')} />} />
          <Area type="monotone" dataKey="spend" name="Spend" stroke={SEA} strokeWidth={2} fill="url(#pv3-an-spend)" activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2 }} animationDuration={1000} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

/** Freight cost per kg shipped, by month. Months with no weight are left as gaps. */
export function CostPerKgChart({ months, delay }: { months: AMonth[]; delay: number }) {
  const data = months.map((m) => ({ month: m.month, cpk: m.kg > 0 && m.spend > 0 ? Math.round((m.spend / m.kg) * 100) / 100 : null }))
  const vals = data.map((d) => d.cpk).filter((v): v is number => v != null)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  return (
    <Card title="Cost per kg" sub="Freight spend ÷ weight booked" value={avg != null ? `${money2(avg)} avg` : undefined} delay={delay}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="month" tickFormatter={monthShort} {...AXIS} />
          <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={52} {...AXIS} />
          <Tooltip content={<Tip fmt={(v) => `${money2(v)} / kg`} />} />
          <Line type="monotone" dataKey="cpk" name="Cost per kg" stroke={SEA} strokeWidth={2} dot={{ r: 4, fill: SEA, stroke: '#FFFFFF', strokeWidth: 2 }} connectNulls={false} animationDuration={1000} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function EmissionsChart({ months, total, delay }: { months: AMonth[]; total: number; delay: number }) {
  const data = months.map((m) => ({ month: m.month, t: Math.round(m.co2_kg / 100) / 10 }))
  return (
    <Card title="Emissions" sub="CO₂e estimate, tonnes (GLEC defaults)" value={`${fmtNum(total / 1000, true)} t`} delay={delay}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          {GRID}
          <XAxis dataKey="month" tickFormatter={monthShort} {...AXIS} />
          <YAxis {...AXIS} />
          <Tooltip cursor={{ fill: 'rgba(11,26,58,.04)' }} content={<Tip fmt={(v) => `${v} t CO₂e`} />} />
          <Bar dataKey="t" name="CO₂e" fill="#0F766E" radius={[4, 4, 0, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
