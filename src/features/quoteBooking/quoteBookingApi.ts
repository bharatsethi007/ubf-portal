import { supabase } from '@/supabase'

export type QuoteSuggestion = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  customer_account_id: string | null
  from_port_code: string | null
  to_port_code: string | null
  shipment_mode: string | null
  shipment_type: string | null
  movement_type: string | null
  created_at: string
  currency: string | null
  total_sell: number | null
  score: number
}

export type LinkedQuote = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  from_port_code: string | null
  to_port_code: string | null
  shipment_type: string | null
  incoterms: string | null
}

export type QuoteResponseSummary = {
  id: string
  response_no: string | null
  carrier: string | null
  currency: string | null
  total_sell: number | null
  total_buy: number | null
  net_profit: number | null
  margin_pct: number | null
  valid_till: string | null
  transit_time: string | null
}

export type QuoteResponseLine = {
  id: string
  ord: number | null
  charge_group: string | null
  description: string | null
  vendor: string | null
  unit: string | null
  qty: number | null
  buy_currency: string | null
  sell_currency: string | null
  buy_rate: number | null
  sell_rate: number | null
  total_buy: number | null
  total_sell: number | null
}

export async function createBookingFromQuote(quoteId: string): Promise<{ id: string; booking_ref: string }> {
  const { data, error } = await supabase.rpc('booking_create_from_quote', { p_quote: quoteId })
  if (error) throw new Error(error.message)
  return data as { id: string; booking_ref: string }
}

export async function linkQuoteToBooking(quoteId: string, bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('quote_booking_link', { p_quote: quoteId, p_booking: bookingId })
  if (error) throw new Error(error.message)
}

export async function unlinkQuote(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('quote_booking_unlink', { p_booking: bookingId })
  if (error) throw new Error(error.message)
}

export async function fetchQuoteSuggestions(
  bookingId: string, includeOpen: boolean, includeLost: boolean, search: string,
): Promise<QuoteSuggestion[]> {
  const { data, error } = await supabase.rpc('quote_link_suggestions', {
    p_booking: bookingId, p_include_open: includeOpen, p_include_lost: includeLost,
    p_search: search.trim() || null, p_limit: 25,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as QuoteSuggestion[]
}

export async function fetchBookingQuote(bookingId: string): Promise<{
  quote: LinkedQuote | null
  response: QuoteResponseSummary | null
  lines: QuoteResponseLine[]
}> {
  const { data: b, error: bErr } = await supabase
    .from('bookings').select('quote_id, quote_response_id').eq('id', bookingId).maybeSingle()
  if (bErr) throw new Error(bErr.message)
  if (!b?.quote_id) return { quote: null, response: null, lines: [] }

  const [{ data: q, error: qErr }, { data: r, error: rErr }] = await Promise.all([
    supabase.from('quotes')
      .select('id, quote_no, status, customer_name, from_port_code, to_port_code, shipment_type, incoterms')
      .eq('id', b.quote_id).maybeSingle(),
    b.quote_response_id
      ? supabase.from('quote_responses')
        .select('id, response_no, carrier, currency, total_sell, total_buy, net_profit, margin_pct, valid_till, transit_time')
        .eq('id', b.quote_response_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (qErr) throw new Error(qErr.message)
  if (rErr) throw new Error(rErr.message)

  let lines: QuoteResponseLine[] = []
  if (r?.id) {
    const { data: l, error: lErr } = await supabase.from('quote_response_lines')
      .select('id, ord, charge_group, description, vendor, unit, qty, buy_currency, sell_currency, buy_rate, sell_rate, total_buy, total_sell')
      .eq('response_id', r.id).order('ord', { ascending: true })
    if (lErr) throw new Error(lErr.message)
    lines = (l ?? []) as QuoteResponseLine[]
  }
  return { quote: q as LinkedQuote | null, response: r as QuoteResponseSummary | null, lines }
}

export async function fetchBookingRef(bookingId: string): Promise<string | null> {
  const { data } = await supabase.from('bookings').select('booking_ref').eq('id', bookingId).maybeSingle()
  return (data?.booking_ref as string | undefined) ?? null
}

export function money(v: number | null | undefined, ccy?: string | null): string {
  if (v == null || Number.isNaN(Number(v))) return '-'
  const n = Number(v).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return ccy ? `${ccy} ${n}` : n
}
