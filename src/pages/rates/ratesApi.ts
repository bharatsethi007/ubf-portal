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
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createFclRateCard(input: NewFclRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      shipping_line_code: input.shipping_line_code,
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
}

export async function fetchFclRateCard(id: string): Promise<FclRateCardDetail | null> {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('id, shipping_line_code, title, currency_code, valid_from, valid_to, status')
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
  currency_code: string
  transit_days: string
  via: string
}

export async function listFclLines(cardId: string): Promise<FclLineDraft[]> {
  const { data, error } = await supabase
    .from('rate_card_fcl_lines')
    .select('id, origin_port_code, dest_port_code, container_type, base_rate, currency_code, transit_days, via')
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
      base_rate: Number(l.base_rate),
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
