import { supabase } from '../../supabase'

export type QuotesMode = 'all' | 'air' | 'fcl' | 'lcl'
export type PortPair = { from: string | null; to: string | null }

export type QuotesStats = {
  this_month: number
  open: number
  needs_pricing: number
  won_month: number
  lost_month: number
  win_rate_90d: number | null
}

export async function fetchQuotesStats(mode: QuotesMode, lane: PortPair): Promise<QuotesStats | null> {
  const { data, error } = await supabase.rpc('quotes_stats', {
    p_mode: mode,
    p_from: lane.from,
    p_to: lane.to,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as QuotesStats | undefined
  if (!row) return null
  return { ...row, win_rate_90d: row.win_rate_90d == null ? null : Number(row.win_rate_90d) }
}

export type PortCodeRow = { side: 'from' | 'to'; code: string; n: number }

export async function fetchQuotePortCodes(): Promise<PortCodeRow[]> {
  const { data, error } = await supabase.rpc('quotes_port_codes')
  if (error) throw error
  return (data as PortCodeRow[]) ?? []
}
