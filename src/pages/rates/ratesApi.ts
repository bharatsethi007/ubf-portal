import { supabase } from '../../supabase'

export type FclRateCardRow = {
  id: string
  shipping_line_code: string
  shipping_line_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type FclRateCardListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
}

export async function listFclRateCards(
  args: FclRateCardListArgs,
): Promise<{ rows: FclRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('rate_cards')
    .select(
      'id, shipping_line_code, title, currency_code, valid_from, valid_to, status, created_at, shipping_lines(name), rate_card_fcl_lines(count)',
      { count: 'exact' },
    )
    .eq('rate_type', 'fcl')
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const term = search.trim()
  if (term) {
    query = query.or(`title.ilike.%${term}%,shipping_line_code.ilike.%${term}%`)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: FclRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const line = Array.isArray(r.shipping_lines) ? r.shipping_lines[0] : r.shipping_lines
    const counts = r.rate_card_fcl_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      shipping_line_code: String(r.shipping_line_code),
      shipping_line_name: line?.name ? String(line.name) : null,
      title: r.title ? String(r.title) : null,
      currency_code: r.currency_code ? String(r.currency_code) : null,
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export type NewFclRateCard = {
  shipping_line_code: string
  vendor_account_id?: string
  vendor_name?: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createFclRateCard(input: NewFclRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      shipping_line_code: input.shipping_line_code || null,
      vendor_account_id: input.vendor_account_id || null,
      vendor_name: input.vendor_name || null,
      rate_type: 'fcl',
      title: input.title || null,
      currency_code: input.currency_code || null,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: String(data.id) }
}

export type FclRateCardDetail = {
  id: string
  shipping_line_code: string
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  default_markup_pct: number | null
}

export async function fetchFclRateCard(id: string): Promise<FclRateCardDetail | null> {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('id, shipping_line_code, title, currency_code, valid_from, valid_to, status, default_markup_pct')
    .eq('id', id)
    .eq('rate_type', 'fcl')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: String(r.id),
    shipping_line_code: String(r.shipping_line_code),
    title: r.title ? String(r.title) : null,
    currency_code: r.currency_code ? String(r.currency_code) : null,
    valid_from: r.valid_from ? String(r.valid_from) : null,
    valid_to: r.valid_to ? String(r.valid_to) : null,
    status: String(r.status),
    default_markup_pct: r.default_markup_pct == null ? null : Number(r.default_markup_pct),
  }
}

export async function updateFclRateCardHeader(
  id: string,
  patch: {
    shipping_line_code: string
    title: string | null
    currency_code: string | null
    valid_from: string | null
    valid_to: string | null
    status: string
    default_markup_pct: number | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('rate_cards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export type FclLineDraft = {
  key: string
  dbId: string | null
  origin_port_code: string
  dest_port_code: string
  container_type: string
  base_rate: string
  sell_rate?: string
  currency_code: string
  transit_days: string
  via: string
  confidence?: 'green' | 'amber' | 'red'
  raw_origin?: string
  note?: string
}

export async function listFclLines(cardId: string): Promise<FclLineDraft[]> {
  const { data, error } = await supabase
    .from('rate_card_fcl_lines')
    .select('id, origin_port_code, dest_port_code, container_type, base_rate, sell_rate, currency_code, transit_days, via')
    .eq('rate_card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    origin_port_code: r.origin_port_code ? String(r.origin_port_code) : '',
    dest_port_code: r.dest_port_code ? String(r.dest_port_code) : '',
    container_type: r.container_type ? String(r.container_type) : '',
    base_rate: r.base_rate == null ? '' : String(r.base_rate),
    sell_rate: r.sell_rate == null ? '' : String(r.sell_rate),
    currency_code: r.currency_code ? String(r.currency_code) : '',
    transit_days: r.transit_days == null ? '' : String(r.transit_days),
    via: r.via ? String(r.via) : '',
  }))
}

export async function saveFclLines(cardId: string, lines: FclLineDraft[], originalIds: string[]): Promise<void> {
  const keptIds = new Set(lines.filter((l) => l.dbId).map((l) => l.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('rate_card_fcl_lines').delete().in('id', toDelete)
    if (error) throw error
  }
  for (const l of lines) {
    const payload = {
      rate_card_id: cardId,
      origin_port_code: l.origin_port_code || null,
      origin_group_code: null as string | null,
      dest_port_code: l.dest_port_code,
      container_type: l.container_type,
      base_rate: (l.base_rate ?? '') === '' ? null : Number(l.base_rate),
      sell_rate: (l.sell_rate ?? '') === '' ? null : Number(l.sell_rate),
      currency_code: l.currency_code || null,
      transit_days: l.transit_days ? Number(l.transit_days) : null,
      via: l.via.trim() || null,
    }
    if (l.dbId) {
      const { error } = await supabase.from('rate_card_fcl_lines').update(payload).eq('id', l.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rate_card_fcl_lines').insert(payload)
      if (error) throw error
    }
  }
}

export type FclSurchargeDraft = {
  key: string
  dbId: string | null
  charge_code: string
  label: string
  amount: string
  sell_amount?: string
  currency_code: string
  basis: string
  scope: string
  container_type: string
  condition: string
  charge_group: string
}

export async function listFclSurcharges(cardId: string): Promise<FclSurchargeDraft[]> {
  const { data, error } = await supabase
    .from('rate_surcharges')
    .select('id, charge_code, label, amount, sell_amount, currency_code, basis, scope, container_type, condition, charge_group')
    .eq('rate_card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    charge_code: r.charge_code ? String(r.charge_code) : '',
    label: r.label ? String(r.label) : '',
    amount: r.amount == null ? '' : String(r.amount),
    sell_amount: r.sell_amount == null ? '' : String(r.sell_amount),
    currency_code: r.currency_code ? String(r.currency_code) : '',
    basis: r.basis ? String(r.basis) : 'per_container',
    scope: r.scope ? String(r.scope) : '',
    container_type: r.container_type ? String(r.container_type) : '',
    condition: r.condition ? String(r.condition) : '',
    charge_group: r.charge_group ? String(r.charge_group) : '',
  }))
}

export async function saveFclSurcharges(
  cardId: string,
  rows: FclSurchargeDraft[],
  originalIds: string[],
): Promise<void> {
  const keptIds = new Set(rows.filter((r) => r.dbId).map((r) => r.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('rate_surcharges').delete().in('id', toDelete)
    if (error) throw error
  }
  for (const r of rows) {
    const payload = {
      rate_card_id: cardId,
      charge_code: r.charge_code || null,
      label: r.label.trim(),
      amount: Number(r.amount),
      sell_amount: (r.sell_amount ?? '') === '' ? null : Number(r.sell_amount),
      currency_code: r.currency_code || null,
      basis: r.basis || 'per_container',
      scope: r.scope || null,
      container_type: r.container_type || null,
      condition: r.condition.trim() || null,
      charge_group: r.charge_group || null,
      origin_port_code: null as string | null,
      origin_group_code: null as string | null,
    }
    if (r.dbId) {
      const { error } = await supabase.from('rate_surcharges').update(payload).eq('id', r.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rate_surcharges').insert(payload)
      if (error) throw error
    }
  }
}

export type RateRulesDoc = {
  id: string
  title: string
  content: string
  updated_at: string | null
}

function mapRateRules(r: Record<string, any>): RateRulesDoc {
  return {
    id: String(r.id),
    title: r.title ? String(r.title) : 'Rate Card House Rules',
    content: r.content ? String(r.content) : '',
    updated_at: r.updated_at ? String(r.updated_at) : null,
  }
}

export async function fetchGlobalRateRules(): Promise<RateRulesDoc> {
  const { data, error } = await supabase
    .from('rate_rules')
    .select('id, title, content, updated_at')
    .is('shipping_line_code', null)
    .maybeSingle()
  if (error) throw error
  if (data) return mapRateRules(data as Record<string, any>)
  const { data: created, error: insErr } = await supabase
    .from('rate_rules')
    .insert({ shipping_line_code: null, title: 'Rate Card House Rules', content: '' })
    .select('id, title, content, updated_at')
    .single()
  if (insErr) throw insErr
  return mapRateRules(created as Record<string, any>)
}

export async function saveRateRules(id: string, patch: { title: string; content: string }): Promise<string> {
  const { data, error } = await supabase
    .from('rate_rules')
    .update({ title: patch.title, content: patch.content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('updated_at')
    .single()
  if (error) throw error
  return String((data as Record<string, any>).updated_at)
}

export async function insertFclLines(cardId: string, lines: FclLineDraft[]): Promise<number> {
  if (lines.length === 0) return 0
  const payload = lines.map((l) => ({
    rate_card_id: cardId,
    origin_port_code: l.origin_port_code || null,
    origin_group_code: null as string | null,
    dest_port_code: l.dest_port_code,
    container_type: l.container_type,
    base_rate: (l.base_rate ?? '') === '' ? null : Number(l.base_rate),
    sell_rate: (l.sell_rate ?? '') === '' ? null : Number(l.sell_rate),
    currency_code: l.currency_code || null,
    transit_days: l.transit_days ? Number(l.transit_days) : null,
    via: l.via.trim() || null,
    confidence: l.confidence ?? 'green',
  }))
  const { error } = await supabase.from('rate_card_fcl_lines').insert(payload) // single call = atomic
  if (error) throw error
  return payload.length
}

export async function learnPortAliases(pairs: { alias: string; port_code: string }[]): Promise<number> {
  const candidates = new Map<string, { alias: string; port_code: string }>()
  for (const p of pairs) {
    const a = (p.alias || '').trim()
    if (!a || !p.port_code) continue
    candidates.set(a.toLowerCase(), { alias: a, port_code: p.port_code })
  }
  if (candidates.size === 0) return 0
  const { data: existing, error: exErr } = await supabase.from('port_aliases').select('alias')
  if (exErr) throw exErr
  const existingLower = new Set(((existing as { alias: string }[]) ?? []).map((r) => r.alias.toLowerCase()))
  const toInsert = [...candidates.values()]
    .filter((c) => !existingLower.has(c.alias.toLowerCase()))
    .map((c) => ({ alias: c.alias, port_code: c.port_code, source: 'human' }))
  if (toInsert.length === 0) return 0
  const { error } = await supabase.from('port_aliases').insert(toInsert)
  if (error) throw error
  return toInsert.length
}

// ---------- LCL rate cards ----------
export type LclRateCardRow = {
  id: string
  co_loader_code: string
  co_loader_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export async function listLclRateCards(
  args: FclRateCardListArgs,
): Promise<{ rows: LclRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  let query = supabase
    .from('rate_cards')
    .select(
      'id, co_loader_code, title, currency_code, valid_from, valid_to, status, created_at, co_loaders(name), rate_card_lcl_lines(count)',
      { count: 'exact' },
    )
    .eq('rate_type', 'lcl')
    .order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)
  const term = search.trim()
  if (term) query = query.or(`title.ilike.%${term}%,co_loader_code.ilike.%${term}%`)
  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  const rows: LclRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const cl = Array.isArray(r.co_loaders) ? r.co_loaders[0] : r.co_loaders
    const counts = r.rate_card_lcl_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      co_loader_code: String(r.co_loader_code ?? ''),
      co_loader_name: cl?.name ? String(cl.name) : null,
      title: r.title ? String(r.title) : null,
      currency_code: r.currency_code ? String(r.currency_code) : null,
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export type NewLclRateCard = {
  co_loader_code: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createLclRateCard(input: NewLclRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      co_loader_code: input.co_loader_code,
      shipping_line_code: null,
      rate_type: 'lcl',
      title: input.title || null,
      currency_code: input.currency_code || null,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: String(data.id) }
}

export type LclRateCardDetail = {
  id: string
  co_loader_code: string
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  default_markup_pct: number | null
}

export async function fetchLclRateCard(id: string): Promise<LclRateCardDetail | null> {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('id, co_loader_code, title, currency_code, valid_from, valid_to, status, default_markup_pct')
    .eq('id', id).eq('rate_type', 'lcl').maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: String(r.id),
    co_loader_code: String(r.co_loader_code ?? ''),
    title: r.title ? String(r.title) : null,
    currency_code: r.currency_code ? String(r.currency_code) : null,
    valid_from: r.valid_from ? String(r.valid_from) : null,
    valid_to: r.valid_to ? String(r.valid_to) : null,
    status: String(r.status),
    default_markup_pct: r.default_markup_pct == null ? null : Number(r.default_markup_pct),
  }
}

export async function updateLclRateCardHeader(
  id: string,
  patch: { co_loader_code: string; title: string | null; currency_code: string | null; valid_from: string | null; valid_to: string | null; status: string; default_markup_pct: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('rate_cards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export type LaneCharge = { code: string; label: string; per_wm: number }

export type LclLineDraft = {
  key: string
  dbId: string | null
  origin_port_code: string
  dest_port_code: string
  rate_per_wm: string
  sell_per_wm?: string
  min_charge: string
  sell_min?: string
  currency_code: string
  transit_days: string
  via: string
  frequency: string
  lane_charges: LaneCharge[]
  confidence?: 'green' | 'amber' | 'red'
  raw_origin?: string
  note?: string
}

export async function listLclLines(cardId: string): Promise<LclLineDraft[]> {
  const { data, error } = await supabase
    .from('rate_card_lcl_lines')
    .select('id, origin_port_code, dest_port_code, rate_per_wm, sell_per_wm, min_charge, sell_min, currency_code, transit_days, via, frequency, lane_charges')
    .eq('rate_card_id', cardId).order('created_at', { ascending: true })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    origin_port_code: r.origin_port_code ? String(r.origin_port_code) : '',
    dest_port_code: r.dest_port_code ? String(r.dest_port_code) : '',
    rate_per_wm: r.rate_per_wm == null ? '' : String(r.rate_per_wm),
    sell_per_wm: r.sell_per_wm == null ? '' : String(r.sell_per_wm),
    min_charge: r.min_charge == null ? '' : String(r.min_charge),
    sell_min: r.sell_min == null ? '' : String(r.sell_min),
    currency_code: r.currency_code ? String(r.currency_code) : '',
    transit_days: r.transit_days == null ? '' : String(r.transit_days),
    via: r.via ? String(r.via) : '',
    frequency: r.frequency ? String(r.frequency) : '',
    lane_charges: Array.isArray(r.lane_charges)
      ? (r.lane_charges as any[]).map((c) => ({ code: String(c.code ?? ''), label: String(c.label ?? c.code ?? ''), per_wm: Number(c.per_wm) || 0 }))
      : [],
  }))
}

function lclLinePayload(cardId: string, l: LclLineDraft) {
  return {
    rate_card_id: cardId,
    origin_port_code: l.origin_port_code || null,
    origin_group_code: null as string | null,
    dest_port_code: l.dest_port_code,
    rate_per_wm: Number(l.rate_per_wm),
    sell_per_wm: (l.sell_per_wm ?? '') === '' ? null : Number(l.sell_per_wm),
    min_charge: l.min_charge === '' ? null : Number(l.min_charge),
    sell_min: (l.sell_min ?? '') === '' ? null : Number(l.sell_min),
    currency_code: l.currency_code || null,
    transit_days: l.transit_days ? Number(l.transit_days) : null,
    via: l.via.trim() || null,
    frequency: l.frequency.trim() || null,
    lane_charges: l.lane_charges ?? [],
  }
}

export async function saveLclLines(cardId: string, lines: LclLineDraft[], originalIds: string[]): Promise<void> {
  const keptIds = new Set(lines.filter((l) => l.dbId).map((l) => l.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('rate_card_lcl_lines').delete().in('id', toDelete)
    if (error) throw error
  }
  for (const l of lines) {
    const payload = lclLinePayload(cardId, l)
    if (l.dbId) {
      const { error } = await supabase.from('rate_card_lcl_lines').update(payload).eq('id', l.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rate_card_lcl_lines').insert(payload)
      if (error) throw error
    }
  }
}

export async function insertLclLines(cardId: string, lines: LclLineDraft[]): Promise<number> {
  if (lines.length === 0) return 0
  const payload = lines.map((l) => ({ ...lclLinePayload(cardId, l), confidence: l.confidence ?? 'green' }))
  const { error } = await supabase.from('rate_card_lcl_lines').insert(payload)
  if (error) throw error
  return payload.length
}
