import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BLUE, C, Card, KpiRail, NAVY, ORANGE, Th, Td, Title } from '../reportsUi'
import { fetchAging, fetchFlags, fetchForecast, fetchKpis, fetchPl } from './financeApi'
import { buildInsights } from './financeInsights'
import { DATA_START, compact, growth, money, monthLabel, pct, ratio, serviceLines, totals, unpostedCosts } from './financeUtil'
import { Banner, ErrorBox, Loading, MoneyTip, toneColor, useAsync } from './finUi'
import type { FinPeriod } from './FinanceTab'

export default function FinOverview({ p }: { p: FinPeriod }) {
  const plFrom = p.hasLy ? p.lyMonths[0] : p.fromMonth
  const q = useAsync(() => Promise.all([
    fetchKpis(DATA_START, p.toMonth), fetchPl(plFrom, p.toMonth), fetchAging('D'), fetchForecast(13), fetchFlags(),
  ]), [p.toMonth, plFrom])

  const m = useMemo(() => {
    if (!q.data) return null
    const [kpis, pl, aging, forecast, flags] = q.data
    const adj = unpostedCosts(kpis)
    const cur = totals(kpis, p.months, adj, p.useAdj)
    const prev = p.hasLy ? totals(kpis, p.lyMonths, adj, p.useAdj) : null
    const slCur = serviceLines(pl, p.months), slPrev = p.hasLy ? serviceLines(pl, p.lyMonths) : []
    const insights = buildInsights({ cur, prev, periodLabel: p.label, slCur, slPrev, kpis: kpis.filter((k) => k.month <= p.toMonth), aging, forecast, flags })
    const chart = kpis.filter((k) => k.month <= p.toMonth).map((k) => {
      const a = p.useAdj ? adj[k.month] ?? 0 : 0
      return { m: monthLabel(k.month), Revenue: k.revenue, 'Gross profit': k.gross_profit - a, EBIT: k.ebit - a }
    })
    const last = kpis.find((k) => k.month === p.toMonth)
    const openAdj = adj[p.toMonth] ?? 0
    return { cur, prev, slCur, slPrev, insights, chart, last, flags, openAdj }
  }, [q.data, p])

  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  if (!m) return null
  const { cur, prev } = m
  const d = (a: number, b?: number) => (prev && b ? `${(growth(a, b) ?? 0) >= 0 ? '+' : ''}${pct(growth(a, b), 0)} vs LY` : undefined)
  const arTot = q.data![2].reduce((s, r) => s + Math.max(0, r.total), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {m.openAdj > 50000 && (
        <Banner tone="bad">{monthLabel(p.toMonth)} is not closed in TradeWindow: {compact(m.openAdj)} of supplier invoices are not yet
          costed to jobs. {p.useAdj ? 'Figures below include them as "Job costs not yet posted".' : 'Turn on "Add back unposted job costs" for a realistic margin.'}</Banner>
      )}
      <KpiRail items={[
        { label: 'Revenue', value: compact(cur.revenue), delta: d(cur.revenue, prev?.revenue), accent: NAVY },
        { label: 'Gross profit', value: compact(cur.gp), delta: d(cur.gp, prev?.gp), sub: `${pct(ratio(cur.gp, cur.revenue))} margin`, accent: ORANGE },
        { label: 'Overheads', value: compact(cur.opex), delta: d(cur.opex, prev?.opex), sub: `${pct(ratio(cur.opex, cur.gp), 0)} of GP`, accent: C.faint },
        { label: 'Operating profit', value: compact(cur.ebit), delta: d(cur.ebit, prev?.ebit), sub: `${pct(ratio(cur.ebit, cur.revenue))} of revenue`, accent: C.green },
        { label: 'Net profit before tax', value: compact(cur.net), delta: d(cur.net, prev?.net), accent: C.green },
        { label: 'Cash', value: compact(m.last?.cash ?? 0), sub: `at ${monthLabel(p.toMonth)}`, accent: BLUE },
        { label: 'Owed by customers', value: compact(arTot), sub: 'open invoices today', accent: C.red },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <Card>
          <Title>CFO commentary</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.insights.map((i, k) => {
              const c = toneColor(i.tone)
              return (
                <div key={k} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 3, borderRadius: 3, background: c.fg, flex: '0 0 3px' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{i.title}</div>
                    <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 2 }}>{i.body}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
        <Card>
          <Title>Monthly revenue, gross profit and operating profit</Title>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={m.chart} margin={{ left: 0, right: 8, top: 6 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => compact(Number(v))} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<MoneyTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: C.ink2 }}>{v}</span>} />
                <Bar dataKey="Revenue" fill="#B9C4E2" radius={[3, 3, 0, 0]} />
                <Line dataKey="Gross profit" stroke={ORANGE} strokeWidth={2} dot={false} />
                <Line dataKey="EBIT" stroke={NAVY} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: '16px 18px 0' }}><Title>Gross profit by service line</Title></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><Th>Service line</Th><Th right>Revenue</Th><Th right>Direct cost</Th><Th right>Gross profit</Th><Th right>Margin</Th><Th right>Share of GP</Th>{prev && <><Th right>GP last year</Th><Th right>Change</Th></>}</tr></thead>
          <tbody>
            {m.slCur.filter((s) => s.revenue || s.cost).map((s) => {
              const ly = m.slPrev.find((x) => x.line === s.line)
              const tot = m.slCur.reduce((a, x) => a + x.gp, 0)
              return (
                <tr key={s.line} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td strong>{s.line}</Td><Td right>{money(s.revenue)}</Td><Td right>{money(s.cost)}</Td>
                  <Td right strong>{money(s.gp)}</Td><Td right>{pct(s.margin)}</Td><Td right muted>{pct(ratio(s.gp, tot), 0)}</Td>
                  {prev && <><Td right muted>{ly ? money(ly.gp) : '–'}</Td><Td right>{ly ? pct(growth(s.gp, ly.gp), 0) : '–'}</Td></>}
                </tr>
              )
            })}
            {cur.adj !== 0 && (
              <tr style={{ borderTop: `1px solid ${C.line}` }}>
                <Td muted>Job costs not yet posted</Td><Td right /><Td right>{money(cur.adj)}</Td><Td right>{money(-cur.adj)}</Td>
                <Td right /><Td right /><Td right />{prev && <><Td right /><Td right /></>}
              </tr>
            )}
            <tr style={{ borderTop: `1px solid ${C.border}`, background: '#F7F8FB' }}>
              <Td strong>Total</Td><Td right strong>{money(cur.revenue)}</Td><Td right strong>{money(cur.cos)}</Td>
              <Td right strong>{money(cur.gp)}</Td><Td right strong>{pct(ratio(cur.gp, cur.revenue))}</Td><Td right />
              {prev && <><Td right strong>{money(prev.gp)}</Td><Td right strong>{pct(growth(cur.gp, prev.gp), 0)}</Td></>}
            </tr>
          </tbody>
        </table>
        <div style={{ padding: '10px 18px 14px', fontSize: 11.5, color: C.mut }}>
          Service lines follow the GL revenue and cost accounts. Unposted job costs are not split by line, so line margins for an open month read high.
        </div>
      </Card>
    </div>
  )
}
