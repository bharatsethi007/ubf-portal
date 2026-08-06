import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '@/supabase'
import Pagination from '@/components/Pagination'

const NAVY = '#0A2472'
const LIGHT_BLUE = '#5B9BD5'
const PAGE_SIZE = 8

type TrendRow = { month: string; jobs: number; chargeable_kg: number; revenue: number }
type LaneRow = { origin: string; destination: string; jobs: number; chargeable_kg: number; revenue: number }
type PartyRow = {
  customer_account_id: string
  customer_name: string
  consignee_name: string
  jobs: number
  chargeable_kg: number
  revenue: number
}
type DestRow = { destination: string; jobs: number }

const nf = new Intl.NumberFormat('en-NZ')
const cf = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function defaultRange() {
  const today = new Date()
  const past = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  return { from: isoDate(past), to: isoDate(today) }
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(iso: string) {
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

export default function ExportAirTab() {
  const init = defaultRange()
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [destination, setDestination] = useState('') // '' = All

  const [trend, setTrend] = useState<TrendRow[]>([])
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [parties, setParties] = useState<PartyRow[]>([])
  const [dests, setDests] = useState<DestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [lanePage, setLanePage] = useState(1)
  const [partyPage, setPartyPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErr(null)
      const p_destination = destination || null
      const [tr, ln, pa, de] = await Promise.all([
        supabase.rpc('report_expair_trend', { p_from: from, p_to: to, p_destination }),
        supabase.rpc('report_expair_lanes', { p_from: from, p_to: to, p_destination, p_limit: 200 }),
        supabase.rpc('report_expair_parties', { p_from: from, p_to: to, p_destination, p_limit: 200 }),
        supabase.rpc('report_expair_destinations', { p_from: from, p_to: to }),
      ])
      if (cancelled) return
      const firstErr = tr.error || ln.error || pa.error || de.error
      if (firstErr) {
        setErr(firstErr.message)
        setTrend([]); setLanes([]); setParties([]); setDests([])
      } else {
        setTrend((tr.data ?? []) as TrendRow[])
        setLanes((ln.data ?? []) as LaneRow[])
        setParties((pa.data ?? []) as PartyRow[])
        setDests((de.data ?? []) as DestRow[])
      }
      setLoading(false)
      setLanePage(1)
      setPartyPage(1)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [from, to, destination])

  const totals = useMemo(() => {
    const jobs = trend.reduce((s, r) => s + Number(r.jobs || 0), 0)
    const kg = trend.reduce((s, r) => s + Number(r.chargeable_kg || 0), 0)
    const rev = trend.reduce((s, r) => s + Number(r.revenue || 0), 0)
    return { jobs, kg, rev, avg: jobs ? rev / jobs : 0 }
  }, [trend])

  const chartData = useMemo(
    () =>
      trend.map((r) => ({
        label: monthLabel(r.month),
        jobs: Number(r.jobs || 0),
        revenue: Number(r.revenue || 0),
      })),
    [trend],
  )

  const laneSlice = lanes.slice((lanePage - 1) * PAGE_SIZE, lanePage * PAGE_SIZE)
  const partySlice = parties.slice((partyPage - 1) * PAGE_SIZE, partyPage * PAGE_SIZE)

  return (
    <div className="quotes-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div className="card quotes-page__card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
          <span className="text-muted-foreground">From</span>
          <input className="input input--sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
          <span className="text-muted-foreground">To</span>
          <input className="input input--sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
          <span className="text-muted-foreground">Destination</span>
          <select className="input input--sm" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">All destinations</option>
            {dests.map((d) => (
              <option key={d.destination} value={d.destination}>
                {d.destination} ({nf.format(Number(d.jobs || 0))})
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="text-muted-foreground" style={{ fontSize: 12 }}>Loading…</span>}
      </div>

      {err && (
        <div className="card" style={{ padding: 12, color: '#b91c1c', fontSize: 13 }}>
          Failed to load report: {err}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Jobs" value={nf.format(totals.jobs)} />
        <KpiCard label="Chargeable kg" value={nf.format(Math.round(totals.kg))} />
        <KpiCard label="Revenue" value={cf.format(totals.rev)} />
        <KpiCard label="Avg / job" value={cf.format(totals.avg)} />
      </div>

      {/* Trend chart */}
      <div className="card quotes-page__card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, color: NAVY, marginBottom: 8 }}>Monthly trend</div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => nf.format(Number(v))} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => nf.format(Number(v))} />
              <Tooltip formatter={(value: number, name: string) => (name === 'Revenue' ? cf.format(Number(value)) : nf.format(Number(value)))} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={NAVY} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="jobs" name="Jobs" fill={LIGHT_BLUE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lanes + Parties side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card quotes-page__card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, color: NAVY, padding: '12px 16px' }}>Lanes</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Origin</th>
                  <th>Dest</th>
                  <th style={{ textAlign: 'right' }}>Jobs</th>
                  <th style={{ textAlign: 'right' }}>Chg kg</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {laneSlice.map((r, i) => (
                  <tr key={`${r.origin}-${r.destination}-${i}`}>
                    <td>{r.origin}</td>
                    <td>{r.destination}</td>
                    <td style={{ textAlign: 'right' }}>{nf.format(Number(r.jobs || 0))}</td>
                    <td style={{ textAlign: 'right' }}>{nf.format(Math.round(Number(r.chargeable_kg || 0)))}</td>
                    <td style={{ textAlign: 'right' }}>{cf.format(Number(r.revenue || 0))}</td>
                  </tr>
                ))}
                {!loading && lanes.length === 0 && (
                  <tr><td colSpan={5} className="text-muted-foreground pad-inline">No lanes in range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <Pagination page={lanePage} total={lanes.length} pageSize={PAGE_SIZE} onPageChange={setLanePage} />
          </div>
        </div>

        <div className="card quotes-page__card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, color: NAVY, padding: '12px 16px' }}>Customers / Consignees</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Consignee</th>
                  <th style={{ textAlign: 'right' }}>Jobs</th>
                  <th style={{ textAlign: 'right' }}>Chg kg</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {partySlice.map((r, i) => (
                  <tr key={`${r.customer_account_id}-${r.consignee_name}-${i}`}>
                    <td>{r.customer_name}</td>
                    <td>{r.consignee_name}</td>
                    <td style={{ textAlign: 'right' }}>{nf.format(Number(r.jobs || 0))}</td>
                    <td style={{ textAlign: 'right' }}>{nf.format(Math.round(Number(r.chargeable_kg || 0)))}</td>
                    <td style={{ textAlign: 'right' }}>{cf.format(Number(r.revenue || 0))}</td>
                  </tr>
                ))}
                {!loading && parties.length === 0 && (
                  <tr><td colSpan={5} className="text-muted-foreground pad-inline">No parties in range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <Pagination page={partyPage} total={parties.length} pageSize={PAGE_SIZE} onPageChange={setPartyPage} />
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card quotes-page__card" style={{ padding: 14, borderLeft: `3px solid ${NAVY}` }}>
      <div className="text-muted-foreground" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginTop: 4 }}>{value}</div>
    </div>
  )
}
