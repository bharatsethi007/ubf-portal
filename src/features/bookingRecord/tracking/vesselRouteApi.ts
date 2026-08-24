import { supabase } from '@/supabase'

export type VesselRouteCheckpoint = {
  code: string
  name: string
  lat: number
  lng: number
  role: 'POL' | 'POD' | 'CALL'
}
export type VesselRouteCurrent = {
  latitude: number
  longitude: number
  heading: number | null
  speed_over_ground: number | null
  position_timestamp: string | null
  ship_name: string | null
}
export type BookingVesselRoute = {
  vessel: string | null
  vessel_key: string | null
  current: VesselRouteCurrent | null
  route: [number, number][]
  checkpoints: VesselRouteCheckpoint[]
}

export async function fetchBookingVesselRoute(bookingId: string): Promise<BookingVesselRoute> {
  const { data, error } = await supabase.rpc('get_booking_vessel_route', { p_booking_id: bookingId })
  if (error) throw error
  const d = (data ?? {}) as Partial<BookingVesselRoute>
  return {
    vessel: d.vessel ?? null,
    vessel_key: d.vessel_key ?? null,
    current: d.current ?? null,
    route: d.route ?? [],
    checkpoints: d.checkpoints ?? [],
  }
}
