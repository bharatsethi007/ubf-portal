import { supabase } from '../../supabase'

export type AgentPick = { agentId: string; name: string; erpAccountCode: string; country: string | null }

function mapRow(r: Record<string, any>): AgentPick {
  return {
    agentId: String(r.id),
    name: String(r.name ?? r.erp_account_code ?? ''),
    erpAccountCode: String(r.erp_account_code ?? ''),
    country: r.country ? String(r.country) : null,
  }
}

// Typeahead over the agents directory (name / ERP code / country).
export async function searchAgents(term: string, limit = 10): Promise<AgentPick[]> {
  const q = term.trim()
  let query = supabase
    .from('agents')
    .select('id, name, erp_account_code, country')
    .order('name', { ascending: true })
    .limit(limit)
  if (q) query = query.or(`name.ilike.%${q}%,erp_account_code.ilike.%${q}%,country.ilike.%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map(mapRow)
}

// Auto-detect: is this account (a picked customer) also a known agent? Matches
// customers.account_id against agents.erp_account_code. Returns the agent or null.
export async function findAgentByErpCode(accountCode: string | null | undefined): Promise<AgentPick | null> {
  const code = (accountCode || '').trim()
  if (!code) return null
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, erp_account_code, country')
    .eq('erp_account_code', code)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data as Record<string, any>) : null
}
