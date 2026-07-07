import type { LngLat } from '../../../../utils/routeMapGeo'
import { MAP_H, MAP_W, projectLngLat } from './flatMapProjection'

export const ORIGIN_COLOR = '#3B5BFE'
export const DEST_COLOR = '#F5843C'

export type MapPoint = { x: number; y: number }

export type RouteViewBox = { x: number; y: number; w: number; h: number }

export type RouteViewport = {
  scale: number
  offsetX: number
  offsetY: number
  viewBox: RouteViewBox
}

export function arcToPolylines(arc: LngLat[]): MapPoint[][] {
  const polylines: MapPoint[][] = []
  let current: MapPoint[] = []
  let prevX: number | null = null

  for (const [lng, lat] of arc) {
    const { x, y } = projectLngLat(lng, lat)
    if (prevX !== null && Math.abs(x - prevX) > MAP_W / 2) {
      if (current.length) polylines.push(current)
      current = []
    }
    current.push({ x, y })
    prevX = x
  }
  if (current.length) polylines.push(current)
  return polylines
}

/** Regional frame centred on the route with generous Pacific/Tasman context. */
export function computeRouteViewBox(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
): RouteViewBox {
  const o = projectLngLat(originLng, originLat)
  const d = projectLngLat(destLng, destLat)

  const padX = 62
  const padY = 48
  const minSpanX = 98
  const minSpanY = 76

  const midX = (o.x + d.x) / 2
  const midY = (o.y + d.y) / 2
  const spanX = Math.max(Math.abs(d.x - o.x) + padX * 2, minSpanX)
  const spanY = Math.max(Math.abs(d.y - o.y) + padY * 2, minSpanY)

  // Centre the route; allow viewBox to extend past the map width so Pacific routes
  // aren't crushed against the right edge (empty margin reads as breathing room).
  let x = midX - spanX / 2
  let y = midY - spanY / 2
  const w = spanX
  const h = spanY

  if (y < 0) y = 0
  if (y + h > MAP_H) y = Math.max(0, MAP_H - h)

  return { x, y, w, h }
}

export function viewBoxToString(vb: RouteViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

export function computeRouteViewport(
  viewBox: RouteViewBox,
  canvasW: number,
  canvasH: number,
): RouteViewport {
  const scale = Math.min(canvasW / viewBox.w, canvasH / viewBox.h)
  const offsetX = (canvasW - viewBox.w * scale) / 2 - viewBox.x * scale
  const offsetY = (canvasH - viewBox.h * scale) / 2 - viewBox.y * scale
  return { scale, offsetX, offsetY, viewBox }
}

export function mapToScreen(p: MapPoint, vp: RouteViewport): MapPoint {
  return { x: p.x * vp.scale + vp.offsetX, y: p.y * vp.scale + vp.offsetY }
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: MapPoint[], vp: RouteViewport) {
  if (pts.length < 2) return
  ctx.beginPath()
  const first = mapToScreen(pts[0], vp)
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < pts.length; i++) {
    const p = mapToScreen(pts[i], vp)
    ctx.lineTo(p.x, p.y)
  }
}

export function drawRouteArc(
  ctx: CanvasRenderingContext2D,
  polylines: MapPoint[][],
  vp: RouteViewport,
  origin: MapPoint,
  dest: MapPoint,
  dashOffset: number,
  animate: boolean,
) {
  const o = mapToScreen(origin, vp)
  const d = mapToScreen(dest, vp)
  const grad = ctx.createLinearGradient(o.x, o.y, d.x, d.y)
  grad.addColorStop(0, ORIGIN_COLOR)
  grad.addColorStop(1, DEST_COLOR)
  const lineW = 0.65 * vp.scale
  const dashA = 3 * vp.scale
  const dashB = 4 * vp.scale
  const glowW = lineW * 2.2

  for (const line of polylines) {
    strokePolyline(ctx, line, vp)
    ctx.setLineDash([])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = ORIGIN_COLOR + '18'
    ctx.lineWidth = glowW
    ctx.stroke()

    strokePolyline(ctx, line, vp)
    ctx.setLineDash([dashA, dashB])
    ctx.lineDashOffset = animate ? -dashOffset * vp.scale * 0.15 : 0
    ctx.strokeStyle = grad
    ctx.lineWidth = lineW
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function canvasBearing(bearingDeg: number): number {
  return ((bearingDeg - 90) * Math.PI) / 180
}

export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  mapPt: MapPoint,
  vp: RouteViewport,
  mode: string,
  bearingDeg: number,
) {
  const { x, y } = mapToScreen(mapPt, vp)
  const size = 6
  const rot = canvasBearing(bearingDeg)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)

  ctx.beginPath()
  ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = ORIGIN_COLOR + '55'
  ctx.stroke()

  ctx.fillStyle = '#0E1B2D'
  ctx.strokeStyle = '#0E1B2D'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (mode === 'air') {
    ctx.beginPath()
    ctx.moveTo(-size * 0.55, 0)
    ctx.lineTo(size * 0.55, 0)
    ctx.moveTo(0, -size * 0.45)
    ctx.lineTo(size * 0.15, 0)
    ctx.lineTo(0, size * 0.45)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-size * 0.5, size * 0.15)
    ctx.quadraticCurveTo(0, -size * 0.55, size * 0.5, size * 0.15)
    ctx.lineTo(size * 0.35, size * 0.35)
    ctx.lineTo(-size * 0.35, size * 0.35)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}
