import { supabase } from '../../supabase'

export type ExchangeRate = {
  base_currency: string
  quote_currency: string
  rate: number
  as_of: string
  source: string
  buy_correction_pct: number
  sell_correction_pct: number
}

export type SetupCurrency = {
  code: string
  name: string
  symbol: string | null
  active: boolean
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
  buy_correction_pct: number | string | null
  sell_correction_pct: number | string | null
}

type CurrencyRow = {
  code: string
  name: string
  symbol: string | null
  active: boolean | null
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
    buy_correction_pct: Number(row.buy_correction_pct ?? 0),
    sell_correction_pct: Number(row.sell_correction_pct ?? 0),
  }
}

function mapCurrency(row: CurrencyRow): SetupCurrency {
  return {
    code: String(row.code),
    name: String(row.name ?? row.code),
    symbol: row.symbol ? String(row.symbol) : null,
    active: row.active ?? true,
  }
}

const RATE_COLUMNS = 'base_currency, quote_currency, rate, as_of, source, buy_correction_pct, sell_correction_pct'

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select(RATE_COLUMNS)
    .order('base_currency', { ascending: true })
    .order('quote_currency', { ascending: true })
  if (error) throw error
  return ((data ?? []) as RateRow[]).map(mapRate)
}

export async function fetchRatesForBase(base: string): Promise<ExchangeRate[]> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select(RATE_COLUMNS)
    .eq('base_currency', base)
    .order('quote_currency', { ascending: true })
  if (error) throw error
  return ((data ?? []) as RateRow[]).map(mapRate)
}

export async function fetchEffectiveRates(base: string): Promise<Map<string, { buy: number; sell: number }>> {
  const rows = await fetchRatesForBase(base)
  const m = new Map<string, { buy: number; sell: number }>()
  for (const r of rows) {
    m.set(r.quote_currency, {
      buy: r.rate * (1 + (r.buy_correction_pct || 0) / 100),
      sell: r.rate * (1 + (r.sell_correction_pct || 0) / 100),
    })
  }
  return m
}

export async function updatePairCorrection(
  base: string,
  quote: string,
  buy_correction_pct: number,
  sell_correction_pct: number,
): Promise<void> {
  const { error } = await supabase
    .from('exchange_rates')
    .update({ buy_correction_pct, sell_correction_pct, updated_at: new Date().toISOString() })
    .eq('base_currency', base)
    .eq('quote_currency', quote)
  if (error) throw error
}

export async function fetchCurrencies(includeInactive = true): Promise<SetupCurrency[]> {
  let query = supabase
    .from('currencies')
    .select('code, name, symbol, active')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as CurrencyRow[]).map(mapCurrency)
}

export async function upsertCurrency(currency: SetupCurrency): Promise<void> {
  const code = currency.code.trim().toUpperCase()
  const { error } = await supabase.from('currencies').upsert(
    {
      code,
      name: currency.name.trim() || code,
      symbol: currency.symbol?.trim() || null,
      sort_order: 0,
      active: currency.active,
    },
    { onConflict: 'code' },
  )
  if (error) throw error
}

export async function setCurrencyActive(code: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('currencies').update({ active }).eq('code', code)
  if (error) throw error
}

export async function deleteCurrency(code: string): Promise<void> {
  const { error: ratesErr } = await supabase
    .from('exchange_rates')
    .delete()
    .or(`base_currency.eq.${code},quote_currency.eq.${code}`)
  if (ratesErr) throw ratesErr
  const { error } = await supabase.from('currencies').delete().eq('code', code)
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
