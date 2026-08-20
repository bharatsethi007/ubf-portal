import { supabase } from '../../supabase'

export type AgentStatus = 'active' | 'prospect' | 'inactive'
export type AgentSource = 'erp' | 'prospect'

export type FreightNetwork = {
  id: string
  code: string
  name: string
  sort_order: number
  active: boolean
}

export type AgentRow = {
  id: string
  erp_account_code: string | null
  name: string
  country: string | null
  source: AgentSource
  status: AgentStatus
  trusted: boolean
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  network_codes: string[]
}

export type AgentDirectoryRow = AgentRow & {
  last_activity: string | null
  job_count: number
}

export type AgentListSort = {
  id: 'last_activity' | 'job_count' | 'name'
  desc: boolean
}

export type AgentListArgs = {
  page: number
  pageSize: number
  search: string
  status: string // 'all' | AgentStatus
  network: string // 'all' | network code | 'none'
  trusted: string // 'all' | 'yes' | 'no'
  sort?: AgentListSort
}

export type NewAgent = {
  name: string
  country: string | null
  status: AgentStatus
  notes: string | null
  network_codes: string[]
}

export type AgentPatch = {
  name?: string
  country?: string | null
  status?: AgentStatus
  trusted?: boolean
  approved_by?: string | null
  approved_at?: string | null
  notes?: string | null
}

export async function listFreightNetworks(): Promise<FreightNetwork[]> {
  const { data, error } = await supabase
    .from('freight_networks')
    .select('id, code, name, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as FreightNetwork[]) ?? []
}

export async function listAgents(
  args: AgentListArgs,
): Promise<{ rows: AgentDirectoryRow[]; total: number }> {
  const { page, pageSize, search, status, network, trusted, sort } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortCol = sort?.id ?? 'last_activity'
  const sortDesc = sort?.desc ?? true

  let query = supabase
    .from('v_agents_directory')
    .select(
      'id, erp_account_code, name, country, source, status, trusted, approved_by, approved_at, notes, created_at, last_activity, job_count, agent_networks(freight_networks(code))',
      { count: 'exact' },
    )
    .order(sortCol, { ascending: !sortDesc, nullsFirst: sortCol === 'last_activity' ? false : true })

  if (status !== 'all') query = query.eq('status', status)
  if (trusted === 'yes') query = query.eq('trusted', true)
  else if (trusted === 'no') query = query.eq('trusted', false)

  const term = search.trim()
  if (term) {
    if (/^[A-Za-z0-9]+$/.test(term)) {
      query = query.or(`name.ilike.%${term}%,erp_account_code.ilike.%${term}%`)
    } else {
      query = query.ilike('name', `%${term}%`)
    }
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  let rows: AgentDirectoryRow[] = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    erp_account_code: r.erp_account_code as string | null,
    name: r.name as string,
    country: r.country as string | null,
    source: r.source as AgentSource,
    status: r.status as AgentStatus,
    trusted: Boolean(r.trusted),
    approved_by: r.approved_by as string | null,
    approved_at: r.approved_at as string | null,
    notes: r.notes as string | null,
    created_at: r.created_at as string,
    last_activity: (r.last_activity as string | null) ?? null,
    job_count: Number(r.job_count ?? 0),
    network_codes: extractNetworkCodes(r.agent_networks),
  }))

  // Network filter is applied client-side against the embedded codes (PostgREST
  // can't easily filter a parent by a nested many-to-many membership in one call).
  if (network === 'none') rows = rows.filter((a) => a.network_codes.length === 0)
  else if (network !== 'all') rows = rows.filter((a) => a.network_codes.includes(network))

  return { rows, total: count ?? 0 }
}

export async function fetchAgent(id: string): Promise<AgentRow | null> {
  const { data, error } = await supabase
    .from('agents')
    .select(
      'id, erp_account_code, name, country, source, status, trusted, approved_by, approved_at, notes, created_at, agent_networks(freight_networks(code))',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: r.id,
    erp_account_code: r.erp_account_code,
    name: r.name,
    country: r.country,
    source: r.source,
    status: r.status,
    trusted: r.trusted,
    approved_by: r.approved_by,
    approved_at: r.approved_at,
    notes: r.notes,
    created_at: r.created_at,
    network_codes: extractNetworkCodes(r.agent_networks),
  }
}

