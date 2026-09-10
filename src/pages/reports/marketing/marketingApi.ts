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
  shipper_contact_name: string | null
  consignee_name: string | null
  consignee_contact_name: string | null
  customer_account_id: string | null
  customer_name: string | null
  customer_contact_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipper_email: string | null
  shipper_phone: string | null
  consignee_email: string | null
  consignee_phone: string | null
  os_agent_code: string | null
  agent_name: string | null
  agent_contact_name: string | null
  agent_email: string | null
  agent_phone: string | null
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

export function partyPhone(r: MarketingPartyRow, party: MktParty): string | null {
  switch (party) {
    case 'customer': return r.customer_phone
    case 'agent': return r.agent_phone
    case 'shipper': return r.shipper_phone
    case 'consignee': return r.consignee_phone
  }
}

export function partyContactName(r: MarketingPartyRow, party: MktParty): string | null {
  switch (party) {
    case 'customer': return r.customer_contact_name
    case 'agent': return r.agent_contact_name
    case 'shipper': return r.shipper_contact_name
    case 'consignee': return r.consignee_contact_name
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

export type MktContact = { email: string; phone: string | null; contact_name: string | null; name: string | null; account_code: string | null; shipment_count: number; last_shipment: string | null }

export function dedupContacts(rows: MarketingPartyRow[], party: MktParty): MktContact[] {
  const map = new Map<string, MktContact>()
  const hbls = new Map<string, Set<string>>()
  for (const r of rows) {
    const raw = partyEmail(r, party)
    const email = raw ? raw.trim().toLowerCase() : ''
    if (!email) continue
    if (!map.has(email)) {
      const code = party === 'agent' ? r.os_agent_code : party === 'customer' ? r.customer_account_id : null
      const ph = partyPhone(r, party)
      const cn = partyContactName(r, party)
      map.set(email, { email, phone: ph ? ph.trim() : null, contact_name: cn, name: partyName(r, party), account_code: code, shipment_count: 0, last_shipment: null })
      hbls.set(email, new Set())
    }
    const c = map.get(email)!
    hbls.get(email)!.add(r.house_bill ?? `row-${r.job_no ?? Math.random()}`)
    if (r.shipment_date && (!c.last_shipment || r.shipment_date > c.last_shipment)) c.last_shipment = r.shipment_date
  }
  for (const [email, c] of map) c.shipment_count = hbls.get(email)!.size
  return [...map.values()]
}

export function downloadContactsCsv(contacts: MktContact[], filename: string) {
  const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = contacts.map((c) => [c.email, c.phone, c.contact_name, c.name, c.account_code, String(c.shipment_count), c.last_shipment].map(esc).join(','))
  const csv = ['email,phone,contact_name,name,account_code,shipments,last_shipment', ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type BrevoList = { id: number; name: string }

export async function listBrevoLists(): Promise<{ lists: BrevoList[]; defaultFolderId: number | null }> {
  const { data, error } = await supabase.functions.invoke('marketing-brevo-sync', { body: { action: 'lists' } })
  if (error) throw new Error(error.message ?? 'Failed to load Brevo lists')
  if (data?.error) throw new Error(data.error)
  return { lists: data?.lists ?? [], defaultFolderId: data?.defaultFolderId ?? null }
}

export async function syncToBrevo(args: {
  contacts: MktContact[]
  listId?: number
  newListName?: string
  folderId?: number | null
}): Promise<{ queued: number }> {
  const payload: Record<string, unknown> = {
    action: 'sync',
    contacts: args.contacts.map((c) => ({ email: c.email, name: c.name, phone: c.phone, contact_name: c.contact_name, shipment_count: c.shipment_count, last_shipment: c.last_shipment })),
  }
  if (args.listId != null) payload.listId = args.listId
  else if (args.newListName) {
    payload.newListName = args.newListName
    if (args.folderId != null) payload.folderId = args.folderId
  }
  const { data, error } = await supabase.functions.invoke('marketing-brevo-sync', { body: payload })
  if (error) throw new Error(error.message ?? 'Brevo sync failed')
  if (data?.error) throw new Error(data.error)
  return { queued: data?.queued ?? 0 }
}
