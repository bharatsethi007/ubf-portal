import { useEffect, useState } from 'react'
import { FileText, FolderOpen, Hourglass, Trophy, XCircle, Percent, Medal, type LucideIcon } from 'lucide-react'
import QuotesLeaderboardDialog from './leaderboard/QuotesLeaderboardDialog'
import { fetchQuotesStats, type QuotesMode, type PortPair, type QuotesStats, type StatsPeriod } from './quotesStatsApi'

type Props = { mode: QuotesMode; lane: PortPair; refreshKey?: number; title?: string }

type Tile = { label: string; value: string; Icon: LucideIcon; tone?: string }

const PERIODS: { key: StatsPeriod; label: string; hint: string }[] = [
  { key: 'week', label: 'Week', hint: 'Since Monday' },
  { key: 'month', label: 'Month', hint: 'Since 1st of month' },
  { key: 'quarter', label: 'Quarter', hint: 'Since start of quarter' },
  { key: 'year', label: 'Year', hint: 'Since 1 Jan' },
]

const PREF_KEY = 'quotes_stats_period'

function loadPeriod(): StatsPeriod {
  try {
    const v = localStorage.getItem(PREF_KEY)
    if (v && PERIODS.some((p) => p.key === v)) return v as StatsPeriod
  } catch { /* storage unavailable */ }
  return 'month'
}

export default function QuotesStatsStrip({ mode, lane, refreshKey = 0, title }: Props) {
  const [stats, setStats] = useState<QuotesStats | null>(null)
  const [period, setPeriod] = useState<StatsPeriod>(loadPeriod)
  const [boardOpen, setBoardOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchQuotesStats(mode, lane, period)
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { if (!cancelled) setStats(null) })
    return () => { cancelled = true }
  }, [mode, lane.from, lane.to, refreshKey, period]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(p: StatsPeriod) {
    setPeriod(p)
    try { localStorage.setItem(PREF_KEY, p) } catch { /* ignore */ }
  }

  const word = period === 'week' ? 'this week' : period === 'month' ? 'this month' : period === 'quarter' ? 'this quarter' : 'this year'
  const n = (v: number | undefined) => (stats ? String(v ?? 0) : '–')
  const tiles: Tile[] = [
    { label: `Quotes ${word}`, value: n(stats?.period_count), Icon: FileText },
    { label: 'Open', value: n(stats?.open), Icon: FolderOpen },
    { label: 'Needs pricing', value: n(stats?.needs_pricing), Icon: Hourglass, tone: stats?.needs_pricing ? '#B45309' : undefined },
    { label: `Won ${word}`, value: n(stats?.won_period), Icon: Trophy, tone: '#047857' },
    { label: `Lost ${word}`, value: n(stats?.lost_period), Icon: XCircle, tone: '#B91C1C' },
    { label: `Win rate ${word}`, value: stats?.win_rate == null ? '–' : `${stats.win_rate}%`, Icon: Percent },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="quotes-page__head flex items-center justify-between gap-2">
        {title ? <h1>{title}</h1> : <span />}
        <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Stats period">
          {PERIODS.map(({ key, label, hint }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              title={hint}
              onClick={() => pick(key)}
              className={`rounded px-2.5 py-0.5 text-xs ${period === key ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" title="Leaderboard" aria-label="Leaderboard" onClick={() => setBoardOpen(true)}>
          <Medal size={17} strokeWidth={2} />
        </button>
        </div>
      </div>
      <QuotesLeaderboardDialog open={boardOpen} onClose={() => setBoardOpen(false)} mode={mode} initialPeriod={period} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ label, value, Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <Icon size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="text-xl leading-6 text-slate-900" style={tone ? { color: tone } : undefined}>{value}</div>
              <div className="truncate text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