export async function createAgent(a: NewAgent): Promise<string> {
  const { data, error } = await supabase
    .from('agents')
    .insert({
      name: a.name,
      country: a.country,
      status: a.status,
      notes: a.notes,
      source: 'prospect', // hand-created; no ERP code
    })
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  if (a.network_codes.length) await setAgentNetworks(id, a.network_codes)
  return id
}

export async function updateAgent(id: string, patch: AgentPatch): Promise<void> {
  const { error } = await supabase.from('agents').update(patch).eq('id', id)
  if (error) throw error
}

// Replace the agent's network set with exactly `codes` (diff-based).
export async function setAgentNetworks(agentId: string, codes: string[]): Promise<void> {
  const nets = await listFreightNetworks()
  const idByCode = new Map(nets.map((n) => [n.code, n.id]))
  const wantIds = codes.map((c) => idByCode.get(c)).filter(Boolean) as string[]

  const { data: existing, error: exErr } = await supabase
    .from('agent_networks')
    .select('network_id')
    .eq('agent_id', agentId)
  if (exErr) throw exErr
  const haveIds = new Set(((existing as { network_id: string }[]) ?? []).map((r) => r.network_id))
  const wantSet = new Set(wantIds)

  const toAdd = wantIds.filter((nid) => !haveIds.has(nid))
  const toRemove = [...haveIds].filter((nid) => !wantSet.has(nid))

  if (toAdd.length) {
    const { error } = await supabase
      .from('agent_networks')
      .insert(toAdd.map((network_id) => ({ agent_id: agentId, network_id })))
    if (error) throw error
  }
  for (const network_id of toRemove) {
    const { error } = await supabase
      .from('agent_networks')
      .delete()
      .eq('agent_id', agentId)
      .eq('network_id', network_id)
    if (error) throw error
  }
}

function extractNetworkCodes(agentNetworks: unknown): string[] {
  if (!Array.isArray(agentNetworks)) return []
  const codes: string[] = []
  for (const an of agentNetworks) {
    const fn = (an as Record<string, any>)?.freight_networks
    const code = Array.isArray(fn) ? fn[0]?.code : fn?.code
    if (code) codes.push(code)
  }
  return codes
}

// --- Trade lanes (shipments where this agent is the overseas agent) ---
export type AgentTradeLane = {
  origin: string | null
  destination: string | null
  mode: string | null
  direction: string | null
  shipments: number
  last_shipment: string | null
}

export async function fetchAgentTradeLanes(osAgentCode: string): Promise<AgentTradeLane[]> {
  if (!osAgentCode.trim()) return []

  const { data, error } = await supabase
    .from('shipments')
    .select('origin, destination, mode, direction, relevant_date')
    .eq('os_agent_code', osAgentCode)

  if (error) throw error

  const map = new Map<string, AgentTradeLane & { _last: string | null }>()
  for (const row of (data as Record<string, string | null>[]) ?? []) {
    const key = `${row.origin ?? ''}|${row.destination ?? ''}|${row.mode ?? ''}|${row.direction ?? ''}`
    const date = row.relevant_date
    const lane = map.get(key)
    if (!lane) {
      map.set(key, {
        origin: row.origin,
        destination: row.destination,
        mode: row.mode,
        direction: row.direction,
        shipments: 1,
        last_shipment: date,
        _last: date,
      })
      continue
    }
    lane.shipments += 1
    if (date && (!lane._last || date > lane._last)) {
      lane._last = date
      lane.last_shipment = date
    }
  }

  return [...map.values()]
    .map(({ _last: _, ...lane }) => lane)
    .sort((a, b) => b.shipments - a.shipments)
}

export type AgentLite = {
  id: string
  name: string
  erp_account_code: string | null
  country: string | null
}

export async function searchAgentsLite(term: string, limit = 8): Promise<AgentLite[]> {
  const t = term.trim()
  let q = supabase.from('agents').select('id, name, erp_account_code, country').order('name').limit(limit)
  if (t) q = q.or(`name.ilike.%${t}%,erp_account_code.ilike.%${t}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AgentLite[]
}
