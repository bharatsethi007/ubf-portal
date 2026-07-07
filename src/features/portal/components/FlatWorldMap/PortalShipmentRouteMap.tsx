import { useEffect, useMemo, useRef } from 'react'
import type { PortMap } from '../../../../hooks/usePorts'
import {
  pointOnArc,
  safeGreatCircleArc,
  toLngLat,
  travelBearing,
  type LngLat,
} from '../../../../utils/routeMapGeo'
import type { PortalShipmentDetail } from '../../shipment/portalShipmentDetailTypes'
import FlatMapLandDots from './FlatMapLandDots'
import { MAP_W, projectLngLat } from './flatMapProjection'
import MapPinSvg from './MapPinSvg'
import { portalRouteProgress, showTransitVehicle } from './portalRouteMapProgress'
import {
  arcToPolylines,
  computeRouteViewBox,
  computeRouteViewport,
  drawRouteArc,
  drawVehicle,
  viewBoxToString,
  type MapPoint,
  type RouteViewBox,
} from './routeMapCanvasDraw'

const ORIGIN_PIN = '#3B5BFE'
const DEST_PIN = '#F5843C'

type Props = {
  shipment: PortalShipmentDetail
  ports: PortMap
}

type RouteData = {
  arc: LngLat[]
  polylines: MapPoint[][]
  origin: MapPoint
  dest: MapPoint
  viewBox: RouteViewBox
  showVehicle: boolean
  mode: string
  progressInput: {
    etd?: string | null
    eta?: string | null
    departed?: string | null
    arrived?: string | null
    status?: string | null
  }
}

function buildRoute(shipment: PortalShipmentDetail, ports: PortMap): RouteData | null {
  const from = ports.get(shipment.origin ?? '')
  const to = ports.get(shipment.destination ?? '')
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null

  const originLngLat = toLngLat(from)
  const destLngLat = toLngLat(to)
  const arc = safeGreatCircleArc(originLngLat, destLngLat)
  if (arc.length < 2) return null

  const origin = projectLngLat(from.lng, from.lat)
  const dest = projectLngLat(to.lng, to.lat)
  const viewBox = computeRouteViewBox(from.lng, from.lat, to.lng, to.lat)

  return {
    arc,
    polylines: arcToPolylines(arc),
    origin,
    dest,
    viewBox,
    showVehicle: showTransitVehicle(shipment.status),
    mode: shipment.mode ?? 'sea',
    progressInput: {
      etd: shipment.etd,
      eta: shipment.eta,
      departed: shipment.departed,
      arrived: shipment.arrived,
      status: shipment.status,
    },
  }
}

export default function PortalShipmentRouteMap({ shipment, ports }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const routeRef = useRef<RouteData | null>(null)
  const route = useMemo(() => buildRoute(shipment, ports), [shipment, ports])
  const viewBoxStr = route ? viewBoxToString(route.viewBox) : ''
  const pinScale = route ? (route.viewBox.w / MAP_W) * 1.22 : 1

  useEffect(() => {
    routeRef.current = route
  }, [route])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !route) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let dashOffset = 0
    let w = 0
    let h = 0

    const resize = () => {
      w = Math.max(1, wrap.clientWidth)
      h = Math.max(1, wrap.clientHeight)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const paint = () => {
      const r = routeRef.current
      if (!r || !w || !h) return

      const vp = computeRouteViewport(r.viewBox, w, h)

      ctx.clearRect(0, 0, w, h)
      drawRouteArc(ctx, r.polylines, vp, r.origin, r.dest, dashOffset, !reduceMotion)

      if (r.showVehicle) {
        const progress = portalRouteProgress(r.progressInput)
        const lngLat = pointOnArc(r.arc, progress)
        const vehiclePt = projectLngLat(lngLat[0], lngLat[1])
        const bearing = travelBearing(r.arc, progress)
        drawVehicle(ctx, vehiclePt, vp, r.mode, bearing)
      }
    }

    const tick = () => {
      const r = routeRef.current
      if (r && !reduceMotion) dashOffset += r.mode === 'air' ? 0.55 : 0.35
      paint()
      if (!reduceMotion) raf = requestAnimationFrame(tick)
    }

    const onResize = () => {
      resize()
      if (reduceMotion) paint()
    }

    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(wrap)
    if (reduceMotion) paint()
    else tick()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [route])

  if (!route) {
    return (
      <div className="portal-shipment-map portal-shipment-map--empty">
        <p className="portal-detail-muted">Route map unavailable — port coordinates missing.</p>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="portal-shipment-map">
      <div className="portal-shipment-map__stack">
        <FlatMapLandDots
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="portal-shipment-map__base"
        />
        <svg
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="portal-shipment-map__pins"
          aria-hidden
        >
          <MapPinSvg x={route.origin.x} y={route.origin.y} color={ORIGIN_PIN} scale={pinScale} />
          <MapPinSvg x={route.dest.x} y={route.dest.y} color={DEST_PIN} scale={pinScale} />
        </svg>
        <canvas
          ref={canvasRef}
          className="portal-shipment-map__overlay"
          role="img"
          aria-label="Shipment route map"
        />
      </div>
    </div>
  )
}
