import { useMemo } from 'react'
import type { PortMap } from '../../../../hooks/usePorts'
import type { GlobeLane } from '../../dashboard/portalDashboardApi'
import { MAP_H, MAP_W, projectLngLat } from './flatMapProjection'
import { getLandDots } from './landDots'
import MapPinSvg from './MapPinSvg'

type Props = {
  lanes: GlobeLane[]
  ports: PortMap
  inTransit: number
}

const BLUE = '#3B5BFE'
const ORANGE = '#F5843C'
const LANE = '#C5CAD6'

export default function FlatWorldMap({ lanes, ports, inTransit }: Props) {
  const landDots = useMemo(() => getLandDots(), [])

  const { lines, importPins, exportPins } = useMemo(() => {
    const importDest = new Set<string>()
    const exportOrigin = new Set<string>()
    const lineList: { x1: number; y1: number; x2: number; y2: number; key: string }[] = []

    for (const lane of lanes) {
      const from = ports.get(lane.fromCode)
      const to = ports.get(lane.toCode)
      if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) continue
      const a = projectLngLat(from.lng, from.lat)
      const b = projectLngLat(to.lng, to.lat)
      lineList.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, key: `${lane.fromCode}-${lane.toCode}` })
      if (lane.dir === 'import') importDest.add(lane.toCode)
      else exportOrigin.add(lane.fromCode)
    }

    const pin = (codes: Set<string>, color: string) =>
      [...codes]
        .map((code) => {
          const p = ports.get(code)
          if (!p?.lat || !p?.lng) return null
          const { x, y } = projectLngLat(p.lng, p.lat)
          return { code, x, y, color }
        })
        .filter(Boolean) as { code: string; x: number; y: number; color: string }[]

    return {
      lines: lineList,
      importPins: pin(importDest, BLUE),
      exportPins: pin(exportOrigin, ORANGE),
    }
  }, [lanes, ports])

  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-map-head">
        <div>
          <div className="portal-card-title">Live shipments</div>
          <div className="portal-card-meta">· {inTransit} in transit</div>
        </div>
        <div className="portal-map-legend">
          <span><i className="portal-map-legend__dot portal-map-legend__dot--blue" />Imports</span>
          <span><i className="portal-map-legend__dot portal-map-legend__dot--orange" />Exports</span>
        </div>
      </div>
      <div className="portal-map-wrap">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="portal-map-svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="World shipment lanes"
        >
          <rect width={MAP_W} height={MAP_H} fill="#fff" />
          {landDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={0.55} fill="#D5D9E2" />
          ))}
          {lines.map((l) => (
            <line
              key={l.key}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={LANE}
              strokeWidth={0.6}
              strokeDasharray="3 4"
            />
          ))}
          {exportPins.map((p) => <MapPinSvg key={`e-${p.code}`} x={p.x} y={p.y} color={p.color} />)}
          {importPins.map((p) => <MapPinSvg key={`i-${p.code}`} x={p.x} y={p.y} color={p.color} />)}
        </svg>
      </div>
    </div>
  )
}
