import { useMemo, useState } from 'react'
import { C, Card, KpiRail, NAVY, Title } from '../reportsUi'
import { fetchBalanceSheet, type BsRow } from './financeApi'
import { DATA_START, compact, fyOf, fyStart, monthEnd, monthLabel, pct, ratio } from './financeUtil'
import { ErrorBox, Loading, StatementTable, useAsync, type StmtRow } from './finUi'
import type { FinPeriod } from './FinanceTab'

const ORDER: Record<string, string[]> = {
  Assets: ['Cash & bank', 'Trade receivables', 'Prepayments', 'Tax assets', 'Other current assets', 'Related party advances', 'Bonds & deposits', 'Fixed assets'],
  Liabilities: ['Trade payables', 'Accruals', 'GST', 'Customs duty payable', 'Payroll liabilities', 'Related party & dividends', 'Other liabilities', 'Borrowings'],
  Equity: ['Share capital', 'Retained earnings', 'Drawings & dividends', 'Current year earnings'],
}
const NON_CURRENT_A = ['Fixed assets', 'Bonds & deposits', 'Related party advances']
const NON_CURRENT_L = ['Borrowings']

export default function FinBalanceSheet({ p }: { p: FinPeriod }) {
  const asAt = monthEnd(p.toMonth)
  // Opening = prior FY close (31 March). The first synced FY has no prior year, so use 1 April
  // (its year-open batch plus that day's postings).
  const open = p.fy > fyOf(DATA_START) ? `${p.fy}-03-31` : fyStart(p.fy)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const q = useAsync(() => Promise.all([fetchBalanceSheet(asAt), fetchBalanceSheet(open)]), [asAt, open])

  const view = useMemo(() => {
    if (!q.data) return null
    const [now, fyOpen] = q.data
    const sum = (rows: BsRow[], f: (r: BsRow) => boolean) => rows.filter(f).reduce((a, r) => a + r.amount, 0)
    const rows: StmtRow[] = []
    for (const side of ['Assets', 'Liabilities', 'Equity']) {
      rows.push({ key: side, label: side, kind: 'section', values: {} })
      for (const g of ORDER[side]) {
        const a = sum(now, (r) => r.side === side && r.bs_group === g), b = sum(fyOpen, (r) => r.side === side && r.bs_group === g)
        if (!a && !b) continue
        const k = `${side}-${g}`
        rows.push({ key: k, label: g, kind: 'line', values: { now: a, open: b, chg: a - b }, onClick: () => setExpanded((e) => ({ ...e, [k]: !e[k] })) })
        if (expanded[k]) {
          const accts = [...new Set([...now, ...fyOpen].filter((r) => r.side === side && r.bs_group === g).map((r) => r.account ?? r.acctname))]
          for (const ac of accts) {
            const pick = (rs: BsRow[]) => sum(rs, (r) => r.side === side && r.bs_group === g && (r.account ?? r.acctname) === ac)
            const name = [...now, ...fyOpen].find((r) => (r.account ?? r.acctname) === ac)?.acctname ?? ac
            rows.push({ key: `${k}-${ac}`, label: `${ac === name ? '' : ac + '  '}${name}`, kind: 'memo', values: { now: pick(now), open: pick(fyOpen), chg: pick(now) - pick(fyOpen) } })
          }
        }
      }
      const a = sum(now, (r) => r.side === side), b = sum(fyOpen, (r) => r.side === side)
      rows.push({ key: `t-${side}`, label: `Total ${side.toLowerCase()}`, kind: 'total', values: { now: a, open: b, chg: a - b } })
    }
    const A = sum(now, (r) => r.side === 'Assets'), L = sum(now, (r) => r.side === 'Liabilities'), E = sum(now, (r) => r.side === 'Equity')
    const CA = sum(now, (r) => r.side === 'Assets' && !NON_CURRENT_A.includes(r.bs_group))
    const CL = sum(now, (r) => r.side === 'Liabilities' && !NON_CURRENT_L.includes(r.bs_group))
    const cash = sum(now, (r) => r.bs_group === 'Cash & bank'), debt = sum(now, (r) => r.bs_group === 'Borrowings')
    return { rows, A, L, E, CA, CL, cash, debt, diff: A - L - E }
  }, [q.data, expanded])

  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  if (!view) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={[
        { label: 'Net assets', value: compact(view.E), accent: NAVY },
        { label: 'Working capital', value: compact(view.CA - view.CL), sub: 'current assets less current liabilities', accent: C.green },
        { label: 'Current ratio', value: view.CL ? (view.CA / view.CL).toFixed(2) : '–', sub: 'above 1.2 is comfortable', accent: C.green },
        { label: 'Net cash', value: compact(view.cash - view.debt), sub: 'cash less borrowings', accent: C.faint },
        { label: 'Equity ratio', value: pct(ratio(view.E, view.A), 0), sub: 'equity / total assets', accent: C.faint },
      ]} />
      <Card pad={0}>
        <div style={{ padding: '16px 18px 4px' }}><Title>Balance sheet as at {asAt}</Title></div>
        <StatementTable rows={view.rows} cols={[
          { key: 'now', label: monthLabel(p.toMonth), strong: true }, { key: 'open', label: `At ${open}` }, { key: 'chg', label: 'Movement' },
        ]} />
        <div style={{ padding: '10px 18px 14px', fontSize: 11.5, color: Math.abs(view.diff) > 1 ? C.red : C.mut }}>
          {Math.abs(view.diff) > 1 ? `Out of balance by ${compact(view.diff)}. ` : 'Balances: assets = liabilities + equity. '}
          Click a group to see accounts. Fixed assets are at cost; no depreciation is posted in the ledger.
        </div>
      </Card>
    </div>
  )
}
