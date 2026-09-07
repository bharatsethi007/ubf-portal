import { supabase } from '../../supabase'

export type CartageZone = {
  id: string
  zone_code: string
  name: string
  zone_type: 'area' | 'port' | 'depot'
  island: 'NI' | 'SI' | null
  region: string | null
  active: boolean
  sort_order: number
}

export type CartageBand = {
  id: string
  band_code: string
  label: string
  min_kg: number
  max_kg: number | null
  sort_order: number
  active: boolean
}

export type CartageTier = {
  id: string
  surcharge_id: string
  threshold_kg: number
  amount: number
}

export type CartageSurcharge = {
  id: string
  code: string
  label: string
  applies_to: 'fcl' | 'ltl'
  calc: 'flat' | 'per_container' | 'percent_of_freight' | 'tiered_weight'
  default_amount: number | null
  trigger: 'manual' | 'dest_residential' | 'weight_threshold' | 'auto'
  active: boolean
  sort_order: number
  cartage_surcharge_tiers: CartageTier[]
}

export type CartageFaf = {
  id: string
  effective_month: string
  percent: number
  note: string | null
}

export async function listCartageZones(): Promise<CartageZone[]> {
  const { data, error } = await supabase.from('cartage_zones').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listCartageBands(): Promise<CartageBand[]> {
  const { data, error } = await supabase.from('cartage_weight_bands').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listCartageSurcharges(): Promise<CartageSurcharge[]> {
  const { data, error } = await supabase
    .from('cartage_surcharges')
    .select('*, cartage_surcharge_tiers(*)')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listCartageFaf(): Promise<CartageFaf[]> {
  const { data, error } = await supabase
    .from('cartage_faf')
    .select('*')
    .order('effective_month', { ascending: false })
  if (error) throw error
  return data ?? []
}

export type ZoneMember = {
  id: string
  zone_id: string
  match_type: 'postcode' | 'postcode_range' | 'suburb' | 'city'
  value: string
  value_to: string | null
}

export async function createCartageZone(z: Partial<CartageZone>) {
  const { data, error } = await supabase.from('cartage_zones').insert(z).select().single()
  if (error) throw error
  return data as CartageZone
}

export async function updateCartageZone(id: string, patch: Partial<CartageZone>) {
  const { error } = await supabase.from('cartage_zones').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCartageZone(id: string) {
  const { error } = await supabase.from('cartage_zones').delete().eq('id', id)
  if (error) throw error
}

export async function listZoneMembers(zoneId: string): Promise<ZoneMember[]> {
  const { data, error } = await supabase
    .from('cartage_zone_members')
    .select('*')
    .eq('zone_id', zoneId)
    .order('match_type')
  if (error) throw error
  return data ?? []
}

export async function addZoneMember(m: Omit<ZoneMember, 'id'>) {
  const { error } = await supabase.from('cartage_zone_members').insert(m)
  if (error) throw error // unique (match_type, lower(value)) → dup value across zones is rejected
}

export async function deleteZoneMember(id: string) {
  const { error } = await supabase.from('cartage_zone_members').delete().eq('id', id)
  if (error) throw error
}
