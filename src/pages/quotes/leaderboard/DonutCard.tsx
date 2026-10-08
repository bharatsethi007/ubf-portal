import { useState } from 'react'
import { arcPath, sliceAngles, winRate, type InsightChart } from './insightsData'

const SIZE = 132, R = 62, RI = 42

/** Donut with legend. Two slices or fewer render as a split bar (a 2-slice pie reads badly). */
export default function DonutCard({ chart }: { chart: InsightChart }) {
  const [hover, setHover] = useState<number | null>(null)
  const { slices, total } = chart
  const active = hover != null ? slices[hover] : null
  const showWin = slices.some((s) => s.won != null && (s.won > 0 || (s.lost ?? 0) > 0))

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-900">{chart.title}</div>
      <div className="mb-3 text-xs text-slate-500">{chart.headline || ' '}</div>
      {!total ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-slate-400">{chart.empty}</div>
      ) : slices.length < 3 ? (
        <div className="mb-3">
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
            {slices.map((s, i) => (
              <div key={s.label} title={`${s.label}: ${s.n} (${s.pct}%)`} style={{ width: `${s.pct}%`, background: s.color }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 flex justify-center">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={chart.title}>
            {sliceAngles(slices).map((a, i) => (
              <path key={slices[i].label} d={arcPath(SIZE / 2, SIZE / 2, hover === i ? R + 3 : R, RI, a.a0, a.a1)}
                fill={slices[i].color} opacity={hover == null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default', transition: 'opacity .15s' }}>
                <title>{`${slices[i].label}: ${slices[i].n} (${slices[i].pct}%)`}</title>
              </path>
            ))}
            <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" fontSize="18" fill="#0f172a">{active ? active.n : total}</text>
            <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" fontSize="10" fill="#64748b">
              {active ? `${active.pct}%` : 'quotes'}
            </text>
          </svg>
        </div>
      )}
      {total > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {slices.map((s, i) => {
            const wr = winRate(s)
            return (
              <li key={s.label} className={`flex items-center gap-2 rounded px-1 ${hover === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-700" title={s.label}>{s.label}</span>
                <span className="tabular-nums text-slate-900">{s.n}</span>
                <span className="w-9 text-right tabular-nums text-slate-500">{s.pct}%</span>
                {showWin && <span className="w-14 text-right tabular-nums text-slate-500" title="Win rate">{wr == null ? '–' : `${wr}% win`}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
