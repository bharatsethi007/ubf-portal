import { supabase } from '../../../supabase'

export type CartageRateCardRow = {
  id: string
  vendor_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type CartageRateCardListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
}

export async function listCartageRateCards(
  args: CartageRateCardListArgs,
): Promise<{ rows: CartageRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('rate_cards')
    .select(
      'id, vendor_name, title, currency_code, valid_from, valid_to, status, created_at, rate_card_cartage_fcl_lines(count), rate_card_cartage_ltl_lanes(count)',
      { count: 'exact' },
    )
    .eq('rate_type', 'cartage')
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const term = search.trim()
  if (term) query = query.or(`title.ilike.%${term}%,vendor_name.ilike.%${term}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: CartageRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const fcl = Array.isArray(r.rate_card_cartage_fcl_lines) ? Number(r.rate_card_cartage_fcl_lines[0]?.count ?? 0) : 0
    const ltl = Array.isArray(r.rate_card_cartage_ltl_lanes) ? Number(r.rate_card_cartage_ltl_lanes[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      vendor_name: r.vendor_name ? String(r.vendor_name) : null,
      title: r.title ? String(r.title) : null,
      currency_code: r.currency_code ? String(r.currency_code) : null,
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count: fcl + ltl,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export type NewCartageRateCard = {
  vendor_account_id?: string
  vendor_name?: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createCartageRateCard(input: NewCartageRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      vendor_account_id: input.vendor_account_id || null,
      vendor_name: input.vendor_name || null,
      shipping_line_code: null,
      rate_type: 'cartage',
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

// ---------- detail header ----------
export type CartageRateCardDetail = {
  id: string
  vendor_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
}

export async function fetchCartageRateCard(id: string): Promise<CartageRateCardDetail | null> {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('id, vendor_name, title, currency_code, valid_from, valid_to, status')
    .eq('id', id)
    .eq('rate_type', 'cartage')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: String(r.id),
    vendor_name: r.vendor_name ? String(r.vendor_name) : null,
    title: r.title ? String(r.title) : null,
    currency_code: r.currency_code ? String(r.currency_code) : null,
    valid_from: r.valid_from ? String(r.valid_from) : null,
    valid_to: r.valid_to ? String(r.valid_to) : null,
    status: String(r.status),
  }
}

export async function updateCartageRateCardHeader(
  id: string,
  patch: {
    title: string | null
    currency_code: string | null
    valid_from: string | null
    valid_to: string | null
    status: string
  },
): Promise<void> {
  const { error } = await supabase
    .from('rate_cards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---------- FCL cartage lines ----------
export type CartageFclLineDraft = {
  key: string
  dbId: string | null
  direction: 'import' | 'export'
  origin_zone_id: string
  dest_zone_id: string
  container_size: string
  base_rate: string
  min_charge: string
  confidence?: 'green' | 'amber' | 'red'
  raw_origin?: string
  raw_dest?: string
  note?: string
}

export async function listCartageFclLines(cardId: string): Promise<CartageFclLineDraft[]> {
  const { data, error } = await supabase
    .from('rate_card_cartage_fcl_lines')
    .select('id, direction, origin_zone_id, dest_zone_id, container_size, base_rate, min_charge, confidence, raw_origin, raw_dest')
    .eq('rate_card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    direction: (r.direction === 'export' ? 'export' : 'import') as 'import' | 'export',
    origin_zone_id: r.origin_zone_id ? String(r.origin_zone_id) : '',
    dest_zone_id: r.dest_zone_id ? String(r.dest_zone_id) : '',
    container_size: r.container_size ? String(r.container_size) : '',
    base_rate: r.base_rate == null ? '' : String(r.base_rate),
    min_charge: r.min_charge == null ? '' : String(r.min_charge),
    confidence: (r.confidence ?? 'green') as 'green' | 'amber' | 'red',
    raw_origin: r.raw_origin ? String(r.raw_origin) : '',
    raw_dest: r.raw_dest ? String(r.raw_dest) : '',
  }))
}

function fclLinePayload(cardId: string, l: CartageFclLineDraft) {
  return {
    rate_card_id: cardId,
    direction: l.direction,
    origin_zone_id: l.origin_zone_id,
    dest_zone_id: l.dest_zone_id,
    container_size: l.container_size,
    base_rate: l.base_rate === '' ? null : Number(l.base_rate),
    min_charge: l.min_charge === '' ? null : Number(l.min_charge),
    confidence: l.confidence ?? 'green',
    raw_origin: l.raw_origin || null,
    raw_dest: l.raw_dest || null,
  }
}

export async function saveCartageFclLines(cardId: string, lines: CartageFclLineDraft[], originalIds: string[]): Promise<void> {
  const keptIds = new Set(lines.filter((l) => l.dbId).map((l) => l.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('rate_card_cartage_fcl_lines').delete().in('id', toDelete)
    if (error) throw error
  }
  for (const l of lines) {
    const payload = fclLinePayload(cardId, l)
    if (l.dbId) {
      const { error } = await supabase.from('rate_card_cartage_fcl_lines').update(payload).eq('id', l.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rate_card_cartage_fcl_lines').insert(payload)
      if (error) throw error
    }
  }
}
