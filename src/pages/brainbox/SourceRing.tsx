type Part = { share: number; color: string }

/** Donut of price sources. Small gaps between segments; grey track underneath. */
export default function SourceRing({ size, stroke, parts, label }: { size: number; stroke: number; parts: Part[]; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = parts.length > 1 ? Math.min(2, c * 0.01) : 0
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6E9F0" strokeWidth={stroke} />
      {parts.map((p, i) => {
        const len = Math.max(0, p.share * c - gap)
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )
        acc += p.share * c
        return el
      })}
    </svg>
  )
}
