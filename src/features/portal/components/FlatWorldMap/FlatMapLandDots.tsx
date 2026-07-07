import { useMemo } from 'react'
import { MAP_H, MAP_W } from './flatMapProjection'
import { getLandDots } from './landDots'

export const LAND_DOT_COLOR = '#D5D9E2'
export const DEFAULT_MAP_VIEWBOX = `0 0 ${MAP_W} ${MAP_H}`

type Props = {
  viewBox?: string
  preserveAspectRatio?: string
  className?: string
}

/** Shared dotted-world basemap — same data + styling as dashboard Live shipments map. */
export default function FlatMapLandDots({
  viewBox = DEFAULT_MAP_VIEWBOX,
  preserveAspectRatio = 'xMidYMid slice',
  className = 'flat-map-land',
}: Props) {
  const landDots = useMemo(() => getLandDots(), [])

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      aria-hidden
    >
      <rect width={MAP_W} height={MAP_H} fill="#fff" />
      {landDots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={0.55} fill={LAND_DOT_COLOR} />
      ))}
    </svg>
  )
}
