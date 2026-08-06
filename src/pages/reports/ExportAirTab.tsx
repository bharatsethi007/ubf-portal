import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { supabase } from '@/supabase'
import Pagination from '@/components/Pagination'
import { NAVY, BLUE, C, FONT, glass, nf, cf, Card, Title, LegendDot, KpiRail, Th, Td, Seg, SearchSelect, type Opt } from './reportsUi'

const PAGE_SIZE = 20

type TrendRow = { month: string; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
type LaneRow = { origin: string; destination: string; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
type PartyRow = { customer_account_id: string | null; customer_name: string | null; consignee_name: string | null; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
type DestRow = { destination: string; houses: number }
type CustomerRow = { customer_account_id: string; customer_name: string | null; houses: number }
type ConsigneeRow = { consignee_name: string; houses: number }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const num = (v: any) => Number(v || 0)
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const monthLabel = (iso: string) => { const [y, m] = iso.split('-'); return `${MONTHS[Number(m) - 1]} ${y.slice(2)}` }
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)

const PRESETS = [
  { k: '1m', label: 'Month' },
  { k: '3m', label: '3 Months' },
  { k: 'q', label: 'Quarter' },
  { k: '6m', label: '6 Months' },
  { k: '1y', label: 'Year' },
] as const
type Preset = (typeof PRESETS)[number]['k'] | 'custom'

function rangeFor(k: Preset): { from: string; to: string } {
  const today = new Date()
  let start = addMonths(today, -12)
  if (k === '1m') start = addMonths(today, -1)
  else if (k === '3m') start = addMonths(today, -3)
  else if (k === 'q') start = startOfQuarter(today)
  else if (k === '6m') start = addMonths(today, -6)
  return { from: isoDate(start), to: isoDate(today) }
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ ...glass, background: 'rgba(255,255,255,.92)', padding: '10px 12px', borderRadius: 11 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: i ? 5 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color ?? p.stroke ?? p.fill }} />
          <span style={{ color: C.ink2 }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
            {p.dataKey === 'revenue' ? cf.format(num(p.value)) : nf.format(num(p.value)) + ' kg'}
          </span>
        </div>
      ))}
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: any }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: 11.5, color: C.ink2 }}>{label}</span>
    {children}
  </div>
)

