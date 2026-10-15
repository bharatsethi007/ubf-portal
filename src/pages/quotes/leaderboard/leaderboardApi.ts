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
  /** Customer vs Agent. */
  party?: MixRow[]
  /** Held quotes by time since last change. */
  held_age?: MixRow[]
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
  /** Running trend + pricing source (quotes_leaderboard_extra). Optional. */
  extra?: LbExtra
}

/** One week of the running trend. Settled = 21+ days old, customers have had time to answer. */
export type TrendWeek = { week: string; quotes: number; won: number; settled: boolean }

/** Quote lines by where the price came from. Legacy = saved before tracking started. */
export type PricingMix = {
  card: number; other: number; manual: number; legacy: number
  card_lines: number; card_edited: number
}

export type LbExtraRow = { trend: TrendWeek[]; pricing: PricingMix | null }
export type LbExtra = {
  week_start: string
  staff: Record<string, LbExtraRow>
  totals: { trend: TrendWeek[] | null; pricing: PricingMix | null }
}

/** Won out of every quote: the honest number while open quotes are still waiting. */
export function conversion(won: number, quotes: number): number | null {
  return quotes > 0 ? Math.round((won / quotes) * 1000) / 10 : null
}

export function extraFor(lb: Leaderboard, userId: string | null): LbExtraRow | undefined {
  return lb.extra?.staff[userId ?? 'none']
}

/** Card / other / manual split as % of tracked lines. Legacy (untracked) lines are left out. */
export function pricingSplit(p: PricingMix | null | undefined) {
  if (!p) return null
  const card = Number(p.card) || 0, other = Number(p.other) || 0, manual = Number(p.manual) || 0
  const tracked = card + other + manual
  if (tracked <= 0) return null
  const pc = (v: number) => Math.round((v / tracked) * 100)
  return { card: pc(card), other: pc(other), manual: pc(manual), tracked, legacy: Number(p.legacy) || 0, cardLines: p.card_lines, cardEdited: p.card_edited }
}

export async function fetchLeaderboard(period: StatsPeriod, mode: QuotesMode): Promise<Leaderboard> {
  const args = { p_period: period, p_mode: mode }
  const [main, ag, ex] = await Promise.all([
    supabase.rpc('quotes_leaderboard', args),
    supabase.rpc('quotes_leaderboard_agents', args),
    supabase.rpc('quotes_leaderboard_extra', args),
  ])
  if (main.error) throw main.error
  const lb = main.data as Leaderboard
  // Agents and extras are optional: a missing RPC must not break the leaderboard.
  return {
    ...lb,
    ...(ag.error ? {} : { agents: (ag.data ?? []) as LbAgent[] }),
    ...(ex.error || !ex.data ? {} : { extra: ex.data as LbExtra }),
  }
}
