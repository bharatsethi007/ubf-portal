import type { LbCustomer, LbStaff } from './leaderboardApi'
import { fmtDay, fmtHrs, fmtPct } from './leaderboardFormat'

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

function WinBar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-400">–</span>
  const n = Number(v)
  const tone = n >= 50 ? '#047857' : n >= 25 ? '#B45309' : '#B91C1C'
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, n)}%`, background: tone }} />
      </span>
      <span className="w-9 text-right tabular-nums">{fmtPct(n)}</span>
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

const th = 'px-3 py-2 text-left text-[11px] font-normal uppercase tracking-wide text-slate-500 whitespace-nowrap'
const td = 'px-3 py-2 whitespace-nowrap'
const num = `${td} text-right tabular-nums`

export function StaffTable({ rows }: { rows: LbStaff[] }) {
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
          <th className={`${th} text-right`}>Won</th>
          <th className={`${th} text-right`}>Lost</th>
          <th className={th}>Win rate</th>
          <th className={`${th} text-right`} title="Quote created to first rate response">Time to quote</th>
          <th className={`${th} text-right`} title="Customer email received to first rate response">Email → quote</th>
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
            <td className={num} style={{ color: '#047857' }}>{r.won}</td>
            <td className={num} style={{ color: '#B91C1C' }}>{r.lost}</td>
            <td className={td}><WinBar v={r.win_rate} /></td>
            <td className={num}>{fmtHrs(r.avg_hrs_to_quote)}</td>
            <td className={num} title={`${r.email_matched} quote(s) matched to an email`}>{fmtHrs(r.avg_hrs_email_to_quote)}</td>
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
          <th className={`${th} text-right`}>Won</th>
          <th className={`${th} text-right`}>Lost</th>
          <th className={th}>Win rate</th>
          <th className={`${th} text-right`}>Time to quote</th>
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
            <td className={num} style={{ color: '#047857' }}>{r.won}</td>
            <td className={num} style={{ color: '#B91C1C' }}>{r.lost}</td>
            <td className={td}><WinBar v={r.win_rate} /></td>
            <td className={num}>{fmtHrs(r.avg_hrs_to_quote)}</td>
            <td className={num}>{fmtDay(r.last_quote)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
