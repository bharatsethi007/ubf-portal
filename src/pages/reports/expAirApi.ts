import { supabase } from '../../supabase'

export type TrendPoint = { month: string; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
export type Lane = { origin: string; destination: string; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
export type Party = { customer_account_id: string | null; customer_name: string | null; consignee_name: string | null; masters: number; houses: number; gross_kg: number; chargeable_kg: number; revenue: number }
export type Dest = { destination: string; houses: number }
export type CustomerOpt = { customer_account_id: string; customer_name: string | null; houses: number }
export type ConsigneeOpt = { consignee_name: string; houses: number }

type Filters = { destination?: string | null; customer?: string | null; consignee?: string | null }

const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T[]> => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? []) as T[]
}

const base = (from: string, to: string, f: Filters = {}) => ({
  p_from: from, p_to: to,
  p_destination: f.destination ?? null, p_customer: f.customer ?? null, p_consignee: f.consignee ?? null,
})

export const fetchExpAirTrend = (from: string, to: string, f?: Filters) => rpc<TrendPoint>('report_expair_trend', base(from, to, f))
export const fetchExpAirLanes = (from: string, to: string, f?: Filters) => rpc<Lane>('report_expair_lanes', { ...base(from, to, f), p_limit: 300 })
export const fetchExpAirParties = (from: string, to: string, f?: Filters) => rpc<Party>('report_expair_parties', { ...base(from, to, f), p_limit: 300 })
export const fetchExpAirDestinations = (from: string, to: string) => rpc<Dest>('report_expair_destinations', { p_from: from, p_to: to })
export const fetchExpAirCustomers = (from: string, to: string) => rpc<CustomerOpt>('report_expair_customers', { p_from: from, p_to: to })
export const fetchExpAirConsignees = (from: string, to: string) => rpc<ConsigneeOpt>('report_expair_consignees', { p_from: from, p_to: to })
