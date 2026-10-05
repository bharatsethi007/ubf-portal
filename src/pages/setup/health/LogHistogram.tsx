import { useEffect, useRef, useState } from 'react'
import { BS } from './bsTheme'
import type { Histogram } from './logsApi'

const H = 96, PL = 34, PB = 18, PT = 6

function tick(iso: string, stepS: number) {
  const d = new Date(iso)
  const o: Intl.DateTimeFormatOptions = stepS >= 3600
    ? { day: 'numeric', month: 'short', hour: '2-digit', hour12: false, timeZone: 'Pacific/Auckland' }
    : { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Pacific/Auckland' }
  return d.toLocaleString('en-NZ', o)
}

const nice = (v: number) => {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

/* Stacked volume bars (info / warn / error). Click a bar to zoom into it. */
export default function LogHistogram({ hist, onZoom }: { hist: Histogram | null; onZoom: (from: Date, to: Date) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(900)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const b = hist?.buckets ?? []
  if (!b.length) return <div className="bs-hist" ref={ref}><svg viewBox={`0 0 ${W} ${H}`} /></div>
  const max = nice(Math.max(1, ...b.map((x) => x.info + x.warn + x.error)))
  const bw = (W - PL) / b.length
  const y = (v: number) => (v / max) * (H - PB - PT)
  const hv = hover != null ? b[hover] : null
  const every = Math.ceil(b.length / Math.max(3, Math.floor(W / 140)))

  return (
    <div className="bs-hist" ref={ref} onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 12 }}>
        <span className="bs-num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{hist!.total.toLocaleString()}</span>
        <span style={{ color: 'var(--muted)' }}>events</span>
        <span className="bs-gap" />
        {hv ? (
          <span className="bs-mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            {tick(hv.t, hist!.step_seconds)} · {hv.info} info · {hv.warn} warn · <span style={{ color: hv.error ? BS.red : undefined }}>{hv.error} error</span>
          </span>
        ) : (
          <div className="bs-legend">
            <span><i style={{ background: BS.info }} />Info</span>
            <span><i style={{ background: BS.warn }} />Warn</span>
            <span><i style={{ background: BS.error }} />Error</span>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Event volume over time">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="gl" x1={PL} x2={W} y1={H - PB - f * (H - PB - PT)} y2={H - PB - f * (H - PB - PT)} />
            <text className="ax" x={PL - 6} y={H - PB - f * (H - PB - PT) + 3} textAnchor="end">{Math.round(max * f)}</text>
          </g>
        ))}
        {b.map((x, i) => {
          const x0 = PL + i * bw + 1, w = Math.max(1, bw - 2)
          const hi = y(x.info), hw = y(x.warn), he = y(x.error)
          const base = H - PB
          return (
            <g key={x.t} className="col" style={{ cursor: 'zoom-in' }} onMouseEnter={() => setHover(i)}
              onClick={() => { const s = new Date(x.t); onZoom(s, new Date(s.getTime() + hist!.step_seconds * 1000)) }}>
              <rect x={x0} y={PT} width={w} height={H - PB - PT} fill="transparent" />
              {hi > 0 && <rect x={x0} y={base - hi} width={w} height={hi} rx={1} fill={BS.info} />}
              {hw > 0 && <rect x={x0} y={base - hi - hw} width={w} height={hw} rx={1} fill={BS.warn} />}
              {he > 0 && <rect x={x0} y={base - hi - hw - he} width={w} height={he} rx={1} fill={BS.error} />}
              {hover === i && <rect x={x0} y={PT} width={w} height={H - PB - PT} fill="rgba(109,93,245,.06)" />}
            </g>
          )
        })}
        {b.map((x, i) => i % every === 0 && (
          <text key={'l' + i} className="ax" x={PL + i * bw + bw / 2} y={H - 4} textAnchor="middle">{tick(x.t, hist!.step_seconds)}</text>
        ))}
      </svg>
    </div>
  )
}
