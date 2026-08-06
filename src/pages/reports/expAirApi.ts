import { supabase } from '../../supabase'

export type TrendPoint = { month: string; jobs: number; chargeable_kg: number; revenue: number }
export type Lane = { origin: string; destination: string; jobs: number; chargeable_kg: number; revenue: number }
export type Party = { customer_account_id: string | null; customer_name: string | null; consignee_name: string | null; jobs: number; chargeable_kg: number; revenue: number }
export type Dest = { destination: string; jobs: number }

const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T[]> => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? []) as T[]
}

export const fetchExpAirTrend = (from: string, to: string, dest: string | null) =>
  rpc<TrendPoint>('report_expair_trend', { p_from: from, p_to: to, p_destination: dest })
export const fetchExpAirLanes = (from: string, to: string, dest: string | null) =>
  rpc<Lane>('report_expair_lanes', { p_from: from, p_to: to, p_destination: dest, p_limit: 50 })
export const fetchExpAirParties = (from: string, to: string, dest: string | null) =>
  rpc<Party>('report_expair_parties', { p_from: from, p_to: to, p_destination: dest, p_limit: 50 })
export const fetchExpAirDestinations = (from: string, to: string) =>
  rpc<Dest>('report_expair_destinations', { p_from: from, p_to: to })
