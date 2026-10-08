import { Text, View } from '@react-pdf/renderer'
import { compact, monthEnd, pct, ratio } from '../financeUtil'
import type { BoardPack } from './boardPackData'
import { AgingBar, ForecastChart } from './bpCharts'
import { BpPage, K, Kpi, KpiRow, S, Table, chgTxt, fullMonth, m0, p1, type Row } from './bpKit'

const fmtD = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
const isNeg = (...v: (number | null)[]) => [false, ...v.map((x) => x != null && x < 0)]

export function Pnl({ p }: { p: BoardPack }) {
  const mon = fullMonth(p.month).split(' ')[0]
  const rows: Row[] = p.pl.map((r) => {
    if (r.kind === 'section') return { kind: 'section', cells: [r.label] }
    const f = r.kind === 'pct' ? p1 : m0
    const v = r.v
    const c = (a: number | null, b: number | null) => (r.kind === 'memo' ? '' : r.kind === 'pct' ? (a != null && b != null ? `${(a - b >= 0 ? '+' : '')}${(a - b).toFixed(1)} pts` : '–') : a != null && b != null && a <= 0 && b <= 0 ? chgTxt(-a, -b) : chgTxt(a, b))
    return { kind: r.kind, cells: [r.label, f(v.m), f(v.mLy), c(v.m, v.mLy), f(v.y), f(v.yLy), c(v.y, v.yLy)],
      neg: r.kind === 'pct' ? [] : isNeg(v.m, v.mLy, null, v.y, v.yLy) }
  })
  const ebitConv = ratio(p.yT.ebit, p.yT.gp)
  return (
    <BpPage section="3 · Profit and loss" month={p.month} title={`Operating profit converts ${pct(ebitConv, 0)} of gross profit year to date`}
      lead={`${mon}: revenue ${compact(p.mT.revenue)}, gross profit ${compact(p.mT.gp)}, net profit ${compact(p.mT.net)}. Costs shown negative.${p.hasLy ? '' : ' No prior-year comparison: the synced ledger starts April 2025.'}`}>
      <Table dense cols={[{ label: '', w: 3 }, { label: mon }, { label: 'Last year' }, { label: 'Change', w: 0.8 }, { label: 'YTD' }, { label: 'LY YTD' }, { label: 'Change', w: 0.8 }]} rows={rows} />
      <Text style={S.note}>Revenue includes freight, clearance and disbursement recoveries posted to revenue accounts; duty and GST paid for clients are not revenue.
        {p.useAdj ? ' "Job costs not yet posted" is the growth in supplier invoices awaiting job costing (Accruals 23000).' : ''}</Text>
    </BpPage>
  )
}

export function Balance({ p }: { p: BoardPack }) {
  const rows: Row[] = p.bs.map((r) => (r.kind === 'section' ? { kind: 'section', cells: [r.label] }
    : { kind: r.kind, cells: [r.label, m0(r.now), m0(r.open), m0(r.now - r.open)], neg: isNeg(r.now, r.open, r.now - r.open) }))
  const cr = p.cl ? p.ca / p.cl : null
  return (
    <BpPage section="4 · Balance sheet" month={p.month} title={`Current ratio ${cr == null ? '–' : cr.toFixed(2)}, working capital ${compact(p.ca - p.cl)}`}
      lead={`Cash ${compact(p.cash)}, equity ${compact(p.equity)}. Receivables include duty and GST UBF has paid for clients, so they move with import volumes, not just sales.`}>
      <KpiRow>
        <Kpi label="Cash" value={compact(p.cash)} />
        <Kpi label="Current assets" value={compact(p.ca)} />
        <Kpi label="Current liabilities" value={compact(p.cl)} />
        <Kpi label="Working capital" value={compact(p.ca - p.cl)} />
        <Kpi label="Equity" value={compact(p.equity)} />
      </KpiRow>
      <Table dense cols={[{ label: '', w: 3 }, { label: `At ${fmtD(monthEnd(p.month))}` }, { label: `At ${fmtD(p.bsOpenLabel)}` }, { label: 'Movement' }]} rows={rows} />
      <Text style={S.note}>Current = everything except fixed assets, bonds, related-party advances and borrowings. Current year earnings exclude depreciation and income tax.</Text>
    </BpPage>
  )
}

