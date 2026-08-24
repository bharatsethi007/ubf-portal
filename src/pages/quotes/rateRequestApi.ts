import { supabase } from '../../supabase'

export type IncotermRule = { request_agent_local: boolean; request_freight: boolean; note: string | null }

export type RateRequestContext = {
  quoteId: string
  polCode: string | null
  podCode: string | null
  polName: string | null
  podName: string | null
  polCountry: string | null
  podCountry: string | null
  mode: string | null
  modeLabel: string
  shipmentType: string | null
  incoterm: string | null
  incotermPlace: string | null
  movement: string | null
  customerName: string | null
  agentEnd: 'origin' | 'dest' | null
  agentCountry: string | null
  requestLocal: boolean
  requestFreight: boolean
  ruleNote: string | null
  addressLabel: string | null
  address: string | null
}

function modeLabelOf(mode: string | null, type: string | null): string {
  const t = (type || '').toUpperCase()
  if (t === 'AIR' || /air/i.test(mode || '')) return 'Air'
  if (t === 'LCL') return 'Sea LCL'
  if (t === 'FCL') return 'Sea FCL'
  return 'Sea'
}

async function portRow(code: string | null, mode: string | null): Promise<{ name: string | null; country: string | null } | null> {
  if (!code) return null
  const isAir = /air/i.test(mode || '')
  const { data } = await supabase.from('ports').select('name, country_code, kind').eq('code', code)
  const rows = (data as Record<string, any>[]) ?? []
  if (!rows.length) return null
  const pick = rows.find((r) => (isAir ? r.kind === 'air' : r.kind === 'sea')) ?? rows[0]
  return { name: pick.name ?? null, country: pick.country_code ?? null }
}

export async function fetchRateRequestContext(quoteId: string): Promise<RateRequestContext> {
  const { data: q, error } = await supabase.from('quotes')
    .select('from_port_code, to_port_code, shipment_mode, shipment_type, incoterms, incoterm_place, movement_type, customer_name, shipper_address, consignee_address, pickup_address, drop_address')
    .eq('id', quoteId).single()
  if (error) throw error
  const r = q as Record<string, any>
  const mode = r.shipment_mode ?? null
  const type = r.shipment_type ?? null
  const pol = await portRow(r.from_port_code ?? null, mode)
  const pod = await portRow(r.to_port_code ?? null, mode)
  const incoterm = r.incoterms ? String(r.incoterms).toUpperCase() : null
  const movement = r.movement_type ? String(r.movement_type).toLowerCase() : null

  let rule: IncotermRule | null = null
  if (incoterm && (movement === 'import' || movement === 'export')) {
    const { data: rd } = await supabase.from('incoterm_request_rules')
      .select('request_agent_local, request_freight, note').eq('incoterm', incoterm).eq('movement', movement).maybeSingle()
    if (rd) rule = rd as IncotermRule
  }

  const agentEnd: 'origin' | 'dest' | null = movement === 'export' ? 'dest' : movement === 'import' ? 'origin' : null
  const agentCountry = agentEnd === 'dest' ? (pod?.country ?? null) : agentEnd === 'origin' ? (pol?.country ?? null) : null
  const requestLocal = rule?.request_agent_local ?? false
  const requestFreight = rule?.request_freight ?? false

  let addressLabel: string | null = null
  let address: string | null = null
  if (requestLocal && agentEnd === 'origin') {
    address = (r.pickup_address || r.shipper_address || '') || null
    addressLabel = 'Pickup address (for origin cartage)'
  } else if (requestLocal && agentEnd === 'dest') {
    address = (r.drop_address || r.consignee_address || '') || null
    addressLabel = 'Delivery address (for destination cartage)'
  }

  return {
    quoteId,
    polCode: r.from_port_code ?? null, podCode: r.to_port_code ?? null,
    polName: pol?.name ?? null, podName: pod?.name ?? null,
    polCountry: pol?.country ?? null, podCountry: pod?.country ?? null,
    mode, modeLabel: modeLabelOf(mode, type), shipmentType: type,
    incoterm, incotermPlace: r.incoterm_place ?? null,
    movement, customerName: r.customer_name ?? null,
    agentEnd, agentCountry, requestLocal, requestFreight, ruleNote: rule?.note ?? null,
    addressLabel, address,
  }
}

