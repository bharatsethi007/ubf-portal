import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Pagination from '@/components/Pagination'
import { C, Card, KpiRail, NAVY, ORANGE, Seg, Th, Td, Title } from '../reportsUi'
import { fetchDutyFloat, type DutyCustomer, type DutyGap } from './financeApi'
import { addMonths, compact, money, monthEnd, monthLabel, pct } from './financeUtil'
import { Banner, ErrorBox, Loading, Pill, Toggle, useAsync } from './finUi'
import type { FinPeriod } from './FinanceTab'

const PAGE = 20
const fmtD = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
const REASON: Record<DutyGap['reason'], { label: string; tone: string; help: string }> = {
  duplicate: { label: 'Possible double payment', tone: 'bad', help: 'Two Customs entries for the same amount on this job, both paid. Check with Customs and claim a refund if duplicated.' },
  not_billed: { label: 'Not billed', tone: 'bad', help: 'Customs paid, no customer invoice on the job.' },
  short: { label: 'Billed short', tone: 'warn', help: 'Duty and GST charged to the customer are less than Customs charged.' },
}
// A customer needs action when UBF regularly pays Customs before they pay UBF.
const needsAction = (c: DutyCustomer) => (c.avg_fdays ?? 0) >= 5 && c.funding_cost >= 50

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => <div key={p.name} style={{ color: C.ink2 }}>{p.name}: {p.name.startsWith('Days') ? `${p.value ?? 0} days` : compact(p.value)}</div>)}
    </div>
  )
}