export function Cash({ p }: { p: BoardPack }) {
  const mon = fullMonth(p.month).split(' ')[0]
  const rows: Row[] = [
    ...p.cf.map((r): Row => (r.kind === 'section' ? { kind: 'section', cells: [r.label] } : { kind: r.kind, cells: [r.label, m0(r.m), m0(r.y)], neg: isNeg(r.m, r.y) })),
    { kind: 'line', cells: ['Opening cash', m0(p.cashOpenM), m0(p.cashOpenY)] },
    { kind: 'total', cells: ['Closing cash', m0(p.cashClose), m0(p.cashClose)] },
  ]
  const op = p.cf.find((r) => r.label === 'Net cash from operating activities')
  const low = p.forecast.length ? p.forecast.reduce((m, r) => (r.closing < m.closing ? r : m), p.forecast[0]) : null
  return (
    <BpPage section="5 · Cash flow" month={p.month} title={`Operating cash flow ${compact(op?.y ?? 0)} year to date, ${compact(op?.m ?? 0)} in ${mon}`}
      lead={low ? `13-week forecast low is ${compact(low.closing)} in the week of ${fmtD(low.week_start)}. Customs and supplier payments fall due ahead of customer receipts.` : undefined}>
      <Table dense cols={[{ label: 'Direct method', w: 3.4 }, { label: mon }, { label: 'Year to date' }]} rows={rows} />
      <View style={{ marginTop: 16 }} wrap={false}>
        <Text style={S.h3}>13-week cash forecast</Text>
        <ForecastChart rows={p.forecast} />
        <Text style={S.note}>Built from open customer invoices (over 120 days overdue excluded), open supplier bills, payroll and the last three months' run-rates. Unapplied customer cash is netted against the customer's invoices.</Text>
      </View>
    </BpPage>
  )
}

