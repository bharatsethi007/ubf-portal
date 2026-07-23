import { supabase } from '../../supabase'

export type AirFlightRoute = {
  flight_no: string
  airline_code: string
  shipment_count: number
}

export async function fetchAirFlightRoutes(
  origin: string,
  destination: string,
): Promise<AirFlightRoute[]> {
  const { data, error } = await supabase
    .from('air_flight_routes')
    .select('flight_no, airline_code, shipment_count')
    .eq('origin', origin.toUpperCase())
    .eq('destination', destination.toUpperCase())
    .order('shipment_count', { ascending: false })
    .limit(15)

  if (error) throw error
  return (data ?? []) as AirFlightRoute[]
}
