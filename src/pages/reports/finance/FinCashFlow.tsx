import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BLUE, C, Card, KpiRail, NAVY, Seg, Title } from '../reportsUi'
import { fetchCashflow, type CfRow } from './financeApi'
import { compact, monthLabel } from './financeUtil'
import { ErrorBox, Loading, MoneyTip, StatementTable, useAsync, type StmtCol, type StmtRow } from './finUi'
import type { FinPeriod } from './FinanceTab'

const SECTIONS: { k: string; label: string }[] = [
  { k: 'operating', label: 'Operating activities' }, { k: 'investing', label: 'Investing activities' },
  { k: 'financing', label: 'Financing activities' }, { k: 'fx', label: 'Exchange rate effect' },
]
const OP_ORDER = ['Receipts from customers', 'Disbursements recovered from clients', 'Payments to carriers & suppliers',
  'Customs duty & GST paid for clients', 'Payments to staff & PAYE', 'Overheads & rent paid', 'GST paid / refunded',
  'Income tax & RWT', 'Interest received', 'Interest paid', 'Other income received', 'Other operating']

export default function FinCashFlow({ p }: { p: FinPeriod }) {
  const [mode, setMode] = useState<'total' | 'monthly'>('total')
  const q = useAsync(() => fetchCashflow(p.fromMonth, p.toMonth), [p.fromMonth, p.toMonth])

  const v = useMemo(() => {
    if (!q.data) return null
    const flows = q.data.filter((r) => r.cf_section !== 'balance')
    const closing = new Map(q.data.filter((r) => r.cf_section === 'balance').map((r) => [r.month, r.amount]))
    const net = (m: string) => flows.filter((r) => r.month === m).reduce((a, r) => a + r.amount, 0)
    const opening = new Map<string, number>()
    p.months.forEach((m, i) => opening.set(m, i ? closing.get(p.months[i - 1]) ?? 0 : (closing.get(m) ?? 0) - net(m)))

    const cols: StmtCol[] = mode === 'monthly'
      ? [...p.months.map((m) => ({ key: m, label: monthLabel(m) })), { key: 'tot', label: 'YTD', strong: true }]
      : [{ key: 'tot', label: p.label.replace(/ YTD.*/, ' YTD'), strong: true }]
    const vals = (rs: CfRow[]) => {
      const o: Record<string, number | null> = {}
      for (const m of p.months) o[m] = rs.filter((r) => r.month === m).reduce((a, r) => a + r.amount, 0)
      o.tot = rs.reduce((a, r) => a + r.amount, 0)
      return o
    }
    const rows: StmtRow[] = []
    for (const s of SECTIONS) {
      const sr = flows.filter((r) => r.cf_section === s.k)
      if (!sr.length) continue
      rows.push({ key: s.k, label: s.label, kind: 'section', values: {} })
      const lines = [...new Set(sr.map((r) => r.cf_line))].sort((a, b) => {
        const ia = OP_ORDER.indexOf(a), ib = OP_ORDER.indexOf(b)
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
        return Math.abs(sr.filter((r) => r.cf_line === b).reduce((x, r) => x + r.amount, 0)) - Math.abs(sr.filter((r) => r.cf_line === a).reduce((x, r) => x + r.amount, 0))
      })
      for (const l of lines) rows.push({ key: `${s.k}-${l}`, label: l, kind: 'line', values: vals(sr.filter((r) => r.cf_line === l)) })
      rows.push({ key: `t-${s.k}`, label: `Net cash from ${s.label.toLowerCase()}`, kind: 'sub', values: vals(sr) })
    }
    const nv = vals(flows)
    rows.push({ key: 'net', label: 'Net change in cash', kind: 'total', values: nv })
    const ov: Record<string, number | null> = {}, cv: Record<string, number | null> = {}
    for (const m of p.months) { ov[m] = opening.get(m) ?? 0; cv[m] = closing.get(m) ?? 0 }
    ov.tot = opening.get(p.months[0]) ?? 0; cv.tot = closing.get(p.toMonth) ?? 0
    rows.push({ key: 'open', label: 'Opening cash', kind: 'line', values: ov })
    rows.push({ key: 'close', label: 'Closing cash', kind: 'total', values: cv })

    const op = flows.filter((r) => r.cf_section === 'operating').reduce((a, r) => a + r.amount, 0)
    const capex = flows.filter((r) => r.cf_line === 'Purchase of fixed assets').reduce((a, r) => a + r.amount, 0)
    const recon = Math.abs((cv.tot ?? 0) - (ov.tot ?? 0) - (nv.tot ?? 0))
    const chart = p.months.map((m) => ({ m: monthLabel(m), 'Operating cash flow': flows.filter((r) => r.month === m && r.cf_section === 'operating').reduce((a, r) => a + r.amount, 0), 'Closing cash': closing.get(m) ?? 0 }))
    return { cols, rows, op, capex, close: cv.tot ?? 0, open: ov.tot ?? 0, recon, chart }
  }, [q.data, mode, p])

  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  if (!v) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={[
        { label: 'Opening cash', value: compact(v.open), accent: C.faint },
        { label: 'Operating cash flow', value: compact(v.op), accent: v.op >= 0 ? C.green : C.red },
        { label: 'Capital spend', value: compact(v.capex), accent: C.faint },
        { label: 'Free cash flow', value: compact(v.op + v.capex), sub: 'operating less capex', accent: NAVY },
        { label: 'Closing cash', value: compact(v.close), accent: BLUE },
      ]} />
      <Card>
        <Title>Operating cash flow and month-end cash</Title>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={v.chart} margin={{ left: 0, right: 8, top: 6 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(x) => compact(Number(x))} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<MoneyTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: C.ink2 }}>{v}</span>} />
              <Bar dataKey="Operating cash flow" fill="#B9C4E2" radius={[3, 3, 0, 0]} />
              <Line dataKey="Closing cash" stroke={BLUE} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card pad={0}>
        <div style={{ padding: '16px 18px 4px' }}>
          <Title right={<Seg options={[{ k: 'total', label: 'Year to date' }, { k: 'monthly', label: 'By month' }]} value={mode} onChange={(k) => setMode(k as 'total' | 'monthly')} />}>
            Cash flow statement (direct method)
          </Title>
        </div>
        <StatementTable cols={v.cols} rows={v.rows} labelWidth={300} />
        <div style={{ padding: '10px 18px 14px', fontSize: 11.5, color: v.recon > 1 ? C.red : C.mut }}>
          Built from every bank movement in the GL, classified by the other side of each entry. {v.recon > 1 ? `Does not tie to bank balances by ${compact(v.recon)}.` : 'Ties exactly to bank balances.'}{' '}
          Supplier payments are split using each supplier's billing mix; customer receipts split by share of disbursement invoices.
        </div>
      </Card>
    </div>
  )
}
