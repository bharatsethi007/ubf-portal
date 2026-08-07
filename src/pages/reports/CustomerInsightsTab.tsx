import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { supabase } from '@/supabase'
import Pagination from '@/components/Pagination'
import { usePorts } from '@/hooks/usePorts'
import { resolvePortCountryCode } from '@/features/portal/dashboard/portalPortDisplay'
import {
  NAVY, ORANGE, BLUE, C, FONT, glass, nf, cf,
  Card, Title, LegendDot, KpiRail, Th, Td, Seg, SearchSelect, type Opt,
} from './reportsUi'

const PAGE_SIZE = 12

type ListRow = { customer_account_id: string; customer_name: string | null; jobs: number; revenue: number; gross_profit: number; open_balance: number }
type TrendRow = { month: string; jobs: number; revenue: number; gross_profit: number }
type Summary = { revenue: number; gross_profit: number; jobs: number; prev_revenue: number; prev_gross_profit: number; prev_jobs: number }
type LaneRow = { origin: string; destination: string; direction: string; mode: string; jobs: number; revenue: number; gross_profit: number }
type Ar = {
  open_balance: number; not_due: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number
  open_count: number; oldest_overdue_days: number; avg_overdue_days: number; dso_days: number | null; billed_12mo: number
  credit_limit: number | null; payment_alert: boolean | null; import_cod: boolean | null; account_terms: string | null
}
type OpenInv = { invoice_no: string; doctype: string; account_id: string; customer_name: string | null; doc_date: string; date_due: string; days_overdue: number; balance: number }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const num = (v: any) => Number(v || 0)
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const monthLabel = (iso: string) => { const [y, m] = iso.split('-'); return `${MONTHS[Number(m) - 1]} ${y.slice(2)}` }
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)

const PRESETS = [
  { k: 'w', label: 'Week' },
  { k: '1m', label: 'Month' },
  { k: '3m', label: '3 Months' },
  { k: 'q', label: 'Quarter' },
  { k: '6m', label: '6 Months' },
  { k: '1y', label: 'Year' },
] as const
type Preset = (typeof PRESETS)[number]['k'] | 'custom'

const MODES = [
  { k: 'all', label: 'All', dir: null as string | null, mode: null as string | null },
  { k: 'ia', label: 'Imp Air', dir: 'import', mode: 'air' },
  { k: 'is', label: 'Imp Sea', dir: 'import', mode: 'sea' },
  { k: 'ea', label: 'Exp Air', dir: 'export', mode: 'air' },
  { k: 'es', label: 'Exp Sea', dir: 'export', mode: 'sea' },
] as const
type ModeKey = (typeof MODES)[number]['k']

function rangeFor(k: Preset): { from: string; to: string } {
  const today = new Date()
  let start = addMonths(today, -12)
  if (k === 'w') start = addDays(today, -7)
  else if (k === '1m') start = addMonths(today, -1)
  else if (k === '3m') start = addMonths(today, -3)
  else if (k === 'q') start = startOfQuarter(today)
  else if (k === '6m') start = addMonths(today, -6)
  return { from: isoDate(start), to: isoDate(today) }
}

const AGING = [
  { key: 'not_due', name: 'Not due', color: C.green },
  { key: 'd1_30', name: '1–30', color: BLUE },
  { key: 'd31_60', name: '31–60', color: ORANGE },
  { key: 'd61_90', name: '61–90', color: '#E8720C' },
  { key: 'd90_plus', name: '90+', color: C.red },
] as const

const docLabel: Record<string, string> = { FRT: 'Freight', FIN: 'Final', DIS: 'Disburse' }

