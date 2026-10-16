import { supabase } from '../../../supabase'
import type { Line, RateCard } from './rateCardModel'

export * from './rateCardModel'

export type CardListRow = {
  id: string; ref: string; version: number; account_id: string; customer: string; title: string; status: RateCard['status']
  valid_from: string; valid_to: string; sales_id: string | null; pricing_id: string | null
  submitted_at: string | null; published_at: string | null; updated_at: string
  lanes: number; shown: number; modes: string[]; gp: number | null; min_gp: number | null; buy_up: number; source_expiring: number
}

export type Candidate = {
  source_table: 'fcl' | 'lcl' | 'air'; line_id: string; card_id: string; card_title: string; vendor: string | null
  card_valid_to: string | null; origin_code: string; dest_code: string; container_type: string | null
  buy: number; buy_min: number | null; currency: string | null; transit_days: number | null; via: string | null; frequency: string | null
}

export type Watch = { line_id: string; current_buy: number | null; source_valid_to: string | null; source_title: string | null; source_status: string | null }
export type CardEvent = { id: number; kind: string; actor: string | null; detail: Record<string, unknown> | null; created_at: string }
export type CustomerRule = { product: string; method: 'pct' | 'flat' | 'fixed'; value: number; min_margin: number | null; account_id: string | null }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const listCards = () => rpc<CardListRow[]>('customer_rate_cards_list').then((r) => r ?? [])
export const cardWatch = (id: string) => rpc<Watch[]>('customer_rate_card_watch', { p_card: id }).then((r) => r ?? [])
export const findCandidates = (product: string, origin: string, dest: string, container: string) =>
  rpc<Candidate[]>('customer_rate_candidates', { p_product: product, p_origin: origin, p_dest: dest, p_container: container }).then((r) => r ?? [])
export const submitCard = (id: string, note: string) => rpc<void>('customer_rate_card_submit', { p_id: id, p_note: note })
export const requestChanges = (id: string, comment: string) => rpc<void>('customer_rate_card_request_changes', { p_id: id, p_comment: comment })
export const publishCard = (id: string, comment: string, ack: boolean) => rpc<number>('customer_rate_card_publish', { p_id: id, p_comment: comment, p_ack_low_gp: ack })
export const withdrawCard = (id: string) => rpc<void>('customer_rate_card_withdraw', { p_id: id })
export const reviseCard = (id: string, renew: boolean) => rpc<string>('customer_rate_card_revise', { p_id: id, p_renew: renew })

export async function getCard(id: string): Promise<{ card: RateCard; lines: Line[] }> {
  const [c, l] = await Promise.all([
    supabase.from('customer_rate_cards').select('*, customers(name)').eq('id', id).single(),
    supabase.from('customer_rate_card_lines').select('*').eq('card_id', id).order('sort').order('created_at'),
  ])
  if (c.error) throw new Error(c.error.message)
  if (l.error) throw new Error(l.error.message)
  const raw = c.data as RateCard & { customers?: { name: string | null } | null }
  return { card: { ...raw, customer: raw.customers?.name ?? raw.account_id }, lines: (l.data ?? []) as Line[] }
}

export async function listEvents(id: string): Promise<CardEvent[]> {
  const { data } = await supabase.from('customer_rate_card_events').select('*').eq('card_id', id).order('created_at', { ascending: false }).limit(50)
  return (data ?? []) as CardEvent[]
}

export async function logEvent(id: string, kind: string, detail?: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.auth.getUser()
  await supabase.from('customer_rate_card_events').insert({ card_id: id, kind, actor: data.user?.email ?? null, detail: detail ?? null })
}

export async function createCard(v: { account_id: string; title: string; valid_from: string; valid_to: string; sales_id: string | null; pricing_id: string | null; included: string; excluded: string; terms: string }): Promise<string> {
  const { data, error } = await supabase.from('customer_rate_cards').insert({ ...v, status: 'draft', fx: await fxFor('USD') }).select('id').single()
  if (error) throw new Error(error.message)
  await logEvent((data as { id: string }).id, 'created')
  return (data as { id: string }).id
}

export type CardPatch = Partial<Pick<RateCard, 'title' | 'valid_from' | 'valid_to' | 'presentation' | 'fx' | 'sales_id' | 'pricing_id' | 'included' | 'excluded' | 'terms' | 'status'>>

export async function updateCard(id: string, patch: CardPatch): Promise<void> {
  const { error } = await supabase.from('customer_rate_cards').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

const LINE_COLS: (keyof Line)[] = ['sort', 'product', 'origin_code', 'dest_code', 'container_type', 'carrier', 'transit_days', 'via', 'frequency',
  'source_table', 'source_line_id', 'source_card_id', 'buy', 'buy_currency', 'margin_method', 'margin_value', 'freight_sell', 'sell_min',
  'sell_currency', 'origin_sell', 'origin_currency', 'dest_sell', 'dest_currency', 'show', 'notes']

const pick = (l: Partial<Line>) => Object.fromEntries(LINE_COLS.filter((k) => k in l).map((k) => [k, l[k]]))

/** Save every changed line in one round trip. New lines have no id. */
export async function saveLines(cardId: string, lines: Partial<Line>[]): Promise<void> {
  const fresh = lines.filter((l) => !l.id).map((l) => ({ ...pick(l), card_id: cardId }))
  const old = lines.filter((l) => l.id).map((l) => ({ ...pick(l), id: l.id, card_id: cardId }))
  if (fresh.length) {
    const { error } = await supabase.from('customer_rate_card_lines').insert(fresh)
    if (error) throw new Error(error.message)
  }
  if (old.length) {
    const { error } = await supabase.from('customer_rate_card_lines').upsert(old)
    if (error) throw new Error(error.message)
  }
}

export async function deleteLines(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('customer_rate_card_lines').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

/** Customer's product-wide margin rule, else the default rule. */
export async function marginRules(accountId: string): Promise<CustomerRule[]> {
  const { data } = await supabase.from('rate_margin_rules')
    .select('product, method, value, min_margin, account_id')
    .eq('active', true).neq('method', 'fixed')
    .is('origin_code', null).is('dest_code', null).is('container_type', null).is('carrier', null)
    .or(`account_id.eq.${accountId},account_id.is.null`)
  return ((data ?? []) as CustomerRule[]).sort((a, b) => Number(!!b.account_id) - Number(!!a.account_id))
}

/** {"NZD": 0.56} = units of `base` per 1 NZD, from the live FX table. */
export async function fxFor(base: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('exchange_rates').select('quote_currency, rate').eq('base_currency', base)
  return Object.fromEntries(((data ?? []) as { quote_currency: string; rate: number }[]).map((r) => [r.quote_currency, Number(r.rate)]))
}
