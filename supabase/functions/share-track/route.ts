// Sea lanes (searoute-js, marnet network) + AIS track downsampling.
// @ts-ignore npm CJS module without types
import searoute from "npm:searoute-js@0.1.0"
import type { LngLat } from "./types.ts"

const pt = (c: LngLat) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } })

/** Maritime path between two points; falls back to a straight segment. */
export function seaLeg(a: LngLat, b: LngLat): { coords: LngLat[]; nm: number } {
  try {
    const r = searoute(pt(a), pt(b), "nm")
    const coords = (r?.geometry?.coordinates ?? []) as LngLat[]
    if (coords.length >= 2) return { coords: [a, ...coords, b], nm: Number(r.properties?.length ?? 0) }
  } catch (e) {
    console.error("searoute", String(e))
  }
  return { coords: [a, b], nm: haversineNm(a, b) }
}

export function seaPath(points: LngLat[]): { coords: LngLat[]; nm: number } {
  const out: LngLat[] = []
  let nm = 0
  for (let i = 0; i < points.length - 1; i++) {
    const leg = seaLeg(points[i], points[i + 1])
    nm += leg.nm
    out.push(...(out.length ? leg.coords.slice(1) : leg.coords))
  }
  return { coords: unwrap(round(out)), nm: Math.round(nm) }
}

export function haversineNm(a: LngLat, b: LngLat): number {
  const R = 3440.065, rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function round(c: LngLat[]): LngLat[] {
  return c.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4])
}

/** Keep longitudes continuous across the antimeridian so lines don't wrap the globe. */
export function unwrap(c: LngLat[]): LngLat[] {
  if (!c.length) return c
  const out: LngLat[] = [c[0]]
  for (let i = 1; i < c.length; i++) {
    let x = c[i][0]
    const px = out[i - 1][0]
    while (x - px > 180) x -= 360
    while (x - px < -180) x += 360
    out.push([x, c[i][1]])
  }
  return out
}

/** Downsample an ordered AIS track to at most `max` points, always keeping the last one. */
export function thin(c: LngLat[], max = 600): LngLat[] {
  if (c.length <= max) return c
  const step = c.length / max
  const out: LngLat[] = []
  for (let i = 0; i < max; i++) out.push(c[Math.floor(i * step)])
  out.push(c[c.length - 1])
  return out
}
