import { supabase } from '@/supabase'

export type MktMode = 'sea' | 'air'
export type MktDirection = 'export' | 'import'
export type MktParty = 'customer' | 'agent' | 'shipper' | 'consignee'

export type MarketingPartyRow = {
  job_no: string | null
  house_bill: string | null
  shipment_date: string | null
  origin: string | null
  destination: string | null
  shipper_name: string | null
  consignee_name: string | null
  customer_account_id: string | null
  customer_name: string | null
  customer_email: string | null
  shipper_email: string | null
  consignee_email: string | null
  os_agent_code: string | null
  agent_name: string | null
  agent_email: string | null
}

export async function fetchMarketingParties(
  mode: MktMode, direction: MktDirection, months = 6,
): Promise<MarketingPartyRow[]> {
  const { data, error } = await supabase.rpc('marketing_shipment_parties', {
    p_mode: mode, p_direction: direction, p_months: months,
  })
  if (error) throw error
  return (data ?? []) as MarketingPartyRow[]
}

export function partyEmail(r: MarketingPartyRow, party: MktParty): string | null {
  switch (party) {
    case 'customer': return r.customer_email
    case 'agent': return r.agent_email
    case 'shipper': return r.shipper_email
    case 'consignee': return r.consignee_email
  }
}

export function partyName(r: MarketingPartyRow, party: MktParty): string | null {
  switch (party) {
    case 'customer': return r.customer_name
    case 'agent': return r.agent_name
    case 'shipper': return r.shipper_name
    case 'consignee': return r.consignee_name
  }
}

export type MktContact = { email: string; name: string | null; account_code: string | null }

export function dedupContacts(rows: MarketingPartyRow[], party: MktParty): MktContact[] {
  const map = new Map<string, MktContact>()
  for (const r of rows) {
    const raw = partyEmail(r, party)
    const email = raw ? raw.trim().toLowerCase() : ''
    if (!email) continue
    if (!map.has(email)) {
      const code = party === 'agent' ? r.os_agent_code : party === 'customer' ? r.customer_account_id : null
      map.set(email, { email, name: partyName(r, party), account_code: code })
    }
  }
  return [...map.values()]
}

export function downloadContactsCsv(contacts: MktContact[], filename: string) {
  const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = contacts.map((c) => [c.email, c.name, c.account_code].map(esc).join(','))
  const csv = ['email,name,account_code', ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
