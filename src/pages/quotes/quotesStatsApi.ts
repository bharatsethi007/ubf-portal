import { supabase } from '../../supabase'

export type QuotesMode = 'all' | 'air' | 'fcl' | 'lcl'
export type PortPair = { from: string | null; to: string | null }

export type StatsPeriod = 'week' | 'month' | 'quarter' | 'year'

export type QuotesStats = {
  period_count: number
  open: number
  needs_pricing: number
  won_period: number
  lost_period: number
  win_rate: number | null
}

// Period starts: week = Monday, all in NZ time (server side).
export async function fetchQuotesStats(mode: QuotesMode, lane: PortPair, period: StatsPeriod): Promise<QuotesStats | null> {
  const { data, error } = await supabase.rpc('quotes_stats', {
    p_mode: mode,
    p_from: lane.from,
    p_to: lane.to,
    p_period: period,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as QuotesStats | undefined
  if (!row) return null
  return { ...row, win_rate: row.win_rate == null ? null : Number(row.win_rate) }
}

export type PortCodeRow = { side: 'from' | 'to'; code: string; n: number }

export async function fetchQuotePortCodes(): Promise<PortCodeRow[]> {
  const { data, error } = await supabase.rpc('quotes_port_codes')
  if (error) throw error
  return (data as PortCodeRow[]) ?? []
}
