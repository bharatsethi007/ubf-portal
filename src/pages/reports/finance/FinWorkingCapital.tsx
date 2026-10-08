import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Pagination from '@/components/Pagination'
import { BLUE, C, Card, KpiRail, NAVY, ORANGE, Seg, Th, Td, Title } from '../reportsUi'
import { fetchAging, fetchKpis, type AgingRow } from './financeApi'
import { DATA_START, compact, money, monthLabel, pct, ratio } from './financeUtil'
import { ErrorBox, Loading, MoneyTip, Pill, useAsync } from './finUi'
import type { FinPeriod } from './FinanceTab'

type Kind = 'D' | 'C'
type SortKey = 'total' | 'd90_plus' | 'overdue' | 'avg_days_late' | 'billed_12m'
const PAGE = 25

export default function FinWorkingCapital({ p }: { p: FinPeriod }) {
  const [kind, setKind] = useState<Kind>('D')
  const [sort, setSort] = useState<SortKey>('total')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const aging = useAsync(() => fetchAging(kind), [kind])
  const kpis = useAsync(() => fetchKpis(DATA_START, p.toMonth), [p.toMonth])

  const v = useMemo(() => {
    const rows = (aging.data ?? []).map((r) => ({ ...r, overdue: r.d1_30 + r.d31_60 + r.d61_90 + r.d90_plus }))
    const sum = (f: (r: AgingRow & { overdue: number }) => number) => rows.reduce((a, r) => a + f(r), 0)
    const tot = sum((r) => r.total), billed = sum((r) => r.billed_12m)
    const filtered = rows.filter((r) => !q || `${r.accountid} ${r.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (Number(b[sort] ?? -1e9)) - (Number(a[sort] ?? -1e9)))
    return {
      rows: filtered, tot, cur: sum((r) => r.current_amt), d30: sum((r) => r.d1_30), d60: sum((r) => r.d31_60),
      d90: sum((r) => r.d61_90), d90p: sum((r) => r.d90_plus), unap: sum((r) => r.unapplied),
      days: billed ? (tot / billed) * 365 : null,
    }
  }, [aging.data, q, sort])

  const trend = (kpis.data ?? []).filter((k) => k.month <= p.toMonth).map((k) => ({
    m: monthLabel(k.month), 'Owed by customers': k.receivables, 'Owed to suppliers': k.payables,
    'Supplier costs not yet on jobs': Math.max(0, -k.accruals),
  }))
  const isAr = kind === 'D'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><Seg options={[{ k: 'D', label: 'Receivables (customers)' }, { k: 'C', label: 'Payables (suppliers)' }]} value={kind}
        onChange={(k) => { setKind(k as Kind); setPage(1) }} /></div>
      {aging.loading ? <Loading /> : aging.error ? <ErrorBox msg={aging.error} /> : (
        <KpiRail items={[
          { label: isAr ? 'Total owed to UBF' : 'Total UBF owes', value: compact(v.tot), accent: NAVY },
          { label: 'Not yet due', value: compact(v.cur), sub: pct(ratio(v.cur, v.tot), 0), accent: C.green },
          { label: '1-30 days overdue', value: compact(v.d30), sub: pct(ratio(v.d30, v.tot), 0), accent: ORANGE },
          { label: '31-60 days', value: compact(v.d60), sub: pct(ratio(v.d60, v.tot), 0), accent: ORANGE },
          { label: '61-90 days', value: compact(v.d90), sub: pct(ratio(v.d90, v.tot), 0), accent: C.red },
          { label: 'Over 90 days', value: compact(v.d90p), sub: pct(ratio(v.d90p, v.tot), 0), accent: C.red },
          { label: isAr ? 'Unapplied receipts' : 'Unapplied payments', value: compact(-v.unap), sub: 'not matched to invoices', accent: C.faint },
          { label: isAr ? 'Debtor days' : 'Creditor days', value: v.days != null ? v.days.toFixed(0) : '–', sub: 'balance / 12m billing', accent: BLUE },
        ]} />
      )}
      <Card>
        <Title>Month-end working capital</Title>
        <div style={{ height: 240 }}>
          {kpis.loading ? <Loading /> : (
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: 0, right: 8, top: 6 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(x) => compact(Number(x))} tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<MoneyTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: C.ink2 }}>{v}</span>} />
                <Line dataKey="Owed by customers" stroke={NAVY} strokeWidth={2} dot={false} />
                <Line dataKey="Owed to suppliers" stroke={ORANGE} strokeWidth={2} dot={false} />
                <Line dataKey="Supplier costs not yet on jobs" stroke={C.red} strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card pad={0}>
        <div style={{ padding: '16px 18px 8px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{isAr ? 'Customer aging' : 'Supplier aging'} (live, by days past due)</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Seg options={[{ k: 'total', label: 'Balance' }, { k: 'overdue', label: 'Overdue' }, { k: 'd90_plus', label: '90+' }, { k: 'avg_days_late', label: 'Pays late' }, { k: 'billed_12m', label: '12m billing' }]}
              value={sort} onChange={(k) => setSort(k as SortKey)} />
            <input className="input" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} style={{ width: 180 }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Account</Th><Th>Terms</Th><Th right>Current</Th><Th right>1-30</Th><Th right>31-60</Th><Th right>61-90</Th><Th right>90+</Th><Th right>Balance</Th><Th right>Limit</Th><Th right>Avg days to pay</Th><Th right>Avg days late</Th><Th right>12m billing</Th></tr></thead>
            <tbody>
              {v.rows.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                const over = r.credit_limit && r.credit_limit < 99999999 && r.total > r.credit_limit
                return (
                  <tr key={r.accountid} style={{ borderTop: `1px solid ${C.line}` }}>
                    <Td title={`${r.accountid} ${r.name ?? ''}`}><span style={{ color: C.mut, marginRight: 6 }}>{r.accountid}</span>{r.name}{r.is_related ? <span style={{ marginLeft: 6 }}><Pill tone="info">related</Pill></span> : null}</Td>
                    <Td muted>{r.terms ?? '–'}</Td>
                    <Td right>{money(r.current_amt)}</Td><Td right>{money(r.d1_30)}</Td><Td right>{money(r.d31_60)}</Td>
                    <Td right>{money(r.d61_90)}</Td><Td right strong={r.d90_plus > 0}>{money(r.d90_plus)}</Td>
                    <Td right strong>{money(r.total)}</Td>
                    <Td right muted>{r.credit_limit && r.credit_limit < 99999999 ? <span style={{ color: over ? C.red : undefined }}>{money(r.credit_limit)}</span> : '–'}</Td>
                    <Td right>{r.avg_days_to_pay ?? '–'}</Td>
                    <Td right><span style={{ color: (r.avg_days_late ?? 0) > 15 ? C.red : undefined }}>{r.avg_days_late ?? '–'}</span></Td>
                    <Td right muted>{money(r.billed_12m)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 18px 14px' }}><Pagination page={page} total={v.rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
      </Card>
    </div>
  )
}
