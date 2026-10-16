import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import type { StatsPeriod } from '../quotesStatsApi'
import { fmtHrs } from './leaderboardFormat'

type Row = { user_id: string | null; name: string; created: number; published: number; live_now: number; lanes_live: number; customers: number; avg_gp: number | null; hrs_to_approve: number | null }

const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500'
const td = 'px-3 py-2 text-[13px]'
const num = `${td} text-right tabular-nums`

/** Leaderboard > Rate cards: customer rate cards per sales owner for the period. */
export default function RateCardsLeaderboard({ period }: { period: StatsPeriod }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => {
    setRows(null)
    supabase.rpc('quotes_leaderboard_rate_cards', { p_period: period }).then(({ data, error }) => setRows(error ? [] : ((data ?? []) as Row[])))
  }, [period])

  if (!rows) return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-500">No customer rate cards in this period.</p>
  return (
    <table className="w-full border-collapse">
      <thead className="bg-slate-50"><tr>
        <th className={th}>#</th><th className={th}>Sales</th>
        <th className={`${th} text-right`}>Created</th><th className={`${th} text-right`}>Published</th>
        <th className={`${th} text-right`}>Live now</th><th className={`${th} text-right`}>Lanes live</th><th className={`${th} text-right`}>Customers</th>
        <th className={`${th} text-right`} title="Average freight GP of rate cards published this period">Avg GP</th>
        <th className={`${th} text-right`} title="Median: sent for approval to approved">Time to approve</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.user_id ?? r.name} className="border-t border-slate-100">
            <td className={td}>{i + 1}</td><td className={`${td} text-slate-900`}>{r.name}</td>
            <td className={num}>{r.created}</td><td className={num} style={{ color: '#047857' }}>{r.published}</td>
            <td className={num}>{r.live_now}</td><td className={num}>{r.lanes_live}</td><td className={num}>{r.customers}</td>
            <td className={num} style={{ color: r.avg_gp != null && r.avg_gp < 10 ? '#B91C1C' : undefined }}>{r.avg_gp == null ? '–' : `${r.avg_gp}%`}</td>
            <td className={num}>{fmtHrs(r.hrs_to_approve)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
