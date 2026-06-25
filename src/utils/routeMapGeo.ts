import { greatCircle } from '@turf/turf'

export type RouteMapPoint = { lat: number; lng: number } | null
export type LngLat = [number, number]

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function isValidPoint(p: RouteMapPoint): p is { lat: number; lng: number } {
  if (!p) return false
  return Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

export function coordsReady(
  origin: RouteMapPoint,
  destination: RouteMapPoint,
  originCode: string | null,
  destCode: string | null,
): boolean {
  return Boolean(originCode && destCode && isValidPoint(origin) && isValidPoint(destination))
}

export function toLngLat(p: { lat: number; lng: number }): LngLat {
  return [p.lng, p.lat]
}

function normalizeLng(lng: number): number {
  let x = lng
  while (x > 180) x -= 360
  while (x < -180) x += 360
  return x
}

export function routeProgress(shipment: {
  departed: string | null
  arrived: string | null
  status: string
}): number {
  if (shipment.arrived) return 1
  if (shipment.departed) return 0.5

  const s = shipment.status.toLowerCase()
  if (s.includes('arrived') || s.includes('delivered')) return 1
  if (s.includes('transit')) return 0.5
  return 0
}

/** Linear origin→dest position at fraction t, with antimeridian-safe longitude. */
export function interpolateLngLat(origin: LngLat, dest: LngLat, t: number): LngLat {
  const frac = clamp01(t)
  let [originLng, originLat] = origin
  let [destLng, destLat] = dest

  if (Math.abs(destLng - originLng) > 180) {
    if (originLng < destLng) originLng += 360
    else destLng += 360
  }

  const lng = normalizeLng(originLng + (destLng - originLng) * frac)
  const lat = originLat + (destLat - originLat) * frac
  return [lng, lat]
}

export function greatCircleArc(origin: LngLat, dest: LngLat, steps = 96): LngLat[] {
  const line = greatCircle(origin, dest, { npoints: steps + 1 })
  const coords = line.geometry?.coordinates
  if (!coords || coords.length < 2) return [origin, dest]
  return coords as LngLat[]
}

export function safeGreatCircleArc(origin: LngLat, dest: LngLat): LngLat[] {
  try {
    const arc = greatCircleArc(origin, dest)
    if (arc.length < 2) return []
    return arc.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)) ? arc : []
  } catch (err) {
    console.error('[RouteMap] greatCircle failed:', err)
    return []
  }
}

export function pointOnArc(arc: LngLat[], t: number): LngLat {
  if (arc.length === 0) return [0, 0]
  if (arc.length === 1) return arc[0]
  const idx = t * (arc.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(arc.length - 1, lo + 1)
  const f = idx - lo
  const a = arc[lo]
  const b = arc[hi]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** Bearing in degrees clockwise from north. */
export function bearingDegrees(from: LngLat, to: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const [lng1, lat1] = from
  const [lng2, lat2] = to
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI
}

export function travelBearing(arc: LngLat[], t: number): number {
  const t0 = Math.max(0, t - 0.02)
  const t1 = Math.min(1, t + 0.02)
  return bearingDegrees(pointOnArc(arc, t0), pointOnArc(arc, t1))
}
