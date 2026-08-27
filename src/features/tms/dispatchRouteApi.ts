import { supabase } from '@/supabase'

export type RouteStop = {
  key: string
  consignmentId: string
  consignmentNo: string | null
  company: string | null
  type: 'pickup' | 'delivery'
  lat: number
  lng: number
  seq: number
  done: boolean
  etaMs: number | null
  legSec: number
  legM: number
}

export type RouteLeg = {
  polyline: string | null
  done: boolean
  durationSec: number
  distanceM: number
}

export type DriverRoute = {
  ok: boolean
  driverId: string
  optimized: boolean
  fixedOrder?: boolean
  doneCount: number
  depot: { lat: number; lng: number }
  stops: RouteStop[]
  legs: RouteLeg[]
  backToDepot: { etaMs: number; sec: number; m: number }
  polyline: string | null
  totalSec: number
  totalM: number
  note?: string
}

// On-demand only. Pass `order` (array of pending stop keys) to recompute along a fixed sequence.
export async function computeDriverRoute(driverId: string, order?: string[]): Promise<DriverRoute> {
  const { data, error } = await supabase.functions.invoke('dispatch-route', {
    body: order && order.length ? { driverId, order } : { driverId },
  })
  if (error) throw error
  if (data && data.ok === false) throw new Error(data.error || 'route computation failed')
  return data as DriverRoute
}

// Decode a Google encoded polyline (precision 5) into [lng, lat] pairs for GeoJSON.
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    out.push([lng / 1e5, lat / 1e5])
  }
  return out
}
