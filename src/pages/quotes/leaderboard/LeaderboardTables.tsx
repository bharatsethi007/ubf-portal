import { STATUS_TONE } from '../quoteTones'
import type { LbAgent, LbCustomer, LbExtra, LbSales, LbStaff } from './leaderboardApi'
import { fmtDay, fmtHrs } from './leaderboardFormat'
import { ConversionBar, DecidedRate, PricingBar, TrendSpark } from './LeaderboardExtras'

const HELD = STATUS_TONE.held.fg

const MEDAL = ['#C9A227', '#9AA4B2', '#B87333']

function Rank({ i }: { i: number }) {
  const c = MEDAL[i]
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
      style={c ? { background: c, color: '#fff' } : { background: '#F1F5F9', color: '#475569' }}
    >
      {i + 1}
    </span>
  )
}

function Initials({ name }: { name: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]" style={{ background: '#E8EDF7', color: '#0A2472' }}>
      {ini || '?'}
    </span>
  )
}

function QuotesBar({ v, max }: { v: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-7 text-right tabular-nums text-slate-900">{v}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: '#0A2472' }} />
      </span>
    </span>
  )
}

const TTQ = 'Median: quote created to last rate line added'
const TTW = 'Median: quote created to marked won'
const CONV = 'Won out of all quotes, open ones included'
const DEC = 'Won out of quotes the customer decided on (won + lost)'
const th = 'px-2 py-2 text-left text-[11px] font-normal uppercase tracking-wide text-slate-500 whitespace-nowrap'
const td = 'px-2 py-2 whitespace-nowrap'
const num = `${td} text-right tabular-nums`

