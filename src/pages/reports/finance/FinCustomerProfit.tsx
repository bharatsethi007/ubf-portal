import { useMemo, useState } from 'react'
import Pagination from '@/components/Pagination'
import { C, Card, KpiRail, NAVY, Seg, Th, Td } from '../reportsUi'
import { fetchCustomerProfit, type CustProfitRow, type Verdict } from './financeApi'
import { addMonths, compact, growth, money, moneyD, monthEnd, monthLabel, pct } from './financeUtil'
import { ErrorBox, Loading, Pill, Toggle, useAsync } from './finUi'
import type { FinPeriod } from './FinanceTab'

type Win = 'ttm' | 'ytd'
type Sort = 'net' | 'worst' | 'gp' | 'revenue' | 'margin' | 'dtp'
const PAGE = 25
const VERDICTS: { k: Verdict; label: string; tone: string; accent: string; help: string }[] = [
  { k: 'grow', label: 'Grow', tone: 'good', accent: C.green,
    help: 'Margin at or above the company average, pays within 45 days and covers its share of overheads. Win more of this work.' },
  { k: 'keep', label: 'Keep', tone: 'info', accent: NAVY,
    help: 'Profitable after overheads and financing. Nothing urgent.' },
  { k: 'reprice', label: 'Reprice', tone: 'bad', accent: C.red,
    help: 'Below-average margin and the gross profit does not cover the overhead its jobs use. Raise rates or add charges at the next quote.' },
  { k: 'tighten terms', label: 'Tighten terms', tone: 'warn', accent: '#F7941D',
    help: 'Takes over 60 days to pay, or more than a quarter of its balance is 60+ days overdue. Shorten terms, ask for prepayment of duty and GST, or review the credit limit.' },
  { k: 'too small to serve', label: 'Too small', tone: 'low', accent: C.faint,
    help: 'Margin is fine but jobs are too small to cover the average overhead per job. Bundle shipments, add a minimum charge, or move to cash terms.' },
]
const VMETA = Object.fromEntries(VERDICTS.map((v) => [v.k, v])) as Record<Verdict, (typeof VERDICTS)[number]>
const SORTS: { k: Sort; label: string; fn: (a: CustProfitRow, b: CustProfitRow) => number }[] = [
  { k: 'net', label: 'Best net', fn: (a, b) => b.net_contribution - a.net_contribution },
  { k: 'worst', label: 'Worst net', fn: (a, b) => a.net_contribution - b.net_contribution },
  { k: 'gp', label: 'GP', fn: (a, b) => b.gp - a.gp },
  { k: 'revenue', label: 'Revenue', fn: (a, b) => b.revenue - a.revenue },
  { k: 'margin', label: 'Lowest margin', fn: (a, b) => (a.margin ?? 999) - (b.margin ?? 999) },
  { k: 'dtp', label: 'Slowest payer', fn: (a, b) => (b.avg_days_to_pay ?? -1) - (a.avg_days_to_pay ?? -1) },
]
const RATES = [0.07, 0.09, 0.12]