export function WorkingCapital({ p }: { p: BoardPack }) {
  const over30 = p.ar.d31_60 + p.ar.d61_90 + p.ar.d90_plus
  const rows: Row[] = p.arTop.map((r) => ({ cells: [r.name ?? r.accountid, m0(r.total), m0(r.d31_60 + r.d61_90 + r.d90_plus), m0(r.d90_plus), r.avg_days_to_pay == null ? '–' : Math.round(r.avg_days_to_pay).toString()] }))
  return (
    <BpPage section="6 · Debtors and creditors" month={p.month} title={`Debtor days ${p.dso == null ? '–' : p.dso.toFixed(0)}, ${compact(over30)} more than 30 days overdue`}
      lead={`Customers owe ${compact(p.ar.total)}, of which related companies ${compact(p.relatedAr)}. ${compact(-p.unapplied)} of customer receipts are not yet allocated to invoices. Balances are as at the last sync, not month end.`}>
      <View style={{ flexDirection: 'row', gap: 22, marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={S.h3}>Owed by customers · {compact(p.ar.total)} · {p.dso == null ? '–' : p.dso.toFixed(0)} days</Text>
          <AgingBar b={p.ar} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.h3}>Owed to suppliers · {compact(p.ap.total)} · {p.dpo == null ? '–' : p.dpo.toFixed(0)} days</Text>
          <AgingBar b={p.ap} />
        </View>
      </View>
      <Text style={S.h3}>Largest overdue customers (related companies excluded)</Text>
      <Table dense cols={[{ label: 'Customer', w: 3.4 }, { label: 'Owed' }, { label: 'Over 30 days' }, { label: 'Over 90 days' }, { label: 'Days to pay', w: 0.8 }]} rows={rows} />
      <Text style={S.note}>Days are calculated on the last 12 months of billing. Debtor days include duty and GST recharged to clients. Collections and payment matching are worked in the portal under Finance.</Text>
    </BpPage>
  )
}

const VERDICT_LABEL: Record<string, string> = { grow: 'Grow', keep: 'Keep', reprice: 'Reprice', 'tighten terms': 'Tighten terms', 'too small to serve': 'Too small to serve' }
export function Margins({ p }: { p: BoardPack }) {
  const cr = p.cust.rows.filter((r) => !r.is_related)
  const sum = (rs: typeof cr, f: (r: (typeof cr)[number]) => number) => rs.reduce((a, r) => a + f(r), 0)
  const leakTot = p.leaks.reduce((a, l) => a + l.amount, 0)
  const vRows: Row[] = Object.keys(VERDICT_LABEL).map((v) => {
    const rs = cr.filter((r) => r.verdict === v)
    return { cells: [VERDICT_LABEL[v], rs.length.toString(), m0(sum(rs, (r) => r.revenue)), m0(sum(rs, (r) => r.gp)), m0(sum(rs, (r) => r.net_contribution))], neg: isNeg(null, null, null, sum(rs, (r) => r.net_contribution)) }
  })
  vRows.push({ kind: 'total', cells: ['Total', cr.length.toString(), m0(sum(cr, (r) => r.revenue)), m0(sum(cr, (r) => r.gp)), m0(sum(cr, (r) => r.net_contribution))] })
  const reprice = cr.filter((r) => r.verdict === 'reprice').sort((a, b) => a.net_contribution - b.net_contribution).slice(0, 8)
  const cpj = cr[0]?.cost_per_job ?? 0
  return (
    <BpPage section="7 · Margins and customers" month={p.month} title={`${compact(leakTot)} of margin at risk on open jobs; ${reprice.length ? `${cr.filter((r) => r.verdict === 'reprice').length} customers to reprice` : 'no customers to reprice'}`}
      lead={`Customer view covers ${fmtD(p.cust.from)} to ${fmtD(p.cust.to)}. Overheads are spread at ${compact(cpj)} per job; slow payment is charged at 9% a year.`}>
      <Text style={S.h3}>Margin leaks on open jobs</Text>
      <Table dense cols={[{ label: 'Check', w: 3.4 }, { label: 'Jobs' }, { label: 'Amount' }]}
        rows={[...p.leaks.map((l) => ({ cells: [l.label, l.n.toString(), m0(l.amount)] })), { kind: 'total', cells: ['Total', p.leaks.reduce((a, l) => a + l.n, 0).toString(), m0(leakTot)] }]} />
      <View style={{ marginTop: 16 }}>
        <Text style={S.h3}>Customer profitability after overheads and cost of credit</Text>
        <Table dense cols={[{ label: 'Verdict', w: 2.4 }, { label: 'Customers' }, { label: 'Revenue' }, { label: 'Gross profit' }, { label: 'Net contribution' }]} rows={vRows} />
      </View>
      {reprice.length ? (
        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={S.h3}>Largest customers to reprice</Text>
          <Table dense cols={[{ label: 'Customer', w: 3 }, { label: 'Jobs', w: 0.6 }, { label: 'Revenue' }, { label: 'GP' }, { label: 'Margin', w: 0.7 }, { label: 'Net' }]}
            rows={reprice.map((r) => ({ cells: [r.name ?? r.accountid, r.jobs.toString(), m0(r.revenue), m0(r.gp), p1(r.margin), m0(r.net_contribution)], neg: isNeg(null, null, r.gp, null, r.net_contribution) }))} />
        </View>
      ) : null}
      <Text style={{ ...S.note, color: K.mut }}>Related companies excluded. Margin leaks compare supplier cost billed with cost booked when the customer was invoiced; reviewed items are excluded.</Text>
    </BpPage>
  )
}
