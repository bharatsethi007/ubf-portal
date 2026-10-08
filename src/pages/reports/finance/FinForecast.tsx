import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BLUE, C, Card, KpiRail, NAVY, Title } from '../reportsUi'
import { fetchForecast } from './financeApi'
import { compact } from './financeUtil'
import { ErrorBox, Loading, MoneyTip, StatementTable, useAsync, type StmtRow } from './finUi'

const wk = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${d.toLocaleString('en-NZ', { month: 'short' })}` }

export default function FinForecast() {
  const q = useAsync(() => fetchForecast(13), [])
  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  const f = q.data ?? []
  if (!f.length) return null
  const low = f.reduce((m, r) => (r.closing < m.closing ? r : m), f[0])
  const cols = [...f.map((r) => ({ key: r.week_start, label: wk(r.week_start) }))]
  const row = (key: string, label: string, kind: StmtRow['kind'], pick: (r: (typeof f)[number]) => number): StmtRow =>
    ({ key, label, kind, values: Object.fromEntries(f.map((r) => [r.week_start, pick(r)])) })
  const rows: StmtRow[] = [
    row('open', 'Opening cash', 'line', (r) => r.opening),
    { key: 's1', label: 'Known items', kind: 'section', values: {} },
    row('ar', 'Customers paying open invoices', 'line', (r) => r.ar_existing),
    row('ap', 'Paying open supplier bills', 'line', (r) => r.ap_existing),
    { key: 's2', label: 'Run-rate (last 3 months)', kind: 'section', values: {} },
    row('nr', 'Receipts from new invoicing', 'line', (r) => r.new_receipts),
    row('np', 'Payments for new jobs', 'line', (r) => r.new_payments),
    row('pay', 'Wages and PAYE', 'line', (r) => r.payroll),
    row('ovh', 'Rent and overheads', 'line', (r) => r.overheads),
    row('tax', 'GST and tax', 'line', (r) => r.tax_gst),
    row('oth', 'Interest and loans', 'line', (r) => r.other),
    row('net', 'Net cash flow', 'sub', (r) => r.net),
    row('close', 'Closing cash', 'total', (r) => r.closing),
  ]
  const chart = f.map((r) => ({ w: wk(r.week_start), 'Net cash flow': r.net, 'Closing cash': r.closing }))
  const end = f[f.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={[
        { label: 'Cash today', value: compact(f[0].opening), accent: BLUE },
        { label: 'Lowest point', value: compact(low.closing), sub: `week of ${wk(low.week_start)}`, accent: low.closing < 250000 ? C.red : C.faint },
        { label: 'Cash in 13 weeks', value: compact(end.closing), sub: `${end.closing >= f[0].opening ? '+' : ''}${compact(end.closing - f[0].opening)}`, accent: NAVY },
        { label: 'Weekly fixed costs', value: compact(-(f[0].payroll + f[0].overheads)), sub: 'wages + overheads', accent: C.faint },
      ]} />
      <Card>
        <Title>13-week cash forecast</Title>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ left: 0, right: 8, top: 6 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="w" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(x) => compact(Number(x))} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<MoneyTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: C.ink2 }}>{v}</span>} />
              <ReferenceLine y={0} stroke={C.faint} />
              <Bar dataKey="Net cash flow" fill="#B9C4E2" radius={[3, 3, 0, 0]} />
              <Line dataKey="Closing cash" stroke={NAVY} strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card pad={0}>
        <StatementTable cols={cols} rows={rows} labelWidth={240} />
        <div style={{ padding: '10px 18px 14px', fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
          How it works: open customer invoices are expected on due date plus that customer's average days late over the last
          12 months (items over 120 days overdue are left out as doubtful; unapplied cash is netted off). Open supplier bills
          are paid on due date plus our own average days late. New-business receipts and payments ramp in over the debtor and
          creditor days. Wages, overheads, GST and tax use the last three months' actual cash run-rate. Not included: one-off
          capex, dividends, related-party advances.
        </div>
      </Card>
    </div>
  )
}
