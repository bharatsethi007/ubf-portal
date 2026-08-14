import { supabase } from '../../supabase'

export type VesselPosition = {
  booking_id: string
  booking_ref: string | null
  customer_name: string | null
  vessel: string | null
  latitude: number
  longitude: number
  heading: number | null
  speed_over_ground: number | null
  position_timestamp: string | null
}

/** Live AIS/SeaVantage positions for active Import Sea jobs. Staff-only via RLS. */
export async function fetchImportSeaVesselPositions(): Promise<VesselPosition[]> {
  const { data, error } = await supabase.rpc('get_import_sea_vessel_positions')
  if (error) throw error
  return (data ?? []) as VesselPosition[]
}
