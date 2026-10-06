import { useEffect, useState } from 'react'
import { FileText, FolderOpen, Hourglass, Trophy, XCircle, Percent, type LucideIcon } from 'lucide-react'
import { fetchQuotesStats, type QuotesMode, type PortPair, type QuotesStats } from './quotesStatsApi'

type Props = { mode: QuotesMode; lane: PortPair; refreshKey?: number }

type Tile = { label: string; value: string; Icon: LucideIcon; tone?: string }

export default function QuotesStatsStrip({ mode, lane, refreshKey = 0 }: Props) {
  const [stats, setStats] = useState<QuotesStats | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchQuotesStats(mode, lane)
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { if (!cancelled) setStats(null) })
    return () => { cancelled = true }
  }, [mode, lane.from, lane.to, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const n = (v: number | undefined) => (stats ? String(v ?? 0) : '–')
  const tiles: Tile[] = [
    { label: 'Quotes this month', value: n(stats?.this_month), Icon: FileText },
    { label: 'Open', value: n(stats?.open), Icon: FolderOpen },
    { label: 'Needs pricing', value: n(stats?.needs_pricing), Icon: Hourglass, tone: stats?.needs_pricing ? '#B45309' : undefined },
    { label: 'Won this month', value: n(stats?.won_month), Icon: Trophy, tone: '#047857' },
    { label: 'Lost this month', value: n(stats?.lost_month), Icon: XCircle, tone: '#B91C1C' },
    { label: 'Win rate (90d)', value: stats?.win_rate_90d == null ? '–' : `${stats.win_rate_90d}%`, Icon: Percent },
  ]

  return (
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
  )
}