export default function ExportAirTab() {
  const initial = rangeFor('1y')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [preset, setPreset] = useState<Preset>('1y')
  const [destination, setDestination] = useState<string | null>(null)
  const [customer, setCustomer] = useState<string | null>(null)
  const [consignee, setConsignee] = useState<string | null>(null)

  const [trend, setTrend] = useState<TrendRow[]>([])
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [parties, setParties] = useState<PartyRow[]>([])
  const [dests, setDests] = useState<DestRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [consignees, setConsignees] = useState<ConsigneeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lanePage, setLanePage] = useState(1)
  const [partyPage, setPartyPage] = useState(1)

  function pickPreset(k: Preset) {
    const r = rangeFor(k)
    setFrom(r.from); setTo(r.to); setPreset(k)
  }

  // dropdown option lists — depend only on the date range
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [de, cu, co] = await Promise.all([
        supabase.rpc('report_expair_destinations', { p_from: from, p_to: to }),
        supabase.rpc('report_expair_customers', { p_from: from, p_to: to }),
        supabase.rpc('report_expair_consignees', { p_from: from, p_to: to }),
      ])
      if (cancelled) return
      setDests((de.data ?? []) as DestRow[])
      setCustomers((cu.data ?? []) as CustomerRow[])
      setConsignees((co.data ?? []) as ConsigneeRow[])
    })()
    return () => { cancelled = true }
  }, [from, to])

  // report data — depends on all filters
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      const args = { p_from: from, p_to: to, p_destination: destination, p_customer: customer, p_consignee: consignee }
      const [tr, ln, pa] = await Promise.all([
        supabase.rpc('report_expair_trend', args),
        supabase.rpc('report_expair_lanes', { ...args, p_limit: 300 }),
        supabase.rpc('report_expair_parties', { ...args, p_limit: 300 }),
      ])
      if (cancelled) return
      const e = tr.error || ln.error || pa.error
      if (e) { setErr(e.message); setTrend([]); setLanes([]); setParties([]) }
      else {
        setTrend((tr.data ?? []) as TrendRow[])
        setLanes((ln.data ?? []) as LaneRow[])
        setParties((pa.data ?? []) as PartyRow[])
      }
      setLoading(false); setLanePage(1); setPartyPage(1)
    })()
    return () => { cancelled = true }
  }, [from, to, destination, customer, consignee])

  const totals = useMemo(() => {
    const masters = trend.reduce((s, r) => s + num(r.masters), 0)
    const houses = trend.reduce((s, r) => s + num(r.houses), 0)
    const kg = trend.reduce((s, r) => s + num(r.chargeable_kg), 0)
    const rev = trend.reduce((s, r) => s + num(r.revenue), 0)
    return { masters, houses, kg, rev, avg: houses ? rev / houses : 0 }
  }, [trend])

  const chartData = useMemo(
    () => trend.map((r) => ({ label: monthLabel(r.month), chargeable_kg: num(r.chargeable_kg), revenue: num(r.revenue) })),
    [trend],
  )

  const destOpts: Opt[] = useMemo(() => dests.map((d) => ({ value: d.destination, label: `${d.destination} (${nf.format(num(d.houses))})` })), [dests])
  const custOpts: Opt[] = useMemo(() => customers.map((c) => ({ value: c.customer_account_id, label: `${c.customer_name || c.customer_account_id} (${nf.format(num(c.houses))})` })), [customers])
  const consOpts: Opt[] = useMemo(() => consignees.map((c) => ({ value: c.consignee_name, label: `${c.consignee_name} (${nf.format(num(c.houses))})` })), [consignees])

  const laneSlice = lanes.slice((lanePage - 1) * PAGE_SIZE, lanePage * PAGE_SIZE)
  const partySlice = parties.slice((partyPage - 1) * PAGE_SIZE, partyPage * PAGE_SIZE)

  const dateInput: CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 10px',
    fontSize: 13, color: C.ink, background: 'rgba(255,255,255,.7)', fontFamily: FONT,
  }

  return (
    <div style={{ fontFamily: FONT, color: C.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap');`}</style>

      <Card style={{ position: 'relative', zIndex: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Seg options={PRESETS as any} value={preset as any} onChange={(k) => pickPreset(k as Preset)} />
            {loading && <span style={{ fontSize: 12, color: C.mut }}>Loading…</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <Field label="From"><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom') }} style={dateInput} /></Field>
            <Field label="To"><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom') }} style={dateInput} /></Field>
            <Field label="Destination"><SearchSelect value={destination} onChange={setDestination} options={destOpts} placeholder="All destinations" width={210} /></Field>
            <Field label="Customer"><SearchSelect value={customer} onChange={setCustomer} options={custOpts} placeholder="All customers" width={250} /></Field>
            <Field label="Consignee"><SearchSelect value={consignee} onChange={setConsignee} options={consOpts} placeholder="All consignees" width={250} /></Field>
          </div>
        </div>
      </Card>

      {err && <Card style={{ color: C.red, fontSize: 13 }}>Failed to load report: {err}</Card>}

      <KpiRail
        items={[
          { label: 'Master bills', value: nf.format(totals.masters), accent: NAVY },
          { label: 'House bills', value: nf.format(totals.houses), accent: NAVY },
          { label: 'Chargeable kg', value: nf.format(Math.round(totals.kg)) },
          { label: 'Revenue', value: cf.format(totals.rev) },
          { label: 'Avg / house', value: cf.format(totals.avg) },
        ]}
      />

      <Card>
        <Title right={<div style={{ display: 'flex', gap: 14 }}><LegendDot c={NAVY} t="Chargeable kg" /><LegendDot c={BLUE} t="Revenue" /></div>}>
          Monthly trend
        </Title>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => nf.format(Number(v))} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + nf.format(Number(v))} />
            <Tooltip content={<ChartTip />} cursor={{ stroke: C.border }} />
            <Line yAxisId="l" type="monotone" dataKey="chargeable_kg" name="Chargeable kg" stroke={NAVY} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: NAVY }} />
            <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke={BLUE} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: BLUE }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card pad={0}>
          <div style={{ padding: '16px 18px 0' }}><span style={{ fontSize: 14, fontWeight: 600 }}>Lanes</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 66 }} /><col /><col style={{ width: 62 }} /><col style={{ width: 62 }} /><col style={{ width: 84 }} /><col style={{ width: 104 }} />
            </colgroup>
            <thead><tr><Th>Origin</Th><Th>Dest</Th><Th right>Master</Th><Th right>House</Th><Th right>Chg kg</Th><Th right>Revenue</Th></tr></thead>
            <tbody>
              {laneSlice.map((r, i) => (
                <tr key={`${r.origin}-${r.destination}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td strong>{r.origin}</Td><Td>{r.destination}</Td>
                  <Td right>{nf.format(num(r.masters))}</Td><Td right>{nf.format(num(r.houses))}</Td>
                  <Td right>{nf.format(Math.round(num(r.chargeable_kg)))}</Td><Td right strong>{cf.format(num(r.revenue))}</Td>
                </tr>
              ))}
              {!loading && lanes.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>No lanes in range.</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px' }}>
            <Pagination page={lanePage} total={lanes.length} pageSize={PAGE_SIZE} onPageChange={setLanePage} />
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '16px 18px 0' }}><span style={{ fontSize: 14, fontWeight: 600 }}>Customers / Consignees</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col /><col style={{ width: 62 }} /><col style={{ width: 62 }} /><col style={{ width: 84 }} /><col style={{ width: 104 }} />
            </colgroup>
            <thead><tr><Th>Customer</Th><Th>Consignee</Th><Th right>Master</Th><Th right>House</Th><Th right>Chg kg</Th><Th right>Revenue</Th></tr></thead>
            <tbody>
              {partySlice.map((r, i) => (
                <tr key={`${r.customer_account_id}-${r.consignee_name}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td strong trunc title={r.customer_name || undefined}>{r.customer_name || '—'}</Td>
                  <Td muted trunc title={r.consignee_name || undefined}>{r.consignee_name || '—'}</Td>
                  <Td right>{nf.format(num(r.masters))}</Td><Td right>{nf.format(num(r.houses))}</Td>
                  <Td right>{nf.format(Math.round(num(r.chargeable_kg)))}</Td><Td right strong>{cf.format(num(r.revenue))}</Td>
                </tr>
              ))}
              {!loading && parties.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>No parties in range.</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px' }}>
            <Pagination page={partyPage} total={parties.length} pageSize={PAGE_SIZE} onPageChange={setPartyPage} />
          </div>
        </Card>
      </div>
    </div>
  )
}