export default function CustomerInsightsTab() {
  const initial = rangeFor('1y')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [preset, setPreset] = useState<Preset>('1y')
  const [modeKey, setModeKey] = useState<ModeKey>('all')
  const [account, setAccount] = useState<string | null>(null)

  const [list, setList] = useState<ListRow[]>([])
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [ar, setAr] = useState<Ar | null>(null)
  const [openInv, setOpenInv] = useState<OpenInv[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [listPage, setListPage] = useState(1)
  const [lanePage, setLanePage] = useState(1)
  const [invPage, setInvPage] = useState(1)

  const { ports } = usePorts()
  const flag = (code: string, mode: string) => (
    <span className={`fi fi-${resolvePortCountryCode(code, mode === 'air' ? 'air' : 'sea', ports)}`} aria-hidden style={{ marginRight: 6, borderRadius: 2 }} />
  )

  const md = MODES.find((m) => m.k === modeKey)!
  const p_direction = md.dir
  const p_mode = md.mode

  function pickPreset(k: Preset) {
    const r = rangeFor(k); setFrom(r.from); setTo(r.to); setPreset(k)
  }

  // customer list (picker + all-view ranking) — depends on range + mode
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('report_cust_list', { p_from: from, p_to: to, p_direction, p_mode })
      if (cancelled) return
      setList((data ?? []) as ListRow[]); setListPage(1)
    })()
    return () => { cancelled = true }
  }, [from, to, p_direction, p_mode])

  // trend + summary + lanes — depends on all filters incl. account
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      const args = { p_from: from, p_to: to, p_account: account, p_direction, p_mode }
      const [tr, su, ln] = await Promise.all([
        supabase.rpc('report_cust_trend', args),
        supabase.rpc('report_cust_summary', args),
        supabase.rpc('report_cust_lanes', { ...args, p_limit: 300 }),
      ])
      if (cancelled) return
      const e = tr.error || su.error || ln.error
      if (e) { setErr(e.message); setTrend([]); setSummary(null); setLanes([]) }
      else {
        setTrend((tr.data ?? []) as TrendRow[])
        setSummary(((su.data ?? [])[0] ?? null) as Summary | null)
        setLanes((ln.data ?? []) as LaneRow[])
      }
      setLoading(false); setLanePage(1)
    })()
    return () => { cancelled = true }
  }, [from, to, account, p_direction, p_mode])

  // AR + open invoices — point-in-time, depends only on account
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [a, oi] = await Promise.all([
        supabase.rpc('report_cust_ar', { p_account: account }),
        supabase.rpc('report_cust_open_invoices', { p_account: account, p_limit: 200 }),
      ])
      if (cancelled) return
      setAr(((a.data ?? [])[0] ?? null) as Ar | null)
      setOpenInv((oi.data ?? []) as OpenInv[]); setInvPage(1)
    })()
    return () => { cancelled = true }
  }, [account])

  const custOpts: Opt[] = useMemo(
    () => list.map((c) => ({ value: c.customer_account_id, label: `${c.customer_name || c.customer_account_id} (${cf.format(num(c.revenue))})` })),
    [list],
  )

  const rev = num(summary?.revenue), gp = num(summary?.gross_profit), jobs = num(summary?.jobs)
  const pRev = num(summary?.prev_revenue), pGp = num(summary?.prev_gross_profit), pJobs = num(summary?.prev_jobs)
  const margin = rev ? (gp / rev) * 100 : 0
  const pct = (c: number, p: number) => (p ? ((c - p) / p) * 100 : null)
  const deltaStr = (c: number, p: number) => { const x = pct(c, p); if (x === null) return undefined; return `${x >= 0 ? '▲' : '▼'} ${Math.abs(x).toFixed(0)}% vs prev` }

  const overdue = ar ? num(ar.open_balance) - num(ar.not_due) : 0

  const trendData = useMemo(
    () => trend.map((r) => ({ label: monthLabel(r.month), revenue: num(r.revenue), gp: num(r.gross_profit) })),
    [trend],
  )
  const agingData = useMemo(
    () => AGING.map((a) => ({ name: a.name, value: ar ? num((ar as any)[a.key]) : 0, color: a.color })),
    [ar],
  )
  const prevData = useMemo(
    () => [
      { name: 'Revenue', current: rev, previous: pRev },
      { name: 'Gross profit', current: gp, previous: pGp },
    ],
    [rev, gp, pRev, pGp],
  )

  const listSlice = list.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)
  const laneSlice = lanes.slice((lanePage - 1) * PAGE_SIZE, lanePage * PAGE_SIZE)
  const invSlice = openInv.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE)

  function MoneyTip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '10px 12px', borderRadius: 11 }}>
        {label && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>{label}</div>}
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: i ? 5 : 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color ?? p.fill }} />
            <span style={{ color: C.ink2 }}>{p.name}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{cf.format(num(p.value))}</span>
          </div>
        ))}
      </div>
    )
  }
  function AgingTip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const p = payload[0]
    return (
      <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '9px 12px', borderRadius: 11 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{p.payload.name}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: p.payload.color }}>{cf.format(num(p.value))}</div>
      </div>
    )
  }

  const Field = ({ label, children }: { label: string; children: any }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11.5, color: C.ink2 }}>{label}</span>{children}
    </div>
  )
  const dateInput: CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 10px',
    fontSize: 13, color: C.ink, background: 'rgba(255,255,255,.7)', fontFamily: FONT,
  }
  const dayPill = (d: number) => {
    const c = d <= 0 ? C.green : d <= 30 ? BLUE : d <= 60 ? ORANGE : d <= 90 ? '#E8720C' : C.red
    return <span style={{ color: c, fontWeight: 600 }}>{d <= 0 ? 'Current' : `${d}d`}</span>
  }

  const scopeName = account ? (list.find((c) => c.customer_account_id === account)?.customer_name || account) : 'All customers'

  return (
    <div style={{ fontFamily: FONT, color: C.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap');`}</style>

      <Card style={{ position: 'relative', zIndex: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Seg options={PRESETS as any} value={preset as any} onChange={(k) => pickPreset(k as Preset)} />
              <Seg options={MODES as any} value={modeKey} onChange={(k) => setModeKey(k as ModeKey)} />
            </div>
            {loading && <span style={{ fontSize: 12, color: C.mut }}>Loading…</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <Field label="From"><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom') }} style={dateInput} /></Field>
            <Field label="To"><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom') }} style={dateInput} /></Field>
            <Field label="Customer"><SearchSelect value={account} onChange={setAccount} options={custOpts} placeholder="All customers" width={300} /></Field>
          </div>
        </div>
      </Card>

      {err && <Card style={{ color: C.red, fontSize: 13 }}>Failed to load report: {err}</Card>}

      <KpiRail
        items={[
          { label: 'Revenue', value: cf.format(rev), delta: deltaStr(rev, pRev), sub: `prev ${cf.format(pRev)}`, accent: NAVY },
          { label: 'Gross profit', value: cf.format(gp), delta: `${margin.toFixed(1)}% margin`, sub: `prev ${cf.format(pGp)}`, accent: ORANGE },
          { label: 'Jobs', value: nf.format(jobs), delta: deltaStr(jobs, pJobs), accent: BLUE },
          { label: 'Pending', value: cf.format(num(ar?.open_balance)), sub: `${nf.format(num(ar?.open_count))} open invoices`, accent: overdue > 0 ? C.red : NAVY },
          { label: 'Overdue', value: cf.format(overdue), sub: `90+ : ${cf.format(num(ar?.d90_plus))}`, accent: C.red },
          { label: 'Time to pay (DSO)', value: ar?.dso_days != null ? `${nf.format(num(ar?.dso_days))} days` : '—', sub: `${nf.format(num(ar?.avg_overdue_days))}d avg overdue`, accent: NAVY },
        ]}
      />

      <Card>
        <Title right={<div style={{ display: 'flex', gap: 14 }}><LegendDot c={NAVY} t="Revenue" /><LegendDot c={ORANGE} t="Gross profit" /></div>}>
          Revenue &amp; gross profit — {scopeName}
        </Title>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={trendData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }} barGap={4} barCategoryGap="22%">
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + nf.format(Number(v))} />
            <Tooltip content={<MoneyTip />} cursor={{ fill: 'rgba(10,36,114,.05)' }} />
            <Bar dataKey="revenue" name="Revenue" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="gp" name="Gross profit" fill={ORANGE} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <Title right={<span style={{ fontSize: 12, color: C.mut }}>{nf.format(num(ar?.open_count))} invoices · {cf.format(num(ar?.open_balance))}</span>}>
            Invoice aging — {scopeName}
          </Title>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={agingData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + nf.format(Number(v))} />
              <Tooltip content={<AgingTip />} cursor={{ fill: 'rgba(10,36,114,.05)' }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={64}>
                {agingData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <Title right={<div style={{ display: 'flex', gap: 14 }}><LegendDot c={NAVY} t="This period" /><LegendDot c={C.faint} t="Previous" /></div>}>
            This period vs previous
          </Title>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={prevData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }} barGap={6}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + nf.format(Number(v))} />
              <Tooltip content={<MoneyTip />} cursor={{ fill: 'rgba(10,36,114,.05)' }} />
              <Bar dataKey="previous" name="Previous" fill={C.faint} radius={[4, 4, 0, 0]} maxBarSize={44} />
              <Bar dataKey="current" name="This period" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {account === null ? (
          <Card pad={0}>
            <div style={{ padding: '16px 18px 0' }}><span style={{ fontSize: 14, fontWeight: 600 }}>Top customers</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col /><col style={{ width: 56 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} /></colgroup>
              <thead><tr><Th>Customer</Th><Th right>Jobs</Th><Th right>Revenue</Th><Th right>GP</Th><Th right>Open</Th></tr></thead>
              <tbody>
                {listSlice.map((r) => (
                  <tr key={r.customer_account_id} onClick={() => setAccount(r.customer_account_id)} style={{ borderTop: `1px solid ${C.line}`, cursor: 'pointer' }}>
                    <Td strong trunc title={r.customer_name || undefined}>{r.customer_name || r.customer_account_id}</Td>
                    <Td right>{nf.format(num(r.jobs))}</Td>
                    <Td right strong>{cf.format(num(r.revenue))}</Td>
                    <Td right>{cf.format(num(r.gross_profit))}</Td>
                    <Td right>{num(r.open_balance) > 0 ? <span style={{ color: C.red, fontWeight: 600 }}>{cf.format(num(r.open_balance))}</span> : '—'}</Td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>No customers in range.</td></tr>}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px' }}><Pagination page={listPage} total={list.length} pageSize={PAGE_SIZE} onPageChange={setListPage} /></div>
          </Card>
        ) : (
          <Card pad={0}>
            <div style={{ padding: '16px 18px 0' }}><span style={{ fontSize: 14, fontWeight: 600 }}>Trade lanes</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 52 }} /><col style={{ width: 50 }} /><col style={{ width: 92 }} /><col style={{ width: 88 }} /></colgroup>
              <thead><tr><Th>Origin</Th><Th>Dest</Th><Th>Mode</Th><Th right>Jobs</Th><Th right>Revenue</Th><Th right>GP</Th></tr></thead>
              <tbody>
                {laneSlice.map((r, i) => (
                  <tr key={`${r.origin}-${r.destination}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                    <Td strong>{flag(r.origin, r.mode)}{r.origin}</Td>
                    <Td>{flag(r.destination, r.mode)}{r.destination}</Td>
                    <Td muted>{r.direction === 'import' ? 'I' : 'E'}·{r.mode === 'air' ? 'Air' : 'Sea'}</Td>
                    <Td right>{nf.format(num(r.jobs))}</Td>
                    <Td right strong>{cf.format(num(r.revenue))}</Td>
                    <Td right>{cf.format(num(r.gross_profit))}</Td>
                  </tr>
                ))}
                {lanes.length === 0 && <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>No lanes in range.</td></tr>}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px' }}><Pagination page={lanePage} total={lanes.length} pageSize={PAGE_SIZE} onPageChange={setLanePage} /></div>
          </Card>
        )}

        <Card pad={0}>
          <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Open invoices</span>
            <span style={{ fontSize: 12, color: C.mut }}>worst first</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 110 }} />{account === null ? <col /> : null}<col style={{ width: 92 }} /><col style={{ width: 72 }} /><col style={{ width: 92 }} /></colgroup>
            <thead><tr><Th>Invoice</Th>{account === null ? <Th>Customer</Th> : null}<Th>Due</Th><Th right>Overdue</Th><Th right>Balance</Th></tr></thead>
            <tbody>
              {invSlice.map((r) => (
                <tr key={r.invoice_no} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td strong>{r.invoice_no}<span style={{ color: C.mut, fontWeight: 400 }}> · {docLabel[r.doctype] || r.doctype}</span></Td>
                  {account === null ? <Td muted trunc title={r.customer_name || undefined}>{r.customer_name || r.account_id}</Td> : null}
                  <Td muted>{r.date_due}</Td>
                  <Td right>{dayPill(num(r.days_overdue))}</Td>
                  <Td right strong>{cf.format(num(r.balance))}</Td>
                </tr>
              ))}
              {openInv.length === 0 && <tr><td colSpan={account === null ? 5 : 4} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>Nothing outstanding.</td></tr>}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px' }}><Pagination page={invPage} total={openInv.length} pageSize={PAGE_SIZE} onPageChange={setInvPage} /></div>
        </Card>
      </div>
    </div>
  )
}
