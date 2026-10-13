import { supabase } from '@/supabase'
import type { ContractRule } from '@/pages/rates/margins/contractRatesApi'

export type PreviewOption = {
  ref: string
  product: 'FCL' | 'LCL' | 'AIR'
  carrier: string | null
  container_type: string | null
  currency: string
  unit: string
  sell: number | null
  sell_min: number | null
  contract?: boolean
  transit_days: number | null
  via: string | null
  valid_to: string | null
  origin: string | null
  destination: string | null
}

export type PreviewQuery = { mode: 'sea' | 'air'; load: 'FCL' | 'LCL'; container: string; origin: string; destination: string }

/** Exactly what this customer sees on the portal for a lane (sell side only). */
export async function previewCustomerRates(accountId: string, q: PreviewQuery): Promise<PreviewOption[]> {
  const { data, error } = await supabase.rpc('staff_preview_customer_rates', {
    p_account: accountId,
    p_pol: q.origin,
    p_pod: q.destination,
    p_mode: q.mode,
    p_load: q.mode === 'sea' ? q.load : null,
    p_container: q.mode === 'sea' && q.load === 'FCL' ? q.container || null : null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as PreviewOption[]
}

export async function listCustomerRules(accountId: string): Promise<ContractRule[]> {
  const { data, error } = await supabase
    .from('rate_margin_rules')
    .select('id, account_id, product, method, value, min_margin, origin_code, dest_code, container_type, carrier, currency_code, valid_from, valid_to, active, notes, updated_at, customers(name)')
    .eq('account_id', accountId)
    .order('product').order('dest_code', { nullsFirst: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ContractRule[]
}

export type SharedCard = { id: string; title: string | null; rate_type: string; status: string; valid_to: string | null; others: number }

/** Rate cards shared with this customer, plus how many other customers each is shared with. */
export async function listSharedCards(accountId: string): Promise<SharedCard[]> {
  const { data, error } = await supabase
    .from('rate_card_customers')
    .select('rate_card_id, rate_cards!inner(id, title, rate_type, status, valid_to, rate_card_customers(account_id))')
    .eq('account_id', accountId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as { rate_cards: { id: string; title: string | null; rate_type: string; status: string; valid_to: string | null; rate_card_customers: { account_id: string }[] } }[])
    .map((r) => ({
      id: r.rate_cards.id, title: r.rate_cards.title, rate_type: r.rate_cards.rate_type, status: r.rate_cards.status,
      valid_to: r.rate_cards.valid_to, others: Math.max(0, (r.rate_cards.rate_card_customers?.length ?? 1) - 1),
    }))
    .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
}

export async function unshareCard(cardId: string, accountId: string): Promise<void> {
  const { error } = await supabase.from('rate_card_customers').delete().eq('rate_card_id', cardId).eq('account_id', accountId)
  if (error) throw new Error(error.message)
}

export async function customerName(accountId: string): Promise<string> {
  const { data } = await supabase.from('customers').select('name').eq('account_id', accountId).maybeSingle()
  return (data as { name: string | null } | null)?.name ?? accountId
}
