import { supabase } from '../../../supabase'
import type { QuotesMode, StatsPeriod } from '../quotesStatsApi'
export { PERIOD_LABEL, fmtHrs, fmtPct, fmtDay, modeLabel } from './leaderboardFormat'

export type LbStaff = {
  user_id: string | null
  name: string
  quotes: number
  open: number
  /** Paused by the customer. Not in win rate. */
  held?: number
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
  /** Paused by the customer. Not in win rate. */
  held?: number
  won: number
  lost: number
  win_rate: number | null
  avg_hrs_to_quote: number | null
  last_quote: string
}

export type LbTotals = {
  quotes: number
  open: number
  /** Paused by the customer. Not in win rate. */
  held?: number
  won: number
  lost: number
  win_rate: number | null
  avg_hrs_to_quote: number | null
  avg_hrs_email_to_quote: number | null
  customers: number
}

export type LbAgent = {
  agent_id: string | null
  name: string
  country: string | null
  quotes: number
  open: number
  /** Paused by the customer. Not in win rate. */
  held?: number
  won: number
  lost: number
  win_rate: number | null
  avg_hrs_to_quote: number | null
  top_lane: string | null
  last_quote: string
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
  /** Quotes requested by overseas agents (quotes_leaderboard_agents). */
  agents?: LbAgent[]
}

export async function fetchLeaderboard(period: StatsPeriod, mode: QuotesMode): Promise<Leaderboard> {
  const args = { p_period: period, p_mode: mode }
  const [main, ag] = await Promise.all([
    supabase.rpc('quotes_leaderboard', args),
    supabase.rpc('quotes_leaderboard_agents', args),
  ])
  if (main.error) throw main.error
  const lb = main.data as Leaderboard
  // Agents report is optional: missing RPC must not break the leaderboard.
  return ag.error ? lb : { ...lb, agents: (ag.data ?? []) as LbAgent[] }
}
