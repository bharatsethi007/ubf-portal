import { supabase } from '@/supabase'

export type TruckPosition = {
  tn_vehicle_id: number
  registration_number: string
  driver_name: string | null
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  location: string | null
  last_event: string | null
  minutes_since: number | null
  recorded_at: string | null
}

export async function fetchTruckPositions(): Promise<TruckPosition[]> {
  const { data, error } = await supabase.rpc('get_dispatch_fleet_positions')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    tn_vehicle_id: r.tn_vehicle_id,
    registration_number: r.registration ?? r.name ?? String(r.tn_vehicle_id),
    driver_name: r.driver_name ?? null,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    heading: r.heading != null ? Number(r.heading) : null,
    speed: r.speed != null ? Number(r.speed) : null,
    location: r.location ?? null,
    last_event: [r.last_event_type, r.last_event_subtype].filter(Boolean).join(' / ') || null,
    minutes_since: r.minutes_since != null ? Number(r.minutes_since) : null,
    recorded_at: r.position_timestamp ?? null,
  })) as TruckPosition[]
}

export type JobPin = {
  id: string
  consignment_no: string | null
  company: string | null
  address: string | null
  status: string
  driver_id: string | null
  pickup_at: string | null
  units: number
  weight_kg: number
  cbm: number
  lat: number
  lng: number
}
export type JobPins = { pickups: JobPin[]; dropoffs: JobPin[] }

const OPEN_EXCLUDE = '("complete","checked_in","failed","inComplete","cancel","archived")'
const COMPLETED_STATUSES = ['complete', 'checked_in']
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const geocodedThisSession = new Set<string>()

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&country=nz,fj,au`
    const r = await fetch(url)
    const j = await r.json()
    const c = j?.features?.[0]?.center
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null
  } catch {
    return null
  }
}

const SELECT =
  'id,consignment_no,status,preferred_pickup_at,assigned_driver_leg1,sender_company,sender_address,sender_lat,sender_lng,receiver_company,receiver_address,receiver_lat,receiver_lng,cargo:tms_consignment_cargo(units,weight_kg,total_cube_m3)'

async function resolveRow(c: any): Promise<{ pickup: JobPin | null; dropoff: JobPin | null }> {
  let sLat = c.sender_lat, sLng = c.sender_lng
  let rLat = c.receiver_lat, rLng = c.receiver_lng
  const patch: Record<string, number> = {}
  if (!geocodedThisSession.has(c.id) && TOKEN) {
    if ((sLat == null || sLng == null) && c.sender_address) {
      const g = await geocode(c.sender_address)
      if (g) { sLat = g.lat; sLng = g.lng; patch.sender_lat = g.lat; patch.sender_lng = g.lng }
    }
    if ((rLat == null || rLng == null) && c.receiver_address) {
      const g = await geocode(c.receiver_address)
      if (g) { rLat = g.lat; rLng = g.lng; patch.receiver_lat = g.lat; patch.receiver_lng = g.lng }
    }
    if (Object.keys(patch).length) {
      geocodedThisSession.add(c.id)
      supabase.from('tms_consignments').update(patch).eq('id', c.id).then(() => {}, () => {})
    }
  }
  const cargo = Array.isArray(c.cargo) ? c.cargo : []
  const units = cargo.reduce((t: number, l: any) => t + (l.units ?? 0), 0)
  const weight_kg = cargo.reduce((t: number, l: any) => t + (l.weight_kg ?? 0), 0)
  const cbm = +cargo.reduce((t: number, l: any) => t + (l.total_cube_m3 ?? 0), 0).toFixed(3)
  const base = { driver_id: c.assigned_driver_leg1 ?? null, pickup_at: c.preferred_pickup_at ?? null, units, weight_kg, cbm }
  return {
    pickup: sLat != null && sLng != null ? { id: c.id, consignment_no: c.consignment_no, company: c.sender_company, address: c.sender_address, status: c.status, ...base, lat: Number(sLat), lng: Number(sLng) } : null,
    dropoff: rLat != null && rLng != null ? { id: c.id, consignment_no: c.consignment_no, company: c.receiver_company, address: c.receiver_address, status: c.status, ...base, lat: Number(rLat), lng: Number(rLng) } : null,
  }
}

export async function fetchDispatchJobPins(): Promise<JobPins> {
  const { data, error } = await supabase
    .from('tms_consignments').select(SELECT)
    .eq('archived', false).not('status', 'in', OPEN_EXCLUDE)
  if (error) throw error
  const pickups: JobPin[] = []
  const dropoffs: JobPin[] = []
  for (const c of data ?? []) {
    const { pickup, dropoff } = await resolveRow(c)
    if (pickup) pickups.push(pickup)
    if (dropoff) dropoffs.push(dropoff)
  }
  return { pickups, dropoffs }
}

// Completed jobs -> their delivery (receiver) points.
export async function fetchCompletedJobPins(): Promise<JobPin[]> {
  const { data, error } = await supabase
    .from('tms_consignments').select(SELECT)
    .eq('archived', false).in('status', COMPLETED_STATUSES)
  if (error) throw error
  const out: JobPin[] = []
  for (const c of data ?? []) {
    const { dropoff } = await resolveRow(c)
    if (dropoff) out.push(dropoff)
  }
  return out
}
