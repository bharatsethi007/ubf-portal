import { supabase } from '../../supabase'

export type ExchangeRate = {
  base_currency: string
  quote_currency: string
  rate: number
  as_of: string
  source: string
}

export type FxMargin = {
  currency: string
  margin_pct: number
}

export type FxSyncState = {
  last_requested_at: string | null
  last_applied_at: string | null
  last_result: string | null
}

type RateRow = {
  base_currency: string
  quote_currency: string
  rate: number | string
  as_of: string
  source: string
}

type MarginRow = {
  currency: string
  margin_pct: number | string | null
}

type SyncRow = {
  last_requested_at: string | null
  last_applied_at: string | null
  last_result: string | null
}

function mapRate(row: RateRow): ExchangeRate {
  return {
    base_currency: String(row.base_currency),
    quote_currency: String(row.quote_currency),
    rate: Number(row.rate),
    as_of: String(row.as_of),
    source: String(row.source),
  }
}

function mapMargin(row: MarginRow): FxMargin {
  return {
    currency: String(row.currency),
    margin_pct: Number(row.margin_pct ?? 0),
  }
}

function sortMargins(rows: FxMargin[]): FxMargin[] {
  return [...rows].sort((a, b) => {
    if (a.currency === '*') return -1
    if (b.currency === '*') return 1
    return a.currency.localeCompare(b.currency)
  })
}

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('base_currency, quote_currency, rate, as_of, source')
    .order('base_currency', { ascending: true })
    .order('quote_currency', { ascending: true })
  if (error) throw error
  return ((data ?? []) as RateRow[]).map(mapRate)
}

export async function fetchFxMargins(): Promise<FxMargin[]> {
  const { data, error } = await supabase
    .from('fx_margins')
    .select('currency, margin_pct')
  if (error) throw error
  return sortMargins(((data ?? []) as MarginRow[]).map(mapMargin))
}

export async function upsertFxMargin(currency: string, margin_pct: number): Promise<void> {
  const { error } = await supabase.from('fx_margins').upsert(
    { currency, margin_pct, updated_at: new Date().toISOString() },
    { onConflict: 'currency' },
  )
  if (error) throw error
}

export async function deleteFxMargin(currency: string): Promise<void> {
  const { error } = await supabase.from('fx_margins').delete().eq('currency', currency)
  if (error) throw error
}

export async function fetchFxSyncState(): Promise<FxSyncState | null> {
  const { data, error } = await supabase
    .from('fx_sync_state')
    .select('last_requested_at, last_applied_at, last_result')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as SyncRow
  return {
    last_requested_at: row.last_requested_at,
    last_applied_at: row.last_applied_at,
    last_result: row.last_result,
  }
}

export async function refreshFxRates(): Promise<string> {
  const { error: reqErr } = await supabase.rpc('fx_request')
  if (reqErr) throw reqErr
  await new Promise((r) => setTimeout(r, 5000))
  const { data, error } = await supabase.rpc('fx_apply')
  if (error) throw error
  return String(data ?? '')
}
