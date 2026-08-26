import { supabase } from '@/supabase'

export type TruckPosition = {
  vehicle_id: string
  registration_number: string
  description: string | null
  lat: number
  lng: number
  heading: number | null
  recorded_at: string
}

export async function fetchTruckPositions(): Promise<TruckPosition[]> {
  const { data, error } = await supabase
    .from('tms_vehicle_positions_latest')
    .select('vehicle_id,registration_number,description,lat,lng,heading,recorded_at')
  if (error) throw error
  return (data ?? []) as TruckPosition[]
}
