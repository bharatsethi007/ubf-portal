import { supabase } from '@/supabase'
import type { Product } from './marginRulesApi'

/** A customer contract rate = a margin rule scoped to a lane. Fixed = set sell price per unit. */
export type ContractMethod = 'fixed' | 'pct' | 'flat'

export type ContractRule = {
  id: string
  account_id: string
  product: Product
  method: ContractMethod
  value: number
  min_margin: number | null
  origin_code: string | null
  dest_code: string | null
  container_type: string | null
  carrier: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  active: boolean
  notes: string | null
  updated_at: string
  customers?: { name: string | null } | null
}

export type ContractDraft = Omit<ContractRule, 'id' | 'updated_at' | 'customers'>

const COLS = 'id, account_id, product, method, value, min_margin, origin_code, dest_code, container_type, carrier, currency_code, valid_from, valid_to, active, notes, updated_at, customers(name)'

export const isLaneRule = (r: { origin_code?: string | null; dest_code?: string | null; container_type?: string | null; carrier?: string | null }) =>
  !!(r.origin_code || r.dest_code || r.container_type || r.carrier)

export async function listContractRules(): Promise<ContractRule[]> {
  const { data, error } = await supabase
    .from('rate_margin_rules')
    .select(COLS)
    .not('account_id', 'is', null)
    .or('origin_code.not.is.null,dest_code.not.is.null,container_type.not.is.null,carrier.not.is.null')
    .order('account_id')
    .order('product')
    .order('dest_code')
  if (error) throw error
  return (data ?? []) as unknown as ContractRule[]
}

export async function saveContractRule(d: ContractDraft, id?: string): Promise<void> {
  const row = {
    ...d,
    value: Number(d.value),
    min_margin: d.method === 'fixed' || d.min_margin == null ? null : Number(d.min_margin),
    currency_code: d.method === 'fixed' ? d.currency_code : null,
    container_type: d.product === 'FCL' ? d.container_type : null,
  }
  const { error } = id
    ? await supabase.from('rate_margin_rules').update(row).eq('id', id)
    : await supabase.from('rate_margin_rules').insert(row)
  if (error) {
    if (error.code === '23505') throw new Error('This customer already has a rule for this exact lane and start date.')
    if (error.code === '23514') throw new Error('A fixed price needs a destination.')
    throw error
  }
}

export async function deleteContractRule(id: string): Promise<void> {
  const { error } = await supabase.from('rate_margin_rules').delete().eq('id', id)
  if (error) throw error
}

const LINE_TABLE: Record<Product, { table: string; buy: string }> = {
  FCL: { table: 'rate_card_fcl_lines', buy: 'base_rate' },
  LCL: { table: 'rate_card_lcl_lines', buy: 'rate_per_wm' },
  AIR: { table: 'rate_card_air_lines', buy: 'rate_45' },
}

export type BuyHint = { count: number; min: number; max: number; currency: string | null }

/** Live buy rates on the lane, so staff can see a fixed price below cost before saving. */
export async function laneBuyHint(p: { product: Product; origin: string; dest: string; container: string }): Promise<BuyHint | null> {
  if (!p.dest) return null
  const t = LINE_TABLE[p.product]
  let q = supabase
    .from(t.table)
    .select(`${t.buy}, currency_code, origin_port_code, origin_group_code, rate_cards!inner(status, currency_code, valid_to)`)
    .eq('dest_port_code', p.dest.toUpperCase())
    .in('rate_cards.status', ['active', 'validated'])
    .limit(200)
  if (p.origin) q = q.or(`origin_port_code.eq.${p.origin.toUpperCase()},origin_group_code.eq.${p.origin.toUpperCase()}`)
  if (p.product === 'FCL' && p.container) q = q.eq('container_type', p.container.toUpperCase())
  const { data, error } = await q
  if (error || !data) return null
  const today = new Date().toISOString().slice(0, 10)
  const rows = (data as Record<string, any>[]).filter((r) => !r.rate_cards?.valid_to || r.rate_cards.valid_to >= today)
  const vals = rows.map((r) => Number(r[t.buy])).filter((n) => Number.isFinite(n) && n > 0)
  if (!vals.length) return { count: 0, min: 0, max: 0, currency: null }
  const cur = rows[0].currency_code ?? rows[0].rate_cards?.currency_code ?? null
  return { count: vals.length, min: Math.min(...vals), max: Math.max(...vals), currency: cur }
}

/** Codes that actually appear on live lines, for the lane pickers. */
export async function laneCodes(product: Product): Promise<{ origins: string[]; dests: string[]; carriers: string[] }> {
  const t = LINE_TABLE[product].table
  const [lines, cards] = await Promise.all([
    supabase.from(t).select('origin_port_code, origin_group_code, dest_port_code').limit(5000),
    supabase.from('rate_cards').select('shipping_line_code, co_loader_code, vendor_name').eq('rate_type', product.toLowerCase()),
  ])
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter(Boolean).map((x) => String(x).toUpperCase()))].sort()
  const l = (lines.data ?? []) as Record<string, string | null>[]
  const c = (cards.data ?? []) as Record<string, string | null>[]
  return {
    origins: uniq(l.flatMap((r) => [r.origin_port_code, r.origin_group_code])),
    dests: uniq(l.map((r) => r.dest_port_code)),
    carriers: uniq(c.flatMap((r) => [r.shipping_line_code, r.co_loader_code, r.vendor_name])),
  }
}

export function describeContract(r: Pick<ContractRule, 'method' | 'value' | 'currency_code' | 'min_margin'>, unit: string): string {
  if (r.method === 'fixed') return `${r.currency_code ?? ''} ${Number(r.value).toLocaleString('en-NZ')} ${unit}`.trim()
  const base = r.method === 'pct' ? `+${r.value}% on buy` : `+${r.value} ${unit}`
  return r.min_margin ? `${base}, min ${r.min_margin}` : base
}
