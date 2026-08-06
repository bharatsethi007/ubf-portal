import { supabase } from '../../supabase'

export type TradeLane = {
  origin: string; destination: string; direction: string; mode: string
  jobs: number; teu: number; cbm: number; weight_kg: number
}
export type VolumePoint = { month: string; direction: string; mode: string; jobs: number }

export async function fetchTradeLanes(
  from: string, to: string, direction: string | null, mode: string | null, limit = 50,
): Promise<TradeLane[]> {
  const { data, error } = await supabase.rpc('report_trade_lanes', {
    p_from: from, p_to: to, p_direction: direction, p_mode: mode, p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as TradeLane[]
}

export async function fetchVolumeTrend(from: string, to: string): Promise<VolumePoint[]> {
  const { data, error } = await supabase.rpc('report_volume_trend', { p_from: from, p_to: to })
  if (error) throw error
  return (data ?? []) as VolumePoint[]
}
