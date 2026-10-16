import { fmtHours, fmtMoney, pct, type AgentStats, type Bookings } from './agentStatsApi'

const tile = 'flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-[#E6E8EE] bg-white px-3.5 py-3'
const lbl = 'text-[11.5px] text-[#5B6474]'
const val = 'text-[21px] leading-[27px] tracking-[-0.01em]'
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function fmtKg(kg: number | null | undefined): string {
  if (!kg) return '0 kg'
  return kg >= 1000 ? `${(kg / 1000).toLocaleString('en-NZ', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`
}

/** Agent overview header: KPIs, quoted vs won trend, trade lanes from quotes and shipments. */
export default function AgentOverviewStats({ stats: s, outstanding, bookings: b }: { stats: AgentStats | null; outstanding: Record<string, number>; bookings: Bookings | null }) {
  const conv = s ? pct(s.won, s.quotes) : null
  const owing = Object.entries(outstanding).filter(([, v]) => Math.abs(v) >= 0.01)
  const trend = s?.trend ?? []
  const maxT = Math.max(1, ...trend.map((t) => t.quotes))
  const lanes = s?.lanes ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <div className={tile}><span className={lbl}>Quotes · 12 months</span><span className={val}>{s?.quotes ?? '–'}</span><span className={lbl}>{s ? `${s.open} open now` : ''}</span></div>
        <div className={tile}><span className={lbl}>Won</span><span className={val} style={{ color: '#067647' }}>{s?.won ?? '–'}</span><span className={lbl}>{s ? `${s.lost} lost · ${s.held} held` : ''}</span></div>
        <div className={tile} title="Won out of all quotes for this agent"><span className={lbl}>Conversion</span><span className={val}>{conv == null ? '–' : `${conv}%`}</span><span className={lbl}>{s?.team_conv != null ? `Team average ${s.team_conv}%` : ''}</span></div>
        <div className={tile} title="Median: quote created to marked won"><span className={lbl}>Median time to win</span><span className={val}>{fmtHours(s?.hrs_to_win)}</span><span className={lbl}>{s?.fastest_win != null ? `Fastest ${fmtHours(s.fastest_win)}` : ''}</span></div>
        <div className={tile} title="Free hand: import with no freight billed by us, or export with freight billed to the agent. Last 12 months"><span className={lbl}>Free hand from agent</span><span className={val}>{b?.freehand ?? '–'}</span><span className={lbl}>{b?.freehand ? `${fmtMoney(b.freehand_gp)} GP · ${fmtKg(b.freehand_kg)}` : 'No jobs received'}</span></div>
        <div className={tile} title="Nomination: freight billed to the customer, agent used. Last 12 months"><span className={lbl}>Our nominations</span><span className={val}>{b?.booked ?? '–'}</span><span className={lbl}>{b?.booked ? `${fmtMoney(b.booked_gp)} GP · ${fmtKg(b.booked_kg)}` : 'No jobs given'}</span></div>
        <div className={tile}><span className={lbl}>Outstanding</span>
          <span className={val}>{owing.length ? owing.map(([c, v]) => `${c} ${Math.round(v).toLocaleString('en-NZ')}`).join(' · ') : '–'}</span>
          <span className={lbl}>{owing.length ? 'Open invoices' : 'Nothing owing'}</span></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="cp-card">
          <div className="cp-card-head"><h3 className="cp-card-title">Quoted vs won</h3><span className="text-muted-foreground">Last 12 months</span></div>
          <div className="grid h-[150px] grid-cols-12 items-end gap-2 px-4 pb-2 pt-3">
            {trend.map((t) => (
              <div key={t.month} className="flex h-full flex-col items-center justify-end gap-1.5" title={`${t.month}: ${t.quotes} quoted, ${t.won} won`}>
                <div className="flex h-[110px] items-end gap-[3px]">
                  <span className="w-2.5 rounded-t-[3px] bg-[#C7D0E6]" style={{ height: `${(t.quotes / maxT) * 110}px` }} />
                  <span className="w-2.5 rounded-t-[3px] bg-[#0A2472]" style={{ height: `${(t.won / maxT) * 110}px` }} />
                </div>
                <span className="text-[10.5px] text-[#5B6474]">{MONTHS[Number(t.month.slice(5, 7)) - 1]}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 px-4 pb-3 text-[11.5px] text-[#5B6474]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#C7D0E6]" />Quoted</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0A2472]" />Won</span>
          </div>
        </section>

        <section className="cp-card">
          <div className="cp-card-head"><h3 className="cp-card-title">Trade lanes</h3><span className="text-muted-foreground">Quotes and shipments</span></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Lane</th><th style={{ textAlign: 'right' }}>Quoted</th><th style={{ textAlign: 'right' }}>Won</th><th>Conversion</th><th style={{ textAlign: 'right' }}>Shipments</th><th style={{ textAlign: 'right' }}>Weight</th></tr></thead>
              <tbody>
                {lanes.length === 0 ? (
                  <tr><td colSpan={6} className="text-muted-foreground pad-inline">No quotes or shipments in the last 12 months.</td></tr>
                ) : lanes.map((l) => {
                  const c = pct(l.w, l.q)
                  return (
                    <tr key={l.lane}>
                      <td className="font-mono text-[12px]">{l.lane}</td>
                      <td style={{ textAlign: 'right' }}>{l.q || '–'}</td>
                      <td style={{ textAlign: 'right', color: '#067647' }}>{l.w || '–'}</td>
                      <td>{c == null ? '–' : (
                        <span className="inline-flex items-center gap-2"><span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-[#F1F3F7]"><span style={{ width: `${c}%`, background: c >= 35 ? '#067647' : '#0A2472' }} /></span><span className="text-[12px]">{c}%</span></span>
                      )}</td>
                      <td style={{ textAlign: 'right' }}>{l.s || '–'}</td>
                      <td style={{ textAlign: 'right' }}>{l.kg ? fmtKg(l.kg) : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