export function StaffTable({ rows, extra }: { rows: LbStaff[]; extra?: LbExtra }) {
  if (!rows.length) return <p className="px-3 py-8 text-center text-sm text-slate-500">No quotes in this period.</p>
  const max = Math.max(...rows.map((r) => r.quotes))
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className={th}>#</th>
          <th className={th}>Sales support</th>
          <th className={th}>Quotes</th>
          <th className={`${th} text-right`}>/ Day</th>
          <th className={`${th} text-right`}>/ Week</th>
          <th className={`${th} text-right`}>/ Month</th>
          <th className={`${th} text-right`}>Held</th>
          <th className={`${th} text-right`}>Won</th>
          <th className={`${th} text-right`}>Lost</th>
          <th className={th} title={CONV}>Conversion</th>
          <th className={th} title={DEC}>Win rate</th>
          {extra && <th className={th} title="Conversion per week, last 8 weeks. Faded weeks are under 3 weeks old and still deciding. Number: settled weeks only.">Trend · 8 wk</th>}
          {extra && <th className={th} title="Where quote line prices came from this period">Pricing</th>}
          <th className={`${th} text-right`} title={TTQ}>Time to quote</th>
          <th className={`${th} text-right`} title="Median: customer email received to last rate line added">Email → quote</th>
          <th className={`${th} text-right`} title={TTW}>Time to win</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.user_id ?? r.name} className="border-t border-slate-100">
            <td className={td}><Rank i={i} /></td>
            <td className={td}>
              <span className="inline-flex items-center gap-2 text-slate-900"><Initials name={r.name} />{r.name}</span>
            </td>
            <td className={td}><QuotesBar v={r.quotes} max={max} /></td>
            <td className={num}>{r.per_day}</td>
            <td className={num}>{r.per_week}</td>
            <td className={num}>{r.per_month}</td>
            <td className={num} style={{ color: HELD }}>{r.held ?? 0}</td>
            <td className={num} style={{ color: '#047857' }}>{r.won}</td>
            <td className={num} style={{ color: '#B91C1C' }}>{r.lost}</td>
            <td className={td}><ConversionBar won={r.won} quotes={r.quotes} /></td>
            <td className={td}><DecidedRate rate={r.win_rate} won={r.won} lost={r.lost} /></td>
            {extra && <td className={td}><TrendSpark trend={extra.staff[r.user_id ?? 'none']?.trend} /></td>}
            {extra && <td className={td}><PricingBar p={extra.staff[r.user_id ?? 'none']?.pricing} /></td>}
            <td className={num}>{fmtHrs(r.avg_hrs_to_quote)}</td>
            <td className={num} title={`${r.email_matched} quote(s) matched to an email`}>{fmtHrs(r.avg_hrs_email_to_quote)}</td>
            <td className={num}>{fmtHrs(r.hrs_to_win)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function CustomerTable({ rows }: { rows: LbCustomer[] }) {
  if (!rows.length) return <p className="px-3 py-8 text-center text-sm text-slate-500">No quotes in this period.</p>
  const max = Math.max(...rows.map((r) => r.quotes))
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className={th}>#</th>
          <th className={th}>Customer</th>
          <th className={th}>Quotes</th>
          <th className={`${th} text-right`}>Open</th>
          <th className={`${th} text-right`}>Held</th>
          <th className={`${th} text-right`}>Won</th>
          <th className={`${th} text-right`}>Lost</th>
          <th className={th} title={CONV}>Conversion</th>
          <th className={th} title={DEC}>Win rate</th>
          <th className={`${th} text-right`} title={TTQ}>Time to quote</th>
          <th className={`${th} text-right`} title={TTW}>Time to win</th>
          <th className={`${th} text-right`}>Last quote</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.account_id ?? ''}-${r.name}`} className="border-t border-slate-100">
            <td className={td}><Rank i={i} /></td>
            <td className={`${td} max-w-[260px] truncate text-slate-900`} title={r.name}>{r.name}</td>
            <td className={td}><QuotesBar v={r.quotes} max={max} /></td>
            <td className={num}>{r.open}</td>
            <td className={num} style={{ color: HELD }}>{r.held ?? 0}</td>
            <td className={num} style={{ color: '#047857' }}>{r.won}</td>
            <td className={num} style={{ color: '#B91C1C' }}>{r.lost}</td>
            <td className={td}><ConversionBar won={r.won} quotes={r.quotes} /></td>
            <td className={td}><DecidedRate rate={r.win_rate} won={r.won} lost={r.lost} /></td>
            <td className={num}>{fmtHrs(r.avg_hrs_to_quote)}</td>
            <td className={num}>{fmtHrs(r.hrs_to_win)}</td>
            <td className={num}>{fmtDay(r.last_quote)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AgentTable({ rows }: { rows: LbAgent[] | undefined }) {
  if (!rows) return <p className="px-3 py-8 text-center text-sm text-slate-500">Agents report not available yet.</p>
  if (!rows.length) return <p className="px-3 py-8 text-center text-sm text-slate-500">No agent quotes in this period.</p>
  const max = Math.max(...rows.map((r) => r.quotes))
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className={th}>#</th>
          <th className={th}>Agent</th>
          <th className={th}>Country</th>
          <th className={th}>Quotes</th>
          <th className={`${th} text-right`}>Open</th>
          <th className={`${th} text-right`}>Held</th>
          <th className={`${th} text-right`}>Won</th>
          <th className={`${th} text-right`}>Lost</th>
          <th className={th} title={CONV}>Conversion</th>
          <th className={th} title={DEC}>Win rate</th>
          <th className={th} title="Most quoted origin to destination country">Top lane</th>
          <th className={`${th} text-right`} title={TTQ}>Time to quote</th>
          <th className={`${th} text-right`} title={TTW}>Time to win</th>
          <th className={`${th} text-right`}>Last quote</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.agent_id ?? r.name} className="border-t border-slate-100">
            <td className={td}><Rank i={i} /></td>
            <td className={`${td} max-w-[260px] truncate text-slate-900`} title={r.name}>{r.name}</td>
            <td className={`${td} text-slate-600`}>{r.country ?? '–'}</td>
            <td className={td}><QuotesBar v={r.quotes} max={max} /></td>
            <td className={num}>{r.open}</td>
            <td className={num} style={{ color: HELD }}>{r.held ?? 0}</td>
            <td className={num} style={{ color: '#047857' }}>{r.won}</td>
            <td className={num} style={{ color: '#B91C1C' }}>{r.lost}</td>
            <td className={td}><ConversionBar won={r.won} quotes={r.quotes} /></td>
            <td className={td}><DecidedRate rate={r.win_rate} won={r.won} lost={r.lost} /></td>
            <td className={`${td} tabular-nums text-slate-600`}>{r.top_lane ? r.top_lane.replace('>', ' > ') : '–'}</td>
            <td className={num}>{fmtHrs(r.avg_hrs_to_quote)}</td>
            <td className={num}>{fmtHrs(r.hrs_to_win)}</td>
            <td className={num}>{fmtDay(r.last_quote)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SalesTable({ rows }: { rows: LbSales[] | undefined }) {
  if (!rows) return <p className="px-3 py-8 text-center text-sm text-slate-500">Sales report not available yet.</p>
  if (!rows.length) return <p className="px-3 py-8 text-center text-sm text-slate-500">No won quotes in this period.</p>
  const max = Math.max(...rows.map((r) => r.won))
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className={th}>#</th>
          <th className={th}>Sales</th>
          <th className={th}>Won</th>
          <th className={`${th} text-right`} title={TTW}>Time to win</th>
          <th className={`${th} text-right`}>Last win</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.user_id ?? r.name} className="border-t border-slate-100">
            <td className={td}><Rank i={i} /></td>
            <td className={td}>
              <span className={`inline-flex items-center gap-2 ${r.user_id ? 'text-slate-900' : 'text-slate-500'}`}><Initials name={r.name} />{r.name}</span>
            </td>
            <td className={td}><QuotesBar v={r.won} max={max} /></td>
            <td className={num}>{fmtHrs(r.hrs_to_win)}</td>
            <td className={num}>{r.last_won ? fmtDay(r.last_won) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
