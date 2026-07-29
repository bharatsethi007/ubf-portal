import { supabase } from '../../supabase'

export type QuoteResponseHeader = {
  quotation_date: string | null
  valid_from: string | null
  valid_till: string | null
  etd: string | null
  eta: string | null
  carrier: string | null
  via_port: string | null
  transit_time_days: string | null
  origin_free_time_days: string | null
  detention_free_time_dest: string | null
  product: string | null
  currency: string | null
  exchange_rate: string | null
  include_payment_link: boolean
  enable_fixed_items: boolean
  customer_notes: string | null
  terms_conditions: string | null
}

export type QuoteResponseSummary = {
  id: string
  response_no: string | null
  status: string
  quotation_date: string | null
  carrier: string | null
  total_sell: number | null
  total_buy: number | null
  net_profit: number | null
  margin_pct: number | null
}

export type QuoteResponseRecord = QuoteResponseHeader & {
  id: string
  response_no: string | null
  quote_id: string
  status: string
}

function dateStr(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v).slice(0, 10)
}

function numStr(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function mapRecord(row: Record<string, unknown>): QuoteResponseRecord {
  return {
    id: String(row.id),
    response_no: (row.response_no as string | null) ?? null,
    quote_id: String(row.quote_id),
    status: String(row.status),
    quotation_date: dateStr(row.quotation_date),
    valid_from: dateStr(row.valid_from),
    valid_till: dateStr(row.valid_till),
    etd: dateStr(row.etd),
    eta: dateStr(row.eta),
    carrier: (row.carrier as string | null) ?? null,
    via_port: (row.via_port as string | null) ?? null,
    transit_time_days: numStr(row.transit_time_days),
    origin_free_time_days: numStr(row.origin_free_time_days),
    detention_free_time_dest: numStr(row.detention_free_time_dest),
    product: (row.product as string | null) ?? null,
    currency: (row.currency as string | null) ?? 'NZD',
    exchange_rate: numStr(row.exchange_rate) || '1',
    include_payment_link: Boolean(row.include_payment_link),
    enable_fixed_items: Boolean(row.enable_fixed_items),
    customer_notes: (row.customer_notes as string | null) ?? null,
    terms_conditions: (row.terms_conditions as string | null) ?? null,
  }
}

function parseNumField(s: string | null | undefined): number | null {
  if (!s?.trim()) return null
  return Number(s) || null
}

export async function fetchQuoteResponses(quoteId: string): Promise<QuoteResponseSummary[]> {
  const { data, error } = await supabase
    .from('quote_responses')
    .select(
      'id, response_no, status, quotation_date, carrier, total_sell, total_buy, net_profit, margin_pct',
    )
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    response_no: row.response_no ?? null,
    status: String(row.status),
    quotation_date: dateStr(row.quotation_date),
    carrier: row.carrier ?? null,
    total_sell: row.total_sell == null ? null : Number(row.total_sell),
    total_buy: row.total_buy == null ? null : Number(row.total_buy),
    net_profit: row.net_profit == null ? null : Number(row.net_profit),
    margin_pct: row.margin_pct == null ? null : Number(row.margin_pct),
  }))
}

export async function createQuoteResponse(quoteId: string): Promise<{ id: string }> {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('quote_responses')
    .insert({
      quote_id: quoteId,
      status: 'draft',
      currency: 'NZD',
      exchange_rate: 1,
      quotation_date: todayIso(),
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function fetchQuoteResponse(id: string): Promise<QuoteResponseRecord | null> {
  const { data, error } = await supabase.from('quote_responses').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapRecord(data as Record<string, unknown>) : null
}

export async function updateQuoteResponseHeader(
  id: string,
  patch: Partial<QuoteResponseHeader>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...patch }

  for (const key of [
    'transit_time_days',
    'origin_free_time_days',
    'detention_free_time_dest',
    'exchange_rate',
  ] as const) {
    if (key in patch) payload[key] = parseNumField(patch[key])
  }

  for (const key of [
    'quotation_date',
    'valid_from',
    'valid_till',
    'etd',
    'eta',
    'carrier',
    'via_port',
    'product',
    'currency',
    'customer_notes',
    'terms_conditions',
  ] as const) {
    if (key in patch) {
      const v = patch[key]
      payload[key] = typeof v === 'string' ? v.trim() || null : v
    }
  }

  const { error } = await supabase.from('quote_responses').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteQuoteResponse(id: string): Promise<void> {
  const { error } = await supabase.from('quote_responses').delete().eq('id', id)
  if (error) throw error
}

export async function setResponseStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('quote_responses').update({ status }).eq('id', id)
  if (error) throw error
}
