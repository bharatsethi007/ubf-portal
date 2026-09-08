import { supabase } from '../../supabase'

export type CartageCtx = {
  from_port: string | null; to_port: string | null
  origin_type: string | null; dest_type: string | null
  pickup_postal: string | null; pickup_location: string | null; pickup_address: string | null
  drop_postal: string | null; drop_location: string | null; drop_address: string | null
  shipment_mode: string | null; shipment_type: string | null; movement_type: string | null
}

export async function fetchQuoteCartageContext(quoteId: string): Promise<CartageCtx> {
  const { data, error } = await supabase.from('quotes')
    .select('from_port_code, to_port_code, origin_location_type, dest_location_type, pickup_postal_code, pickup_location, pickup_address, drop_postal_code, drop_location, drop_address, shipment_mode, shipment_type, movement_type')
    .eq('id', quoteId).single()
  if (error) throw error
  const r = data as Record<string, any>
  return {
    from_port: r.from_port_code ?? null, to_port: r.to_port_code ?? null,
    origin_type: r.origin_location_type ?? null, dest_type: r.dest_location_type ?? null,
    pickup_postal: r.pickup_postal_code ?? null, pickup_location: r.pickup_location ?? null, pickup_address: r.pickup_address ?? null,
    drop_postal: r.drop_postal_code ?? null, drop_location: r.drop_location ?? null, drop_address: r.drop_address ?? null,
    shipment_mode: r.shipment_mode ?? null, shipment_type: r.shipment_type ?? null, movement_type: r.movement_type ?? null,
  }
}

export type CartageQuoteResult = {
  status: string; vendor?: string; base?: number; total?: number
  door_confidence?: string; band?: string; per_kg?: number; per_cbm?: number; chargeable_kg?: number
  origin_zone_id?: string; dest_zone_id?: string
  surcharges?: { code: string; label: string; amount: number }[]
  warnings?: string[]
}

export async function runCartageRate(p: {
  door_postcode: string | null; door_city: string | null; door_raw: string | null
  port_code: string | null; direction: 'import' | 'export'; mode: string
  weight_kg: number; cbm: number; volume_cm3: number; residential: boolean; tail_lift: boolean
}): Promise<CartageQuoteResult> {
  const { data, error } = await supabase.rpc('cartage_rate_quote', {
    p_door_postcode: p.door_postcode, p_door_city: p.door_city, p_door_raw: p.door_raw,
    p_port_code: p.port_code, p_direction: p.direction, p_mode: p.mode,
    p_weight_kg: p.weight_kg, p_cbm: p.cbm, p_volume_cm3: p.volume_cm3,
    p_residential: p.residential, p_tail_lift: p.tail_lift, p_as_of: null,
  })
  if (error) throw error
  return (data ?? { status: 'error' }) as CartageQuoteResult
}