export function askLines(ctx: RateRequestContext): string[] {
  const out: string[] = []
  if (ctx.requestFreight) out.push(`Freight ${ctx.polCode ?? '?'} → ${ctx.podCode ?? '?'}`)
  if (ctx.requestLocal) out.push(ctx.agentEnd === 'origin' ? `Origin local charges at ${ctx.polCode ?? 'origin'}` : `Destination local charges at ${ctx.podCode ?? 'destination'}`)
  return out
}

export function buildRateRequestEmail(ctx: RateRequestContext, contactName?: string | null): { subject: string; body: string } {
  const asks = askLines(ctx)
  const scopeSuffix =
    ctx.requestFreight && ctx.requestLocal ? ' — freight + local charges'
    : ctx.requestFreight ? ' — freight'
    : ctx.requestLocal ? (ctx.agentEnd === 'origin' ? ' — origin charges' : ' — destination charges')
    : ''
  const subject = `Rate request — ${ctx.polCode ?? '?'} → ${ctx.podCode ?? '?'} (${ctx.modeLabel}${ctx.incoterm ? `, ${ctx.incoterm}` : ''})${scopeSuffix}`

  const lines: string[] = []
  lines.push(contactName ? `Hi ${contactName},` : 'Hi,', '')
  lines.push('We have an upcoming shipment and would appreciate your best rates for the following:', '')
  lines.push(`Lane:       ${ctx.polName ? `${ctx.polName} (${ctx.polCode})` : ctx.polCode ?? '?'} -> ${ctx.podName ? `${ctx.podName} (${ctx.podCode})` : ctx.podCode ?? '?'}`)
  lines.push(`Mode:       ${ctx.modeLabel}`)
  if (ctx.incoterm) lines.push(`Incoterm:   ${ctx.incoterm}${ctx.incotermPlace ? ` ${ctx.incotermPlace}` : ''}`)
  if (ctx.movement) lines.push(`Movement:   ${ctx.movement === 'export' ? 'Export ex NZ' : 'Import to NZ'}`)
  lines.push('')
  if (asks.length) {
    lines.push('Please quote:')
    for (const a of asks) lines.push(`  - ${a}`)
  } else {
    lines.push('Please advise your applicable charges for this lane.')
  }
  if (ctx.address) lines.push('', `${ctx.addressLabel}:`, ctx.address)
  lines.push('', 'Please include validity, transit time and any conditions.', '', 'Kind regards,', 'UB Freight')
  return { subject, body: lines.join('\n') }
}

// ── Step 2: recipients + directory search ────────────────────────────────────

export type Recipient = {
  key: string
  source: 'agent' | 'customer' | 'manual'
  agentId: string | null
  accountId: string | null
  name: string | null
  email: string
}

export type DirectoryAgent = {
  id: string
  name: string
  trusted: boolean
  country: string | null
  email: string | null
  contactName: string | null
}

export async function searchAgentDirectory(opts: { country: string | null; trustedOnly: boolean; query: string }): Promise<DirectoryAgent[]> {
  let q = supabase.from('v_agent_directory').select('id, name, trusted, country, prime_email, prime_contact_name')
  if (opts.country) q = q.eq('country', opts.country)
  if (opts.trustedOnly) q = q.eq('trusted', true)
  if (opts.query.trim()) q = q.ilike('name', `%${opts.query.trim()}%`)
  const { data, error } = await q.order('trusted', { ascending: false }).order('name').limit(100)
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    id: String(r.id), name: String(r.name ?? ''), trusted: Boolean(r.trusted),
    country: r.country ?? null, email: r.prime_email ?? null, contactName: r.prime_contact_name ?? null,
  }))
}

export type DirectoryCustomer = { accountId: string; name: string; country: string | null; email: string | null; contactName: string | null }

export async function searchCustomers(query: string, country?: string | null): Promise<DirectoryCustomer[]> {
  const term = query.trim()
  let q = supabase.from('customers').select('account_id, name, country, email, contact').or('closed.is.null,closed.eq.false')
  if (country) q = q.eq('country', country)
  if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,account_id.ilike.%${term}%`)
  const { data, error } = await q.order('name').limit(50)
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    accountId: String(r.account_id), name: String(r.name ?? ''), country: r.country ?? null,
    email: r.email ?? null, contactName: r.contact ?? null,
  }))
}
