import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/** Number that counts up from its previous value. */
export function CountUp({ value, format, ms = 900 }: { value: number; format: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0)
  const from = useRef(shown)
  useEffect(() => {
    if (reduced()) { setShown(value); return }
    const start = performance.now(); const a = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const v = a + (value - a) * ease(t)
      setShown(v); from.current = v
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{format(shown)}</>
}

/** Mounts at 0 then transitions to target. Used for bars and dials. */
function useGrow(target: number, delay = 0): number {
  const [v, setV] = useState(reduced() ? target : 0)
  useEffect(() => {
    if (reduced()) { setV(target); return }
    const id = window.setTimeout(() => setV(target), 40 + delay)
    return () => window.clearTimeout(id)
  }, [target, delay])
  return v
}

/** Thin frequency bar, 0-100. */
export function FreqBar({ pct, tone, delay = 0 }: { pct: number; tone: string; delay?: number }) {
  const w = useGrow(Math.max(2, Math.min(100, pct)), delay)
  return (
    <span className="fi-freq" title={`On ${pct}% of jobs`}>
      <span className="fi-freq__fill" style={{ width: `${w}%`, background: tone }} />
    </span>
  )
}

/** p25-p75 band, median tick, optional marker for this quote's value. */
export function RangeBar({ min, p25, med, p75, max, mark, fmt }: {
  min: number; p25: number; med: number; p75: number; max: number; mark: number | null; fmt: (n: number) => string
}) {
  const span = Math.max(1, max - min)
  const pos = (n: number) => Math.max(0, Math.min(100, ((n - min) / span) * 100))
  const band = useGrow(1)
  const markPos = useGrow(mark == null ? 0 : pos(mark), 250)
  return (
    <div className="fi-range">
      <div className="fi-range__track">
        <span className="fi-range__band" style={{ left: `${pos(p25)}%`, width: `${(pos(p75) - pos(p25)) * band}%` }} />
        <span className="fi-range__med" style={{ left: `${pos(med)}%`, opacity: band }} />
        {mark != null && <span className="fi-range__mark" style={{ left: `${markPos}%` }} title={`This quote ${fmt(mark)}`} />}
      </div>
      <div className="fi-range__labels">
        <span>{fmt(p25)}</span><span className="fi-range__medlbl">median {fmt(med)}</span><span>{fmt(p75)}</span>
      </div>
    </div>
  )
}

/** Semicircle dial: quote GP% against the lane's normal band. */
export function MarginDial({ value, lo, hi, tone }: { value: number; lo: number; hi: number; tone: string }) {
  const R = 46, C = Math.PI * R
  const clamp = (n: number) => Math.max(0, Math.min(60, n)) / 60
  const fill = useGrow(clamp(value), 120)
  const bandStart = clamp(lo), bandEnd = clamp(hi)
  const angle = (f: number) => Math.PI * (1 - f)
  const pt = (f: number, r = R) => [60 + r * Math.cos(angle(f)), 58 - r * Math.sin(angle(f))]
  const [bx1, by1] = pt(bandStart, R + 7), [bx2, by2] = pt(bandEnd, R + 7)
  const [nx, ny] = pt(fill, R - 14)
  return (
    <svg viewBox="0 0 120 66" className="fi-dial" aria-hidden>
      <path d={`M14 58 A${R} ${R} 0 0 1 106 58`} className="fi-dial__track" />
      <path d={`M14 58 A${R} ${R} 0 0 1 106 58`} className="fi-dial__fill"
        style={{ stroke: tone, strokeDasharray: C, strokeDashoffset: C * (1 - fill) }} />
      <path d={`M${bx1} ${by1} A${R + 7} ${R + 7} 0 0 1 ${bx2} ${by2}`} className="fi-dial__band" />
      <line x1="60" y1="58" x2={nx} y2={ny} className="fi-dial__needle" />
      <circle cx="60" cy="58" r="3.2" className="fi-dial__hub" />
    </svg>
  )
}
