import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AgreementPill from './AgreementPill'
import { fetchAgentsOverview, fetchBookingsOverview, fmtHours, fmtMoney, pct, type AgentsOverview, type Bookings } from './agentStatsApi'

const tile = 'flex min-w-0 flex-col gap-1 rounded-[10px] border border-[#E6E8EE] bg-white px-4 py-3'
const lbl = 'text-[11.5px] text-[#5B6474]'
const val = 'text-[22px] leading-7 tracking-[-0.01em] text-[#0F172A]'

/** Directory header: quote KPIs, agreement health, top lanes and agreements needing action. */
export default function AgentsStatsHeader() {
  const [o, setO] = useState<AgentsOverview | null>(null)
  const [b, setB] = useState<Bookings | null>(null)

  useEffect(() => {
    fetchAgentsOverview(12).then(setO).catch(() => setO(null))
    fetchBookingsOverview().then(setB).catch(() => setB(null))
  }, [])

  const a = o?.agreements ?? { active: 0, expiring: 0, expired: 0, awaiting: 0, draft: 0 }
  const agTotal = a.active + a.expiring + a.expired + a.awaiting
  const growth = o && o.prior_quotes > 0 ? Math.round(((o.quotes - o.prior_quotes) / o.prior_quotes) * 100) : null
  const conv = o ? pct(o.won, o.quotes) : null
  const maxLane = Math.max(1, ...(o?.lanes ?? []).map((l) => l.n))
  const seg = (n: number, c: string) => (agTotal ? <span style={{ width: `${(n / agTotal) * 100}%`, background: c }} /> : null)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className={tile}>
          <span className={lbl}>Agent quotes · 12 months</span>
          <span className={val}>{o ? o.quotes : '–'}</span>
          <span className={lbl}>
            {growth == null ? `${o?.active_agents ?? 0} agents quoted` : <><span style={{ color: growth >= 0 ? '#067647' : '#B42318' }}>{growth >= 0 ? '+' : ''}{growth}%</span> vs prior 12 months</>}
          </span>
        </div>
        <div className={tile} title="Won out of all agent quotes">
          <span className={lbl}>Conversion</span>
          <span className={val}>{conv == null ? '–' : `${conv}%`}</span>
          <span className={lbl}>{o ? `${o.won} won of ${o.quotes} quoted` : ''}</span>
        </div>
        <div className={tile} title="Median: quote created to marked won">
          <span className={lbl}>Median time to win</span>
          <span className={val}>{fmtHours(o?.hrs_to_win)}</span>
          <span className={lbl}>Quote created to won</span>
        </div>
        <div className={tile} title="Import jobs where the agent is our overseas agent, last 12 months">
          <span className={lbl}>Free hand from agents</span>
          <span className={val}>{b ? b.freehand.toLocaleString('en-NZ') : '–'} <span className="text-[13px] text-[#5B6474]">jobs</span></span>
          <span className={lbl}>{b ? `${fmtMoney(b.freehand_gp)} GP · ${b.freehand_agents} agents` : ''}</span>
        </div>
        <div className={tile} title="Export jobs we booked with an agent, last 12 months">
          <span className={lbl}>Booked with agents</span>
          <span className={val}>{b ? b.booked.toLocaleString('en-NZ') : '–'} <span className="text-[13px] text-[#5B6474]">jobs</span></span>
          <span className={lbl}>{b ? `${fmtMoney(b.booked_gp)} GP · ${b.booked_agents} agents · ${b.two_way_agents} two-way` : ''}</span>
        </div>
        <div className={tile}>
          <span className={lbl}>Agreements</span>
          <span className={val}>{a.active + a.expiring} <span className="text-[13px] text-[#5B6474]">active</span></span>
          <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[#F1F3F7]" aria-hidden="true">
            {seg(a.active, '#12B76A')}{seg(a.expiring, '#F79009')}{seg(a.expired, '#F04438')}{seg(a.awaiting, '#2E5BFF')}
          </span>
          <span className={lbl}>{a.expiring} expiring · {a.expired} expired · {a.awaiting} awaiting</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-[10px] border border-[#E6E8EE] bg-white px-[18px] py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 text-[13.5px] font-medium">Top agent trade lanes</h2>
            <span className={lbl}>Quoted · won · conversion</span>
          </div>
          {!o?.lanes.length ? <p className="m-0 text-[12.5px] text-[#5B6474]">No agent quotes yet.</p> : (
            <div className="flex flex-col gap-2">
              {o.lanes.map((l) => (
                <div key={l.lane} className="grid grid-cols-[130px_minmax(0,1fr)_70px_56px_40px] items-center gap-3 text-[12px]">
                  <span className="font-mono">{l.lane}</span>
                  <span className="flex h-2 overflow-hidden rounded-full bg-[#F1F3F7]"><span className="rounded-full bg-[#0A2472]" style={{ width: `${(l.n / maxLane) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{l.n} quoted</span>
                  <span className="text-right tabular-nums text-[#067647]">{l.w} won</span>
                  <span className="text-right tabular-nums text-[#5B6474]">{pct(l.w, l.n)}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="flex flex-col rounded-[10px] border border-[#E6E8EE] bg-white px-[18px] py-4">
          <h2 className="m-0 mb-2 text-[13.5px] font-medium">Agreements needing action</h2>
          {!o?.actions.length ? <p className="m-0 text-[12.5px] text-[#5B6474]">Nothing due. Expiring, unsigned and expired agreements show here.</p> : o.actions.map((x) => (
            <Link key={x.agent_id} to={`/agents/${x.agent_id}?tab=agreement`} className="flex items-center justify-between gap-3 border-t border-[#F0F1F4] py-2 text-[#0F172A] no-underline hover:no-underline">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px]">{x.name}</span>
                <span className="font-mono text-[11px] text-[#5B6474]">{x.ref}</span>
              </span>
              <AgreementPill state={x.state} expiry={x.expiry_date} daysLeft={x.days_left} />
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
