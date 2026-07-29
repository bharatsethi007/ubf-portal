import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Row = Record<string, unknown>

// Factory: builds a cached reference-data hook (mirrors useSeaPorts caching).
function makeRefHook<T>(table: string, columns: string, map: (r: Row) => T) {
  let cache: T[] | null = null
  let pending: Promise<T[]> | null = null

  async function load(): Promise<T[]> {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error || !data) return []
    return (data as Row[]).map(map)
  }

  return function useRef(): { items: T[]; loading: boolean } {
    const [items, setItems] = useState<T[]>(cache ?? [])
    const [loading, setLoading] = useState(!cache)
    useEffect(() => {
      if (cache) { setItems(cache); setLoading(false); return }
      if (!pending) pending = load()
      let cancelled = false
      pending.then((list) => {
        cache = list
        if (!cancelled) { setItems(list); setLoading(false) }
      })
      return () => { cancelled = true }
    }, [])
    return { items, loading }
  }
}

export type Currency = { code: string; name: string; symbol: string | null }
export type ChargeUnit = { code: string; label: string }
export type TaxRate = { code: string; label: string; rate_pct: number }
export type ShippingLine = { code: string; name: string }

export const useCurrencies = makeRefHook<Currency>(
  'currencies', 'code,name,symbol,sort_order',
  (r) => ({ code: String(r.code), name: String(r.name ?? r.code), symbol: r.symbol ? String(r.symbol) : null }),
)
export const useChargeUnits = makeRefHook<ChargeUnit>(
  'charge_units', 'code,label,sort_order',
  (r) => ({ code: String(r.code), label: String(r.label ?? r.code) }),
)
export const useTaxRates = makeRefHook<TaxRate>(
  'tax_rates', 'code,label,rate_pct,sort_order',
  (r) => ({ code: String(r.code), label: String(r.label ?? r.code), rate_pct: Number(r.rate_pct ?? 0) }),
)
export const useShippingLines = makeRefHook<ShippingLine>(
  'shipping_lines', 'code,name,sort_order',
  (r) => ({ code: String(r.code), name: String(r.name ?? r.code) }),
)
