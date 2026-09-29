import { useMemo, type CSSProperties } from 'react'
import { LAND, LAND_TEXTURED, MAP_H, MAP_W } from './geo'
import type { Lane } from './homeModel'

type Props = { lanes: Lane[] }

/** Animated dark Pacific map: lanes draw in, freight flows along them, in-transit lanes carry a glowing dot. */
export default function PacificMap({ lanes }: Props) {
  const nodes = useMemo(() => {
    const m = new Map<string, { x: number; y: number; name: string; count: number; origin: boolean }>()
    for (const l of lanes) {
      const f = m.get(l.from.name)
      if (!f) m.set(l.from.name, { x: l.from.x, y: l.from.y, name: l.from.name, count: 0, origin: true })
      const t = m.get(l.to.name)
      if (t) t.count += l.count
      else m.set(l.to.name, { x: l.to.x, y: l.to.y, name: l.to.name, count: l.count, origin: false })
    }
    return [...m.values()]
  }, [lanes])

  return (
    <div className="pv2-map" aria-hidden="true">
      <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="pv2-map__svg">
        <defs>
          <pattern id="pv2-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="1.5" fill="#3E5BA8" />
          </pattern>
          <pattern id="pv2-grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M46 0H0V46" fill="none" stroke="#15254F" strokeWidth="1" />
          </pattern>
          <radialGradient id="pv2-fade" cx="50%" cy="45%" r="62%">
            <stop offset="70%" stopColor="#0B1733" stopOpacity="0" />
            <stop offset="100%" stopColor="#0B1733" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#pv2-grid)" />
        <g fill="#14285A">{LAND.map((d) => <path key={d} d={d} />)}</g>
        <g fill="url(#pv2-dots)">{LAND_TEXTURED.map((d) => <path key={d} d={d} />)}</g>
        {lanes.map((l, i) => (
          <path key={`b${l.key}`} className="pv2-arc" d={l.path} stroke="#2A4A9E" strokeWidth={2}
            style={{ animationDelay: `${0.2 + i * 0.12}s` }} />
        ))}
        {lanes.map((l) => (
          <path key={`f${l.key}`} className="pv2-arcflow" d={l.path} stroke="#6F93FF" strokeWidth={2} />
        ))}
        <rect width={MAP_W} height={MAP_H} fill="url(#pv2-fade)" />
      </svg>

      {lanes.filter((l) => l.moving).map((l, i) => (
        <span key={`m${l.key}`} className="pv2-mover"
          style={{ offsetPath: `path('${l.path}')`, animationDuration: `${7 + (i % 3) * 2}s`, animationDelay: `${-i * 1.7}s` } as CSSProperties} />
      ))}

      {nodes.map((n, i) => (
        <span key={n.name}>
          <span className="pv2-ping" style={{ left: n.x, top: n.y, animationDelay: `${(i % 4) * 0.6}s` }} />
          <span className="pv2-node" style={{ left: n.x, top: n.y }} />
          <span className={`pv2-map__label${n.x > MAP_W - 150 ? ' pv2-map__label--left' : ''}`}
            style={{ left: n.x, top: n.y }}>
            <span className="pv2-map__name">{n.name}</span>
            {!n.origin && <span className="pv2-map__count">{n.count} {n.count === 1 ? 'shipment' : 'shipments'}</span>}
          </span>
        </span>
      ))}
    </div>
  )
}
