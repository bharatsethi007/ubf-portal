import { useMemo, useState } from 'react'
import { C, Card, Seg, Title } from '../reportsUi'
import { fetchKpis, fetchPl, fetchPlAccounts, type PlRow } from './financeApi'
import { DATA_START, money, monthLabel, ratio, unpostedCosts, type AdjMap } from './financeUtil'
import { ErrorBox, Loading, StatementTable, useAsync, type StmtCol, type StmtRow } from './finUi'
import type { FinPeriod } from './FinanceTab'

type Mode = 'monthly' | 'compare'
const GROUPS = ['Revenue', 'Cost of sales', 'Other operating income', 'Operating expenses', 'Other income', 'Finance costs', 'Income tax']
const ADJ = 'Job costs not yet posted'

export default function FinPnl({ p }: { p: FinPeriod }) {
  const [mode, setMode] = useState<Mode>(p.hasLy ? 'compare' : 'monthly')
  const [drill, setDrill] = useState<{ group: string; line: string } | null>(null)
  const plFrom = p.hasLy ? p.lyMonths[0] : p.fromMonth
  const q = useAsync(() => Promise.all([fetchPl(plFrom, p.toMonth), fetchKpis(DATA_START, p.toMonth)]), [plFrom, p.toMonth])

  const table = useMemo(() => {
    if (!q.data) return null
    const [pl, kpis] = q.data
    const adj: AdjMap = p.useAdj ? unpostedCosts(kpis) : {}
    const cols: StmtCol[] = mode === 'monthly'
      ? [...p.months.map((m) => ({ key: m, label: monthLabel(m) })), { key: 'tot', label: 'YTD', strong: true }]
      : [{ key: 'cur', label: p.label.replace(/ YTD.*/, ' YTD'), strong: true }, { key: 'ly', label: 'Last year YTD' },
         { key: 'var', label: 'Change' }, { key: 'varp', label: 'Change %', pct: true }]
    // value of a set of P&L rows for every column
    const val = (rows: PlRow[], extra: (m: string) => number = () => 0) => {
      const sum = (ms: string[]) => rows.filter((r) => ms.includes(r.month)).reduce((a, r) => a + r.amount, 0) + ms.reduce((a, m) => a + extra(m), 0)
      const v: Record<string, number | null> = {}
      if (mode === 'monthly') { for (const m of p.months) v[m] = sum([m]); v.tot = sum(p.months) }
      else { const c = sum(p.months), l = sum(p.lyMonths); v.cur = c; v.ly = l; v.var = c - l; v.varp = l ? ((c - l) / Math.abs(l)) * 100 : null }
      return v
    }
    const adjFn = (m: string) => -(adj[m] ?? 0)
    const rows: StmtRow[] = []
    const groupRows = (g: string) => pl.filter((r) => r.pl_group === g)
    const sumRows = (gs: string[]) => pl.filter((r) => gs.includes(r.pl_group))
    const pctRow = (key: string, label: string, num: Record<string, number | null>, den: Record<string, number | null>) => {
      const v: Record<string, number | null> = {}
      for (const c of cols) if (c.key !== 'varp') v[c.key] = c.key === 'var' ? null : ratio(num[c.key] ?? 0, den[c.key] ?? 0)
      rows.push({ key, label, kind: 'pct', values: v })
    }
    const revenue = val(groupRows('Revenue'))
    for (const g of GROUPS) {
      const gr = groupRows(g)
      const hasAdj = g === 'Cost of sales' && Object.keys(adj).some((m) => p.months.includes(m) || p.lyMonths.includes(m))
      if (!gr.length && !hasAdj) continue
      rows.push({ key: `s-${g}`, label: g, kind: 'section', values: {} })
      const lines = [...new Set(gr.map((r) => r.pl_line))]
        .map((l) => ({ l, t: gr.filter((r) => r.pl_line === l).reduce((a, r) => a + Math.abs(r.amount), 0) }))
        .sort((a, b) => b.t - a.t)
      for (const { l } of lines) {
        rows.push({ key: `${g}-${l}`, label: l, kind: 'line', values: val(gr.filter((r) => r.pl_line === l)), onClick: () => setDrill({ group: g, line: l }) })
      }
      if (hasAdj) rows.push({ key: 'adj', label: ADJ, kind: 'memo', values: val([], adjFn), note: 'Supplier invoices received but not yet costed to jobs in TradeWindow (Accruals 23000 debit).' })
      rows.push({ key: `t-${g}`, label: `Total ${g.toLowerCase()}`, kind: 'sub', values: val(gr, g === 'Cost of sales' ? adjFn : undefined) })
      if (g === 'Cost of sales') {
        const gp = val(sumRows(['Revenue', 'Cost of sales']), adjFn)
        rows.push({ key: 'gp', label: 'Gross profit', kind: 'total', values: gp })
        pctRow('gpm', 'Gross margin', gp, revenue)
      }
      if (g === 'Operating expenses') {
        const ebit = val(sumRows(['Revenue', 'Cost of sales', 'Other operating income', 'Operating expenses']), adjFn)
        rows.push({ key: 'ebit', label: 'Operating profit (EBIT)', kind: 'total', values: ebit })
        pctRow('ebitm', 'Operating margin', ebit, revenue)
      }
    }
    const net = val(pl, adjFn)
    rows.push({ key: 'net', label: 'Net profit before tax', kind: 'total', values: net })
    pctRow('netm', 'Net margin', net, revenue)
    return { cols, rows }
  }, [q.data, mode, p])

  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card pad={0}>
        <div style={{ padding: '16px 18px 4px' }}>
          <Title right={p.hasLy ? <Seg options={[{ k: 'compare', label: 'vs last year' }, { k: 'monthly', label: 'By month' }]} value={mode} onChange={(k) => setMode(k as Mode)} /> : null}>
            Profit and loss
          </Title>
        </div>
        {table && <StatementTable cols={table.cols} rows={table.rows} />}
        <div style={{ padding: '10px 18px 14px', fontSize: 11.5, color: C.mut }}>
          Click a line to see the GL accounts behind it. Costs show in red brackets. Before depreciation and income tax.
        </div>
      </Card>
      {drill && <Drill p={p} group={drill.group} line={drill.line} onClose={() => setDrill(null)} />}
    </div>
  )
}

function Drill({ p, group, line, onClose }: { p: FinPeriod; group: string; line: string; onClose: () => void }) {
  const q = useAsync(() => fetchPlAccounts(p.fromMonth, p.toMonth, group, line), [p.fromMonth, p.toMonth, group, line])
  const accts = useMemo(() => {
    const m = new Map<string, { name: string; t: number }>()
    for (const r of q.data ?? []) {
      const e = m.get(r.account) ?? { name: r.acctname, t: 0 }
      e.t += r.amount; m.set(r.account, e)
    }
    return [...m.entries()].sort((a, b) => Math.abs(b[1].t) - Math.abs(a[1].t))
  }, [q.data])
  return (
    <Card>
      <Title right={<button className="text-link" onClick={onClose}>Close</button>}>{group}: {line} ({p.label})</Title>
      {q.loading ? <Loading /> : q.error ? <ErrorBox msg={q.error} /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            {accts.map(([a, e]) => (
              <tr key={a} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: '7px 8px', color: C.mut, width: 110 }}>{a}</td>
                <td style={{ padding: '7px 8px' }}>{e.name}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: e.t < 0 ? C.red : C.ink }}>{money(e.t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
