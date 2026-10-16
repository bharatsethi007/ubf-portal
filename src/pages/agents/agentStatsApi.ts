import { supabase } from '../../supabase'
import type { AgreementState } from './AgreementPill'

export type LaneStat = { lane: string; n: number; w: number }
export type AgreementAction = {
  agent_id: string; name: string; state: AgreementState
  expiry_date: string | null; days_left: number | null; ref: string | null
}

export type AgentsOverview = {
  quotes: number; prior_quotes: number; won: number; lost: number
  active_agents: number; hrs_to_win: number | null
  shipments: number; shipment_kg: number | null; agents: number
  agreements: Record<'active' | 'expiring' | 'expired' | 'awaiting' | 'draft', number>
  lanes: LaneStat[]
  actions: AgreementAction[]
}

export type AgentStats = {
  quotes: number; open: number; held: number; won: number; lost: number
  hrs_to_win: number | null; fastest_win: number | null; team_conv: number | null
  shipments: number; shipment_kg: number | null
  trend: { month: string; quotes: number; won: number }[]
  modes: { mode: string; n: number }[]
  lanes: { lane: string; q: number; w: number; s: number; kg: number }[]
}

export type Bookings = {
  freehand: number; booked: number
  freehand_kg?: number | null; booked_kg?: number | null
  freehand_gp?: number | null; booked_gp?: number | null
  freehand_agents?: number; booked_agents?: number; two_way_agents?: number
}

/** Free hand and booked (nomination) from billing, see v_agent_jobs. Last 12 months. */
export async function fetchBookingsOverview(): Promise<Bookings | null> {
  const { data, error } = await supabase.rpc('agents_bookings_overview')
  if (error) return null
  return data as Bookings
}

export async function fetchAgentBookings(agentId: string): Promise<Bookings | null> {
  const { data, error } = await supabase.rpc('agent_bookings', { p_agent: agentId })
  if (error) return null
  return data as Bookings
}

export function fmtMoney(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}m`
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}k`
  return `$${Math.round(n)}`
}

export async function fetchAgentsOverview(months = 12): Promise<AgentsOverview | null> {
  const { data, error } = await supabase.rpc('agents_overview', { p_months: months })
  if (error) throw error
  return (data as AgentsOverview) ?? null
}

export async function fetchAgentStats(agentId: string, months = 12): Promise<AgentStats | null> {
  const { data, error } = await supabase.rpc('agent_stats', { p_agent: agentId, p_months: months })
  if (error) throw error
  return (data as AgentStats) ?? null
}

export type AgentAgreementSummary = {
  agreement_id: string; ref: string; status: string; state: AgreementState
  effective_date: string; expiry_date: string; days_left: number
}

export async function fetchAgentAgreementState(agentId: string): Promise<AgentAgreementSummary | null> {
  const { data, error } = await supabase.from('v_agent_agreement_state').select('*').eq('agent_id', agentId).maybeSingle()
  if (error) return null // view missing before migration: show "No agreement"
  return (data as AgentAgreementSummary) ?? null
}

export type AgentQuoteRow = {
  id: string; quote_no: string | null; status: string
  shipment_mode: string | null; shipment_type: string | null
  from_port_code: string | null; to_port_code: string | null
  pricing_executive_id: string | null; created_by: string | null
  created_at: string; won_at: string | null
}

export async function listAgentQuotes(agentId: string, status: string): Promise<AgentQuoteRow[]> {
  let q = supabase
    .from('v_agent_quotes')
    .select('id, quote_no, status, shipment_mode, shipment_type, from_port_code, to_port_code, pricing_executive_id, created_by, created_at, won_at')
    .eq('for_agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (status === 'won') q = q.in('status', ['won', 'crosswin'])
  else if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data as AgentQuoteRow[]) ?? []
}

// 0.4 -> "24m", 5.5 -> "5.5h", 50 -> "2.1d"
export function fmtHours(h: number | null | undefined): string {
  if (h == null) return '–'
  const v = Number(h)
  if (v < 1) return `${Math.max(1, Math.round(v * 60))}m`
  if (v < 48) return `${v.toFixed(1)}h`
  return `${(v / 24).toFixed(1)}d`
}

export function pct(won: number, total: number): number | null {
  return total > 0 ? Math.round((won / total) * 100) : null
}

export function modeOf(mode: string | null, type: string | null): string {
  if ((mode ?? '').toLowerCase().includes('air') || (type ?? '').toUpperCase() === 'AIR') return 'Air'
  return (type ?? '').toUpperCase() || (mode ?? '—')
}
