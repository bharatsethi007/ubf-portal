import { supabase } from '../../supabase'
import type { CustomerPickerValue } from '../../hooks/useBookings'

// A unified search result: a customer, an agent, or an account that is both.
export type Party = CustomerPickerValue & {
  isAgent: boolean
  isCustomer: boolean
  agentId: string | null // agents.id when this party is a known agent
}

const CUSTOMER_SELECT =
  'account_id, name, address1, address2, address3, city, state, postcode, country, phone, email, contact'

function mapCustomer(r: Record<string, any>): CustomerPickerValue {
  return {
    account_id: String(r.account_id),
    name: String(r.name ?? ''),
    address1: r.address1 ?? undefined,
    address2: r.address2 ?? undefined,
    address3: r.address3 ?? undefined,
    city: r.city ?? undefined,
    state: r.state ?? undefined,
    postcode: r.postcode ?? undefined,
    country: r.country ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    contact: r.contact ?? undefined,
  }
}

// Search customers and agents together. Customers whose account_id matches an
// agent's ERP code are badged as agents; agents not present as customers are
// added as agent-only parties (account_id = ERP code).
export async function searchParties(term: string, limit = 8): Promise<Party[]> {
  const q = term.trim()
  if (q.length < 2) return []

  const [custRes, agentRes] = await Promise.all([
    supabase.from('customers').select(CUSTOMER_SELECT).eq('closed', false).ilike('name', `%${q}%`).limit(limit),
    supabase.from('agents').select('id, name, erp_account_code, country').or(`name.ilike.%${q}%,erp_account_code.ilike.%${q}%`).limit(limit),
  ])
  if (custRes.error) throw custRes.error

  const customers = (custRes.data ?? []).map((r) => mapCustomer(r as Record<string, any>))
  const agentRows = (agentRes.data as Record<string, any>[]) ?? []

  // Map ERP code -> agent id for badging customers that are also agents.
  const agentByCode = new Map<string, { id: string; name: string; country: string | null }>()
  for (const a of agentRows) {
    const code = String(a.erp_account_code ?? '')
    if (code) agentByCode.set(code, { id: String(a.id), name: String(a.name ?? code), country: a.country ? String(a.country) : null })
  }
  // Also badge customers that are agents even if the agent name didn't match the term.
  const custCodes = customers.map((c) => c.account_id).filter((c) => !agentByCode.has(c))
  if (custCodes.length) {
    const { data: more } = await supabase.from('agents').select('id, name, erp_account_code, country').in('erp_account_code', custCodes)
    for (const a of ((more as Record<string, any>[]) ?? [])) {
      const code = String(a.erp_account_code ?? '')
      if (code) agentByCode.set(code, { id: String(a.id), name: String(a.name ?? code), country: a.country ? String(a.country) : null })
    }
  }

  const seen = new Set<string>()
  const out: Party[] = []
  for (const c of customers) {
    seen.add(c.account_id)
    const agent = agentByCode.get(c.account_id)
    out.push({ ...c, isAgent: !!agent, isCustomer: true, agentId: agent ? agent.id : null })
  }
  for (const a of agentRows) {
    const code = String(a.erp_account_code ?? '')
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({
      account_id: code,
      name: String(a.name ?? code),
      country: a.country ? String(a.country) : undefined,
      isAgent: true,
      isCustomer: false,
      agentId: String(a.id),
    })
  }
  return out
}
