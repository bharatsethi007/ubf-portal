import { Lightbulb } from 'lucide-react'
import type { Leaderboard } from './leaderboardApi'
import { buildInsights } from './insightsData'
import DonutCard from './DonutCard'

export default function LeaderboardInsights({ lb }: { lb: Leaderboard }) {
  if (!lb.mix) return <p className="py-10 text-center text-sm text-slate-500">Insights need the latest database update.</p>
  const { charts, lanes, takeaways } = buildInsights(lb)
  const maxLane = Math.max(1, ...lanes.map((l) => l.n))
  return (
    <div className="flex flex-col gap-3 py-3">
      {takeaways.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-900"><Lightbulb size={15} className="text-amber-600" /> Key takeaways</div>
          <ul className="list-disc pl-5 text-xs leading-5 text-slate-700">{takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {charts.map((c) => <DonutCard key={c.key} chart={c} />)}
      </div>
      {lanes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-900">Top trade lanes</div>
          <div className="mb-3 text-xs text-slate-500">By country, origin to destination</div>
          <ul className="flex flex-col gap-1.5 text-xs">
            {lanes.map((l) => (
              <li key={l.label} className="flex items-center gap-3">
                <span className="w-64 shrink-0 truncate text-slate-700" title={l.label}>{l.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                  <span className="block h-full rounded" style={{ width: `${(l.n / maxLane) * 100}%`, background: '#2a78d6' }} />
                </span>
                <span className="w-8 text-right tabular-nums text-slate-900">{l.n}</span>
                <span className="w-16 text-right tabular-nums text-slate-500">{l.won} won</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
