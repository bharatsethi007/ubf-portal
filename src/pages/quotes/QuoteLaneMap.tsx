import { ArrowRight, Globe } from 'lucide-react'
import { useMemo } from 'react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { safeGreatCircleArc, toLngLat } from '../../utils/routeMapGeo'
import { projectLngLat } from '../../features/portal/components/FlatWorldMap/flatMapProjection'
import { getLandDots } from '../../features/portal/components/FlatWorldMap/landDots'
import {
  arcToPolylines,
  computeRouteViewBox,
  viewBoxToString,
} from '../../features/portal/components/FlatWorldMap/routeMapCanvasDraw'
import './quoteLaneMap.css'

type Resolved = { code: string; name: string; cc: string | null; lat: number | null; lng: number | null }

function Flag({ cc }: { cc: string | null }) {
  if (cc && /^[a-z]{2}$/.test(cc)) return <span className={`fi fi-${cc} qlane__flag`} aria-hidden />
  return <Globe size={18} className="qlane__globe" aria-hidden />
}

function PortLabel({ side, p }: { side: 'o' | 'd'; p: Resolved | null }) {
  return (
    <span className="qlane__port">
      <span className={`qlane__dot qlane__dot--${side}`} />
      <Flag cc={p?.cc ?? null} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="qlane__code mono">{p?.code ?? '—'}</span>
        <span className="qlane__name">
          {p?.name ?? '—'}{p ? ` · ${side === 'o' ? 'loading port' : 'final port'}` : ''}
        </span>
      </span>
    </span>
  )
}

export default function QuoteLaneMap({
  fromCode,
  toCode,
}: {
  fromCode: string | null
  toCode: string | null
}) {
  const { ports } = useSeaPorts()

  const from = useMemo<Resolved | null>(() => {
    if (!fromCode) return null
    const p = ports.find((x) => x.code === fromCode)
    return p ? { code: p.code, name: p.name, cc: p.country_code, lat: p.lat, lng: p.lng } : { code: fromCode, name: fromCode, cc: null, lat: null, lng: null }
  }, [fromCode, ports])

  const to = useMemo<Resolved | null>(() => {
    if (!toCode) return null
    const p = ports.find((x) => x.code === toCode)
    return p ? { code: p.code, name: p.name, cc: p.country_code, lat: p.lat, lng: p.lng } : { code: toCode, name: toCode, cc: null, lat: null, lng: null }
  }, [toCode, ports])

  const route = useMemo(() => {
    if (from?.lat == null || from?.lng == null || to?.lat == null || to?.lng == null) return null
    const arc = safeGreatCircleArc(toLngLat({ lat: from.lat, lng: from.lng }), toLngLat({ lat: to.lat, lng: to.lng }))
    if (arc.length < 2) return null
    const vb = computeRouteViewBox(from.lng, from.lat, to.lng, to.lat)
    const polylines = arcToPolylines(arc)
    const o = projectLngLat(from.lng, from.lat)
    const d = projectLngLat(to.lng, to.lat)
    const dots = getLandDots().filter(
      (p) => p.x >= vb.x - 1 && p.x <= vb.x + vb.w + 1 && p.y >= vb.y - 1 && p.y <= vb.y + vb.h + 1,
    )
    return { vbStr: viewBoxToString(vb), polylines, o, d, dots }
  }, [from, to])

  return (
    <div className="qlane">
      {route ? (
        <svg className="qlane__map" viewBox={route.vbStr} preserveAspectRatio="xMidYMid slice">
          {route.dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.55} fill="#D5D9E2" />
          ))}
          {route.polylines.map((pl, i) => (
            <polyline
              key={i}
              points={pl.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#3B5BFE"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <circle cx={route.o.x} cy={route.o.y} r={2.2} fill="#3B5BFE" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={route.d.x} cy={route.d.y} r={2.2} fill="#F5843C" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="qlane__fallback">Route map unavailable — port coordinates missing</div>
      )}

      <div className="qlane__strip">
        <PortLabel side="o" p={from} />
        <ArrowRight size={18} className="qlane__arrow" aria-hidden />
        <PortLabel side="d" p={to} />
        <span className="qlane__badges">
          <span className="qlane__badge">Sea</span>
          <span className="qlane__badge">FCL</span>
        </span>
      </div>
    </div>
  )
}
