import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, Title, C, NAVY, nf, glass } from '../reportsUi'
import type { CsatTrendRow } from './csatApi'

const NAVY_COLOR = '#0A2472'

function TrendTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; csat_pct: number | null; responses: number } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '9px 12px', borderRadius: 11 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
      <div style={{ fontSize: 12, color: NAVY_COLOR }}>CSAT {p.csat_pct != null ? `${Number(p.csat_pct).toFixed(1)}%` : '—'}</div>
      <div style={{ fontSize: 11, color: C.mut }}>{nf.format(p.responses)} responses</div>
    </div>
  )
}

type Props = { rows: CsatTrendRow[]; loading: boolean }

export default function CsatTrendChart({ rows, loading }: Props) {
  const data = rows.map((r) => ({
    label: r.period?.slice(0, 10) ?? '—',
    csat_pct: r.csat_pct != null ? Number(r.csat_pct) : null,
    responses: Number(r.responses) || 0,
  }))

  return (
    <Card>
      <Title>CSAT trend</Title>
      {loading ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>No CSAT data for this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
            <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis yAxisId="count" orientation="right" hide />
            <Tooltip content={<TrendTip />} />
            <Bar yAxisId="count" dataKey="responses" fill="rgba(10,36,114,0.08)" radius={[3, 3, 0, 0]} maxBarSize={32} />
            <Line yAxisId="pct" type="monotone" dataKey="csat_pct" stroke={NAVY_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: NAVY_COLOR }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
