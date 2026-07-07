type Props = { up: boolean; id?: string }

export default function Sparkline({ up, id = 'spark' }: Props) {
  const pts = up ? [6, 5.5, 5.8, 5.2, 5.4, 5.1, 5.3] : [5.2, 5.4, 5.1, 5.3, 5.0, 4.9, 5.1]
  const w = 56
  const h = 22
  const mn = Math.min(...pts)
  const mx = Math.max(...pts)
  const coords = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - 2 - ((p - mn) / (mx - mn || 1)) * (h - 4)
    return [x, y] as const
  })
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `M0,${h} L${coords.map(([x, y]) => `${x},${y}`).join(' L')} L${w},${h} Z`

  return (
    <svg width={w} height={h} aria-hidden className="portal-kpi-spark">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--portal-spark)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--portal-spark)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-g)`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--portal-spark)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