export default function FinCustomerProfit({ p }: { p: FinPeriod }) {
  const [win, setWin] = useState<Win>('ttm')
  const [rate, setRate] = useState(0.09)
  const from = win === 'ttm' ? addMonths(p.toMonth, -11) : p.fromMonth
  const to = monthEnd(p.toMonth)
  const q = useAsync(() => fetchCustomerProfit(from, to, rate), [from, to, rate])
  const [verdict, setVerdict] = useState<Verdict | 'all'>('all')
  const [sort, setSort] = useState<Sort>('net')
  const [hideRelated, setHideRelated] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const v = useMemo(() => {
    const base = (q.data ?? []).filter((r) => !hideRelated || !r.is_related)
    const sum = (rs: CustProfitRow[], f: (r: CustProfitRow) => number) => rs.reduce((a, r) => a + f(r), 0)
    const rev = sum(base, (r) => r.revenue), gp = sum(base, (r) => r.gp)
    const kpi = VERDICTS.map((m) => {
      const rs = base.filter((r) => r.verdict === m.k)
      return { ...m, n: rs.length, net: sum(rs, (r) => r.net_contribution), gp: sum(rs, (r) => r.gp) }
    })
    const sorted = [...base].sort((a, b) => b.net_contribution - a.net_contribution)
    const net = sum(base, (r) => r.net_contribution)
    const top20 = sum(sorted.slice(0, 20), (r) => r.net_contribution)
    const rows = base.filter((r) => verdict === 'all' || r.verdict === verdict)
      .filter((r) => !search || `${r.accountid} ${r.name ?? ''} ${r.sales_rep ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort(SORTS.find((s) => s.k === sort)!.fn)
    return { kpi, rows, n: base.length, rev, gp, net, top20, cpj: base[0]?.cost_per_job ?? 0,
      serve: sum(base, (r) => r.serve_cost), fin: sum(base, (r) => r.finance_cost) }
  }, [q.data, hideRelated, verdict, search, sort])

  const head = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Seg options={[{ k: 'ttm', label: `12 months to ${monthLabel(p.toMonth)}` }, { k: 'ytd', label: p.label }]} value={win} onChange={(k) => { setWin(k as Win); setPage(1) }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5, color: C.ink2, display: 'flex', gap: 6, alignItems: 'center' }}>Cost of money
          <select className="input" value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: 80 }}>
            {RATES.map((r) => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
          </select>
        </label>
        <Toggle on={hideRelated} onChange={setHideRelated} label="Hide related parties" />
      </div>
    </div>
  )

  if (q.loading && !q.data) return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{head}<Loading /></div>
  if (q.error) return <ErrorBox msg={q.error} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {head}
      <KpiRail items={[
        { label: 'Net contribution', value: compact(v.net), sub: `${v.n} customers · GP ${compact(v.gp)} (${pct((v.gp / (v.rev || 1)) * 100)})`, accent: NAVY },
        ...v.kpi.map((k) => ({ label: k.label, value: compact(k.net), sub: `${k.n} customers · GP ${compact(k.gp)}`, accent: k.accent })),
      ]} />
      <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.6 }}>
        Top 20 customers make {compact(v.top20)} of {compact(v.net)} net contribution
        ({pct((v.top20 / (v.net || 1)) * 100, 0)}). Overheads of {compact(v.serve)} are spread at {moneyD(v.cpj)} per job, and
        slow payment costs {compact(v.fin)} at {(rate * 100).toFixed(0)}% a year.
      </div>
      <Card pad={0}>
        <div style={{ padding: '14px 16px 6px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Seg options={[{ k: 'all', label: 'All' }, ...VERDICTS.map((m) => ({ k: m.k, label: m.label }))]} value={verdict}
            onChange={(k) => { setVerdict(k as Verdict | 'all'); setPage(1) }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 150 }} aria-label="Sort">
              {SORTS.map((s) => <option key={s.k} value={s.k}>Sort: {s.label}</option>)}
            </select>
            <input className="input" placeholder="Customer or sales rep" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ width: 200 }} />
          </div>
        </div>
        {verdict !== 'all' && <div style={{ padding: '4px 16px 10px', fontSize: 12.5, color: C.ink2 }}>{VMETA[verdict].help}</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Customer</Th><Th right>Jobs</Th><Th right>Revenue</Th><Th right>GP</Th><Th right>Margin</Th>
              <Th right>Days to pay</Th><Th right>Overheads</Th><Th right>Finance cost</Th><Th right>Net</Th><Th>Verdict</Th></tr></thead>
            <tbody>
              {v.rows.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                const g = growth(r.revenue, r.prev_revenue)
                return (
                  <tr key={r.accountid} style={{ borderTop: `1px solid ${C.line}` }}>
                    <Td><span style={{ fontWeight: 600 }}>{r.name ?? r.accountid}</span> {r.is_related && <Pill tone="info">related</Pill>}
                      <div style={{ fontSize: 11, color: C.mut }}>{r.accountid}{r.sales_rep ? ` · ${r.sales_rep}` : ''}{r.terms ? ` · ${r.terms}` : ''}</div></Td>
                    <Td right>{r.jobs}<div style={{ fontSize: 11, color: C.mut }}>{r.gp_per_job != null ? `${money(r.gp_per_job)}/job` : ''}</div></Td>
                    <Td right>{money(r.revenue)}{g != null && <div style={{ fontSize: 11, color: g < 0 ? C.red : C.green }}>{g > 0 ? '+' : ''}{pct(g, 0)}</div>}</Td>
                    <Td right>{money(r.gp)}</Td>
                    <Td right>{pct(r.margin)}</Td>
                    <Td right>{r.avg_days_to_pay != null ? Math.round(r.avg_days_to_pay) : '–'}
                      {r.overdue_60 > 0 && <div style={{ fontSize: 11, color: C.red }}>{compact(r.overdue_60)} 60+</div>}</Td>
                    <Td right muted>{money(-r.serve_cost)}</Td>
                    <Td right muted>{money(-r.finance_cost)}</Td>
                    <Td right strong><span style={{ color: r.net_contribution < 0 ? C.red : C.ink }}>{money(r.net_contribution)}</span></Td>
                    <Td><span title={VMETA[r.verdict].help}><Pill tone={VMETA[r.verdict].tone}>{VMETA[r.verdict].label}</Pill></span></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px 14px' }}><Pagination page={page} total={v.rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
      </Card>
      <div style={{ fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
        Revenue and GP from job charges billed to the customer (freight and FIN invoices; duty, GST and other pass-through charges excluded),
        compared with the same length of time before. Overheads are the ledger operating expenses for the window spread evenly per job.
        Finance cost is what the customer's invoices (including disbursements) cost to fund while unpaid: billed × days to pay ÷ 365 × the cost of money.
        Days to pay is the payment-weighted average over the last 12 months of allocations; customers with no history use 30 days.
      </div>
    </div>
  )
}
