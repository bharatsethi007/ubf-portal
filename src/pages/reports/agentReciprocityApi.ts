import { supabase } from '@/supabase'

export type AgentReciprocityBand =
  | 'third_party'
  | 'own_office'
  | 'self'
  | 'carrier'
  | 'customer'
  | 'not_agent'
  | 'uncurated'

export type AgentReciprocityRow = {
  code: string
  band: AgentReciprocityBand
  name: string
  country: string | null
  networks: string | null
  trusted: boolean
  total_jobs: number
  imp_jobs: number
  exp_jobs: number
  imp_sea: number
  imp_air: number
  exp_sea: number
  exp_air: number
  balance: number
  imp_revenue: number
  exp_revenue: number
  imp_gp: number
  exp_gp: number
}

export const RECIPROCITY_BANDS = ['third_party', 'own_office', 'self'] as const
export type ReciprocityTabBand = (typeof RECIPROCITY_BANDS)[number]

const num = (v: unknown) => Number(v ?? 0)

export async function fetchAgentReciprocity(): Promise<AgentReciprocityRow[]> {
  const { data, error } = await supabase.rpc('report_agent_reciprocity')
  if (error) throw error
  return ((data ?? []) as AgentReciprocityRow[]).map((row) => ({
    ...row,
    total_jobs: num(row.total_jobs),
    imp_jobs: num(row.imp_jobs),
    exp_jobs: num(row.exp_jobs),
    imp_sea: num(row.imp_sea),
    imp_air: num(row.imp_air),
    exp_sea: num(row.exp_sea),
    exp_air: num(row.exp_air),
    balance: num(row.balance),
    imp_revenue: num(row.imp_revenue),
    exp_revenue: num(row.exp_revenue),
    imp_gp: num(row.imp_gp),
    exp_gp: num(row.exp_gp),
    trusted: Boolean(row.trusted),
  }))
}
