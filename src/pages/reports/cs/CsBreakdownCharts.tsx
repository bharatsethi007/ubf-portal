import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, Title, C, NAVY, nf, glass } from '../reportsUi'
import type { CsBreakdownRow } from './csReportsApi'

function CountTip({ active, payload }: { active?: boolean; payload?: { payload: CsBreakdownRow & { name: string } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '9px 12px', borderRadius: 11 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{nf.format(p.value)}</div>
    </div>
  )
}

type Props = {
  byType: CsBreakdownRow[]
  bySeverity: CsBreakdownRow[]
  loading: boolean
}

function chartData(rows: CsBreakdownRow[]) {
  return rows.map((r) => ({ name: r.label || '—', value: Number(r.value) || 0 }))
}

function BreakdownChart({ title, data, loading }: { title: string; data: CsBreakdownRow[]; loading: boolean }) {
  const rows = chartData(data)
  return (
    <Card>
      <Title>{title}</Title>
      {loading ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>No data for this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={rows} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CountTip />} cursor={{ fill: 'rgba(10,36,114,.05)' }} />
            <Bar dataKey="value" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default function CsBreakdownCharts({ byType, bySeverity, loading }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <BreakdownChart title="By type" data={byType} loading={loading} />
      <BreakdownChart title="By severity" data={bySeverity} loading={loading} />
    </div>
  )
}
