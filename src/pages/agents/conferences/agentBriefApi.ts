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

export async function fetchAgentBrief(agentId: string): Promise<AgentBrief> {
  const { data, error } = await supabase.rpc('get_agent_brief', { p_agent_id: agentId })
  if (error) throw error
  return data as AgentBrief
}
