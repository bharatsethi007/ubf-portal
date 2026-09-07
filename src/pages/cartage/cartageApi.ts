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
