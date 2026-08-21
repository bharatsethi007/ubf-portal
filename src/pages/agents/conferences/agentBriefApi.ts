import { supabase } from '../../../supabase'

export type AgentBriefLane = {
  origin: string | null
  destination: string | null
  mode: string | null
  direction: string | null
  shipments: number
  last_etd: string | null
}

export type AgentBriefInvoice = {
  invoice_no: string | null
  balance: number
  currency: string | null
}

export type AgentBrief = {
  linked: boolean
  erp_account_code?: string
  shipments_total: number
  shipments_12m: number
  revenue_total: number
  gp_total: number
  unpaid_count: number
  unpaid_balance: number
  last_shipment: string | null
  recent_lanes: AgentBriefLane[]
  unpaid_invoices: AgentBriefInvoice[]
}

const briefCache = new Map<string, AgentBrief>()

export async function fetchAgentBrief(agentId: string, force = false): Promise<AgentBrief> {
  if (!force) {
    const cached = briefCache.get(agentId)
    if (cached) return cached
  }
  const { data, error } = await supabase.rpc('get_agent_brief', { p_agent_id: agentId })
  if (error) throw new Error(error.message || 'Failed to load brief')
  const brief = data as AgentBrief
  briefCache.set(agentId, brief)
  return brief
}
