import { supabase } from '@/supabase'

export type Product = 'FCL' | 'LCL' | 'AIR'
export type Method = 'pct' | 'flat'

export type MarginRule = {
  id: string
  account_id: string | null
  product: Product
  method: Method
  value: number
  min_margin: number | null
  active: boolean
  notes: string | null
  updated_at: string
  customers?: { name: string | null } | null
}

export type RuleDraft = Pick<MarginRule, 'account_id' | 'product' | 'method' | 'value' | 'min_margin' | 'active' | 'notes'>

export type RateSearch = {
  id: number
  account_id: string | null
  mode: string | null
  load_type: string | null
  container_type: string | null
  origin: string | null
  destination: string | null
  results: number | null
  priced: number | null
  searched_at: string
}

export const PRODUCTS: { v: Product; label: string; unit: string; defaultMethod: Method }[] = [
  { v: 'FCL', label: 'Sea FCL', unit: 'per container', defaultMethod: 'flat' },
  { v: 'LCL', label: 'Sea LCL', unit: 'per W/M', defaultMethod: 'pct' },
  { v: 'AIR', label: 'Air', unit: 'per kg', defaultMethod: 'pct' },
]

export async function listMarginRules(): Promise<MarginRule[]> {
  const { data, error } = await supabase
    .from('rate_margin_rules')
    .select('id, account_id, product, method, value, min_margin, active, notes, updated_at, customers(name)')
    .order('account_id', { ascending: true, nullsFirst: true })
    .order('product')
  if (error) throw error
  return (data ?? []) as unknown as MarginRule[]
}

/** One rule per customer + product (null customer = default), so save is an upsert on that pair. */
export async function saveMarginRule(draft: RuleDraft, id?: string): Promise<void> {
  const row = { ...draft, value: Number(draft.value), min_margin: draft.min_margin == null ? null : Number(draft.min_margin) }
  const { error } = id
    ? await supabase.from('rate_margin_rules').update(row).eq('id', id)
    : await supabase.from('rate_margin_rules').insert(row)
  if (error) {
    if (error.code === '23505') throw new Error('That customer already has a rule for this product. Edit it instead.')
    throw error
  }
}

export async function deleteMarginRule(id: string): Promise<void> {
  const { error } = await supabase.from('rate_margin_rules').delete().eq('id', id)
  if (error) throw error
}

export async function listRecentSearches(limit = 25): Promise<RateSearch[]> {
  const { data } = await supabase
    .from('portal_rate_searches')
    .select('id, account_id, mode, load_type, container_type, origin, destination, results, priced, searched_at')
    .order('searched_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as RateSearch[]
}

export function describeRule(r: Pick<MarginRule, 'method' | 'value' | 'min_margin' | 'product'>): string {
  const unit = PRODUCTS.find((p) => p.v === r.product)?.unit ?? ''
  const base = r.method === 'pct' ? `+${r.value}% on buy` : `+${r.value} ${unit}`
  return r.min_margin ? `${base}, at least ${r.min_margin} ${unit}` : base
}
