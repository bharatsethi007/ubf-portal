import { supabase } from '../../../supabase'
import type { QuotesMode, StatsPeriod } from '../quotesStatsApi'
export { PERIOD_LABEL, fmtHrs, fmtPct, fmtDay, modeLabel } from './leaderboardFormat'

export type LbStaff = {
  user_id: string | null
  name: string
  quotes: number
  open: number
  won: number
  lost: number
  win_rate: number | null
  per_day: number
  per_week: number
  per_month: number
  avg_hrs_to_quote: number | null
  avg_hrs_email_to_quote: number | null
  email_matched: number
}

export type LbCustomer = {
  account_id: string | null
  name: string
  quotes: number
  open: number
  won: number
  lost: number
  win_rate: number | null
  avg_hrs_to_quote: number | null
  last_quote: string
}

export type LbTotals = {
  quotes: number
  open: number
  won: number
  lost: number
  win_rate: number | null
  avg_hrs_to_quote: number | null
  avg_hrs_email_to_quote: number | null
  customers: number
}

export type MixRow = { label: string; n: number; won?: number; lost?: number }
export type LbMix = {
  status: MixRow[]; mode: MixRow[]; direction: MixRow[]; source: MixRow[]
  destination: MixRow[]; lane: MixRow[]; lost_reason: MixRow[]
}

export type Leaderboard = {
  since: string
  days: number
  work_days: number
  totals: LbTotals
  staff: LbStaff[]
  customers: LbCustomer[]
  /** Present once the insights migration is applied. */
  mix?: LbMix
}

export async function fetchLeaderboard(period: StatsPeriod, mode: QuotesMode): Promise<Leaderboard> {
  const { data, error } = await supabase.rpc('quotes_leaderboard', { p_period: period, p_mode: mode })
  if (error) throw error
  return data as Leaderboard
}