export default function FinDutyFloat({ p }: { p: FinPeriod }) {
  const from = addMonths(p.toMonth, -11), to = monthEnd(p.toMonth)
  const q = useAsync(() => fetchDutyFloat(from, to), [from, to])
  const [tab, setTab] = useState<'customers' | 'gaps'>('customers')
  const [onlyFunded, setOnlyFunded] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const v = useMemo(() => {
    if (!q.data) return null
    const d = q.data
    const cust = d.customers
      .filter((c) => !onlyFunded || (c.avg_fdays ?? 0) > 0 || (c.funded_now ?? 0) > 0)
      .filter((c) => !search || `${c.accountid} ${c.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    const gaps = d.unrecovered.filter((g) => !search || `${g.job_no} ${g.house_bill ?? ''} ${g.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    const chart = d.months.map((m) => ({ m: monthLabel(m.month), 'Duty and GST paid': m.duty, 'Days held before paying Customs': m.avg_hdays ?? 0 }))
    return { d, cust, gaps, chart, act: d.customers.filter(needsAction), gapTot: d.unrecovered.reduce((a, g) => a + g.gap, 0) }
  }, [q.data, onlyFunded, search])

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  if (!v) return null
  const { now, totals: t } = v.d
  const rows = tab === 'customers' ? v.cust : v.gaps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(now.customs_overdue ?? 0) > 1000 && <Banner tone="bad">{compact(now.customs_overdue ?? 0)} of Customs entries are past the 20th-of-month due date and still open in TradeWindow. Check they were paid.</Banner>}
      {(now.customs_stale ?? 0) > 0 && <Banner tone="warn">{now.customs_stale_jobs} Customs entries older than 120 days are still open in TradeWindow ({money(now.customs_stale ?? 0)}). Clear them against the Customs statement.</Banner>}
      <KpiRail items={[
        { label: 'Duty and GST paid for clients', value: compact(t.duty), sub: `${t.jobs} jobs · 12 months to ${monthLabel(p.toMonth)}`, accent: NAVY },
        { label: 'Client cash held', value: compact(t.avg_held), sub: `on average · paid ${t.avg_hdays ?? 0} days before Customs`, accent: C.green },
        { label: 'Worth a year', value: compact(t.held_benefit), sub: `at 9% · ${pct(t.paid_before_customs, 0)} of jobs paid first`, accent: C.green },
        { label: 'UBF-funded duty', value: compact(t.avg_funded), sub: `on average · costs ${compact(t.funding_cost)} a year`, accent: ORANGE },
        { label: 'Next Customs payment', value: compact(now.next_due_amount ?? 0), sub: now.next_due_date ? `due ${fmtD(now.next_due_date)}` : 'nothing due', accent: C.red },
        { label: 'Not recovered', value: compact(v.gapTot), sub: `${v.d.unrecovered.length} jobs`, accent: C.faint },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <Card>
          <Title>Duty and GST paid each month, and how early clients pay</Title>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={v.chart} margin={{ left: 0, right: 8, top: 6 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="a" tickFormatter={(x) => compact(Number(x))} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={58} />
                <YAxis yAxisId="d" orientation="right" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(x) => <span style={{ color: C.ink2 }}>{x}</span>} />
                <Bar yAxisId="a" dataKey="Duty and GST paid" fill="#B9C4E2" radius={[3, 3, 0, 0]} />
                <Line yAxisId="d" dataKey="Days held before paying Customs" stroke={ORANGE} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <Title>What this means</Title>
          <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>Customs deferred payment is due on the 20th of the month after entry. {pct(t.paid_before_customs, 0)} of clients pay UBF before then,
              so UBF holds about {compact(t.avg_held)} of client duty money on average. That cash belongs to clients: it must be there on the 20th.</div>
            <div>Clients owe {compact(now.clients_owe ?? 0)} on duty invoices today; {compact(now.funded_now ?? 0)} of that ({now.funded_now_jobs} jobs) is duty UBF has already paid.</div>
            <div>{v.act.length ? `${v.act.length} customers regularly pay after UBF has paid Customs. Ask them to pay duty before goods are released.` : 'No customer regularly pays after Customs is paid.'}</div>
          </div>
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Seg options={[{ k: 'customers', label: 'By customer' }, { k: 'gaps', label: `Not recovered (${v.d.unrecovered.length})` }]} value={tab} onChange={(k) => { setTab(k as 'customers' | 'gaps'); setPage(1) }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {tab === 'customers' && <Toggle on={onlyFunded} onChange={(x) => { setOnlyFunded(x); setPage(1) }} label="Only where UBF funds duty" />}
            <input className="input" placeholder="Customer or job" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ width: 200 }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {tab === 'customers' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Customer</Th><Th right>Jobs</Th><Th right>Duty and GST</Th><Th right>Paid before Customs</Th><Th right>Days funded by UBF</Th>
                <Th right>Days to pay</Th><Th right>Funding cost</Th><Th right>Owes now</Th><Th> </Th></tr></thead>
              <tbody>{v.cust.slice((page - 1) * PAGE, page * PAGE).map((c) => (
                <tr key={c.accountid} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td><span style={{ fontWeight: 600 }}>{c.name ?? c.accountid}</span><div style={{ fontSize: 11, color: C.mut }}>{c.accountid}</div></Td>
                  <Td right>{c.jobs}</Td><Td right>{money(c.duty)}</Td><Td right>{c.pct_before == null ? '–' : `${c.pct_before}%`}</Td>
                  <Td right>{c.avg_fdays ?? '–'}</Td><Td right>{c.days_to_pay ?? '–'}</Td><Td right>{money(c.funding_cost)}</Td>
                  <Td right>{c.owe_now ? money(c.owe_now) : '–'}{(c.funded_now ?? 0) >= 100 ? <div style={{ fontSize: 11, color: C.red }}>{compact(c.funded_now ?? 0)} already paid to Customs</div> : null}</Td>
                  <Td>{needsAction(c) ? <Pill tone="warn">Collect before release</Pill> : null}</Td>
                </tr>))}</tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Job</Th><Th>Customer</Th><Th>Customs entry</Th><Th right>Paid to Customs</Th><Th right>Charged to customer</Th><Th right>Gap</Th><Th>Issue</Th></tr></thead>
              <tbody>{v.gaps.slice((page - 1) * PAGE, page * PAGE).map((g) => (
                <tr key={g.job_no} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td><span style={{ fontWeight: 600 }}>{g.module ?? 'Job'} {g.job_no}</span><div style={{ fontSize: 11, color: C.mut }}>{g.house_bill ?? ''}</div></Td>
                  <Td>{g.name ?? <span style={{ color: C.mut }}>{g.accountid ?? 'not linked'}</span>}</Td>
                  <Td muted>{fmtD(g.duty_date)}</Td><Td right>{money(g.duty)}</Td><Td right>{money(g.recovered)}</Td><Td right strong>{money(g.gap)}</Td>
                  <Td><span title={REASON[g.reason].help}><Pill tone={REASON[g.reason].tone}>{REASON[g.reason].label}</Pill></span></Td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '8px 16px 14px' }}><Pagination page={page} total={rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
      </Card>
      <div style={{ fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
        Customs entries are TradeWindow creditor NZCUST invoices tied to a job. Charged to customer is the duty, GST and CIT charge lines on the job, or its DIS invoice.
        Days are measured from payment dates: when UBF paid Customs and when the customer paid the invoice that carries the duty. Funding cost and value at 9% a year.
      </div>
    </div>
  )
}
