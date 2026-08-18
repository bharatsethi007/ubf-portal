import { supabase } from '../../supabase'
import type { FclRateCardListArgs } from './ratesApi'

// ---------- Air rate cards ----------
export type AirRateCardRow = {
  id: string
  vendor_account_id: string | null
  vendor_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export async function listAirRateCards(args: FclRateCardListArgs): Promise<{ rows: AirRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  let query = supabase
    .from('rate_cards')
    .select('id, vendor_account_id, vendor_name, title, currency_code, valid_from, valid_to, status, created_at, rate_card_air_lines(count)', { count: 'exact' })
    .eq('rate_type', 'air')
    .order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)
  const term = search.trim()
  if (term) query = query.or(`title.ilike.%${term}%,vendor_name.ilike.%${term}%,vendor_account_id.ilike.%${term}%`)
  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  const rows: AirRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const counts = r.rate_card_air_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      vendor_account_id: r.vendor_account_id ? String(r.vendor_account_id) : null,
      vendor_name: r.vendor_name ? String(r.vendor_name) : null,
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

export type NewAirRateCard = {
  airline_code: string
  airline_name: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createAirRateCard(input: NewAirRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      vendor_account_id: input.airline_code,
      vendor_name: input.airline_name || null,
      shipping_line_code: null,
      co_loader_code: null,
      rate_type: 'air',
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

export type AirRateCardDetail = {
  id: string
  airline_code: string
  airline_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  default_markup_pct: number | null
}

export async function fetchAirRateCard(id: string): Promise<AirRateCardDetail | null> {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('id, vendor_account_id, vendor_name, title, currency_code, valid_from, valid_to, status, default_markup_pct')
    .eq('id', id).eq('rate_type', 'air').maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: String(r.id),
    airline_code: String(r.vendor_account_id ?? ''),
    airline_name: r.vendor_name ? String(r.vendor_name) : null,
    title: r.title ? String(r.title) : null,
    currency_code: r.currency_code ? String(r.currency_code) : null,
    valid_from: r.valid_from ? String(r.valid_from) : null,
    valid_to: r.valid_to ? String(r.valid_to) : null,
    status: String(r.status),
    default_markup_pct: r.default_markup_pct == null ? null : Number(r.default_markup_pct),
  }
}

export async function updateAirRateCardHeader(
  id: string,
  patch: { airline_code: string; airline_name: string | null; title: string | null; currency_code: string | null; valid_from: string | null; valid_to: string | null; status: string; default_markup_pct: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('rate_cards')
    .update({
      vendor_account_id: patch.airline_code,
      vendor_name: patch.airline_name,
      title: patch.title,
      currency_code: patch.currency_code,
      valid_from: patch.valid_from,
      valid_to: patch.valid_to,
      status: patch.status,
      default_markup_pct: patch.default_markup_pct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ---------- Air lines (per-kg weight breaks) ----------
export type AirLineDraft = {
  key: string
  dbId: string | null
  origin_port_code: string
  dest_port_code: string
  min_charge: string
  rate_n: string
  rate_45: string
  rate_100: string
  rate_250: string
  rate_500: string
  rate_1000: string
  markup_pct?: string
  currency_code: string
  transit_days: string
  via: string
  frequency: string
  confidence?: 'green' | 'amber' | 'red'
  raw_origin?: string
  note?: string
}

const AIR_LINE_COLS = 'id, origin_port_code, dest_port_code, min_charge, rate_n, rate_45, rate_100, rate_250, rate_500, rate_1000, markup_pct, currency_code, transit_days, via, frequency'

export async function listAirLines(cardId: string): Promise<AirLineDraft[]> {
  const { data, error } = await supabase
    .from('rate_card_air_lines')
    .select(AIR_LINE_COLS)
    .eq('rate_card_id', cardId).order('created_at', { ascending: true })
  if (error) throw error
  const s = (v: any) => (v == null ? '' : String(v))
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    origin_port_code: r.origin_port_code ? String(r.origin_port_code) : '',
    dest_port_code: r.dest_port_code ? String(r.dest_port_code) : '',
    min_charge: s(r.min_charge),
    rate_n: s(r.rate_n),
    rate_45: s(r.rate_45),
    rate_100: s(r.rate_100),
    rate_250: s(r.rate_250),
    rate_500: s(r.rate_500),
    rate_1000: s(r.rate_1000),
    markup_pct: s(r.markup_pct),
    currency_code: r.currency_code ? String(r.currency_code) : '',
    transit_days: s(r.transit_days),
    via: r.via ? String(r.via) : '',
    frequency: r.frequency ? String(r.frequency) : '',
  }))
}

const numOrNull = (v?: string) => (v == null || v === '' ? null : Number(v))

function airLinePayload(cardId: string, l: AirLineDraft) {
  return {
    rate_card_id: cardId,
    origin_port_code: l.origin_port_code || null,
    origin_group_code: null as string | null,
    dest_port_code: l.dest_port_code,
    min_charge: numOrNull(l.min_charge),
    rate_n: numOrNull(l.rate_n),
    rate_45: numOrNull(l.rate_45),
    rate_100: numOrNull(l.rate_100),
    rate_250: numOrNull(l.rate_250),
    rate_500: numOrNull(l.rate_500),
    rate_1000: numOrNull(l.rate_1000),
    markup_pct: numOrNull(l.markup_pct),
    currency_code: l.currency_code || null,
    transit_days: l.transit_days ? Number(l.transit_days) : null,
    via: l.via.trim() || null,
    frequency: l.frequency.trim() || null,
  }
}

export async function saveAirLines(cardId: string, lines: AirLineDraft[], originalIds: string[]): Promise<void> {
  const keptIds = new Set(lines.filter((l) => l.dbId).map((l) => l.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('rate_card_air_lines').delete().in('id', toDelete)
    if (error) throw error
  }
  for (const l of lines) {
    const payload = airLinePayload(cardId, l)
    if (l.dbId) {
      const { error } = await supabase.from('rate_card_air_lines').update(payload).eq('id', l.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rate_card_air_lines').insert(payload)
      if (error) throw error
    }
  }
}

export async function insertAirLines(cardId: string, lines: AirLineDraft[]): Promise<number> {
  if (lines.length === 0) return 0
  const payload = lines.map((l) => ({ ...airLinePayload(cardId, l), confidence: l.confidence ?? 'green', raw_origin: l.raw_origin ?? null }))
  const { error } = await supabase.from('rate_card_air_lines').insert(payload)
  if (error) throw error
  return payload.length
}
