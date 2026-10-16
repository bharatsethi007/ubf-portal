import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffList } from '../../hooks/useStaffList'
import { quoteStatusPill } from '../quotes/quotesTableColumns'
import QuotePeekDialog from './QuotePeekDialog'
import { fmtHours, listAgentQuotes, modeOf, pct, type AgentQuoteRow, type AgentStats } from './agentStatsApi'

const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' }, { key: 'held', label: 'Held' },
]

function fmtDay(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' })
}

function hoursBetween(a: string, b: string | null): number | null {
  if (!b) return null
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600000
  return isNaN(h) ? null : Math.max(0, h)
}

/** Quotes made for this agent: summary strip, status filter, list. */
export default function AgentQuotesTab({ agentId, stats }: { agentId: string; stats: AgentStats | null }) {
  const navigate = useNavigate()
  const { staff } = useStaffList()
  const [status, setStatus] = useState('all')
  const [rows, setRows] = useState<AgentQuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [peek, setPeek] = useState<string | null>(null)
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.user_id, s.name])), [staff])

  useEffect(() => {
    let off = false
    setLoading(true)
    listAgentQuotes(agentId, status)
      .then((r) => { if (!off) setRows(r) })
      .catch(() => { if (!off) setRows([]) })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [agentId, status])

  const s = stats
  const modes = s?.modes ?? []
  const modeTotal = modes.reduce((t, m) => t + m.n, 0)
  const MODE_C = ['#0A2472', '#5B7BD5', '#C7D0E6', '#E4E7EC']
  const cell = 'flex min-w-0 flex-col gap-0.5 border-r border-[#F0F1F4] px-4 py-3 last:border-r-0'
  const count = (k: string) => (!s ? '' : k === 'all' ? s.quotes : k === 'won' ? s.won : k === 'lost' ? s.lost : k === 'held' ? s.held : s.open)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[#E6E8EE] bg-white md:grid-cols-4 xl:grid-cols-7">
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Quoted · 12m</span><span className="text-[20px]">{s?.quotes ?? '–'}</span></div>
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Open</span><span className="text-[20px] text-[#1D4ED8]">{s?.open ?? '–'}</span></div>
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Won</span><span className="text-[20px] text-[#067647]">{s?.won ?? '–'}</span></div>
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Lost</span><span className="text-[20px] text-[#B42318]">{s?.lost ?? '–'}</span></div>
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Conversion</span><span className="text-[20px]">{s && pct(s.won, s.quotes) != null ? `${pct(s.won, s.quotes)}%` : '–'}</span></div>
        <div className={cell}><span className="text-[11.5px] text-[#5B6474]">Median time to win</span><span className="text-[20px]">{fmtHours(s?.hrs_to_win)}</span></div>
        <div className={cell}>
          <span className="text-[11.5px] text-[#5B6474]">Mode split</span>
          <span className="my-1.5 flex h-2 overflow-hidden rounded-full bg-[#F1F3F7]" aria-hidden="true">
            {modes.map((m, i) => <span key={m.mode} style={{ width: `${(m.n / Math.max(1, modeTotal)) * 100}%`, background: MODE_C[i] ?? '#E4E7EC' }} />)}
          </span>
          <span className="truncate text-[11px] text-[#5B6474]">{modes.map((m) => `${m.mode} ${Math.round((m.n / Math.max(1, modeTotal)) * 100)}%`).join(' · ') || '–'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="customers-segment" role="group" aria-label="Quote status">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setStatus(f.key)}
              className={`customers-segment__btn${status === f.key ? ' customers-segment__btn--on' : ''}`}>
              {f.label} {count(f.key)}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate('/quotes/new')}>New quote</button>
      </div>

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quote #</th><th>Mode</th><th>Lane</th><th>Status</th><th>Pricing</th>
                <th style={{ textAlign: 'right' }}>Created</th><th style={{ textAlign: 'right' }}>Won</th><th style={{ textAlign: 'right' }}>Time to win</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-muted-foreground pad-inline">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-muted-foreground pad-inline">No quotes for this agent yet.</td></tr>
              ) : rows.map((q) => (
                <tr key={q.id} className="row-clickable" onClick={() => setPeek(q.id)} title="Open quote">
                  <td className="font-mono text-[12px]">{q.quote_no ?? '—'}</td>
                  <td>{modeOf(q.shipment_mode, q.shipment_type)}</td>
                  <td className="font-mono text-[12px]">{q.from_port_code ?? '?'} &gt; {q.to_port_code ?? '?'}</td>
                  <td>{quoteStatusPill(q.status)}</td>
                  <td>{staffMap.get(q.pricing_executive_id ?? q.created_by ?? '') ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(q.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(q.won_at)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtHours(hoursBetween(q.created_at, q.won_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <QuotePeekDialog quoteId={peek} onClose={() => setPeek(null)} />
      <p className="m-0 text-[11.5px] text-[#5B6474]">Agent quotes have no sales owner. Pricing shows who built the quote.</p>
    </div>
  )
}
