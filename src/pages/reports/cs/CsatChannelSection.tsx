import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, Title, C, nf, glass } from '../reportsUi'
import { fmtPct } from './CsatKpiCards'
import type { CsatByChannelRow } from './csatApi'

const NAVY_COLOR = '#0A2472'

function labelChannel(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase())
}

type Props = { rows: CsatByChannelRow[]; loading: boolean }

export default function CsatChannelSection({ rows, loading }: Props) {
  const chartData = rows.map((r) => ({
    name: labelChannel(r.channel || '—'),
    avg_score: r.avg_score != null ? Number(r.avg_score) : 0,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <Title>Avg score by channel</Title>
        {loading ? (
          <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0 }}>No channel data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '9px 12px', borderRadius: 11 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{payload[0].payload.name}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY_COLOR }}>{Number(payload[0].value).toFixed(2)} / 5</div>
                  </div>
                )
              }} cursor={{ fill: 'rgba(10,36,114,.05)' }} />
              <Bar dataKey="avg_score" fill={NAVY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>By channel</h3>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Responses</th>
                <th>CSAT %</th>
                <th>Response rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="text-muted-foreground">No channel data.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.channel}>
                  <td>{labelChannel(r.channel || '—')}</td>
                  <td>{r.responses}</td>
                  <td>{fmtPct(r.csat_pct, false)}</td>
                  <td>{fmtPct(r.response_rate, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
