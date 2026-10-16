import { supabase } from '../../../supabase'
import { DEFAULT_TERMS, fxFor, updateCard } from './rateCardsApi'

export type SetupCard = {
  id: string; rate_type: string; title: string | null; status: string; valid_from: string | null; valid_to: string | null
  currency_code: string | null; vendor_name: string | null; shipping_line_code: string | null; co_loader_code: string | null
  default_margin_type: string | null; default_markup_pct: number | null; default_margin_fixed: number | null
}
export type SetupLine = {
  id: string; origin: string; dest: string; container: string | null; buy: number | null; sell: number | null; min: number | null
  sell_min: number | null; currency: string | null; transit_days: number | null; via: string | null; frequency: string | null
}

const TABLE: Record<string, string> = { fcl: 'rate_card_fcl_lines', lcl: 'rate_card_lcl_lines', air: 'rate_card_air_lines' }
const r2 = (n: number) => Math.round(n * 100) / 100

/** Sell as the rate engine prices this card: line sell > line margin > card margin. */
function sellOf(buy: number | null, lineSell: number | null, mType: string | null, mVal: number | null, linePct: number | null, c: SetupCard): number | null {
  if (lineSell != null) return Number(lineSell)
  if (buy == null) return null
  const b = Number(buy)
  if (mVal != null) return r2(mType === 'fixed' ? b + Number(mVal) : b * (1 + Number(mVal) / 100))
  if (linePct != null) return r2(b * (1 + Number(linePct) / 100))
  if (c.default_margin_type === 'fixed' && c.default_margin_fixed != null) return r2(b + Number(c.default_margin_fixed))
  if (c.default_markup_pct != null) return r2(b * (1 + Number(c.default_markup_pct) / 100))
  return null
}

export async function getSetupCard(id: string): Promise<{ card: SetupCard; lines: SetupLine[] }> {
  const { data: c, error } = await supabase.from('rate_cards')
    .select('id, rate_type, title, status, valid_from, valid_to, currency_code, vendor_name, shipping_line_code, co_loader_code, default_margin_type, default_markup_pct, default_margin_fixed')
    .eq('id', id).single()
  if (error) throw new Error(error.message)
  const card = c as SetupCard
  const t = TABLE[card.rate_type]
  if (!t) return { card, lines: [] }
  const { data } = await supabase.from(t).select('*').eq('rate_card_id', id).limit(3000)
  const lines = ((data ?? []) as Record<string, any>[]).map((l): SetupLine => {
    const buy = card.rate_type === 'fcl' ? l.base_rate : card.rate_type === 'lcl' ? l.rate_per_wm : l.rate_100
    const lineSell = card.rate_type === 'fcl' ? l.sell_rate : card.rate_type === 'lcl' ? l.sell_per_wm : null
    return {
      id: l.id, origin: l.origin_port_code ?? l.origin_group_code ?? '?', dest: l.dest_port_code ?? '?', container: l.container_type ?? null,
      buy: buy == null ? null : Number(buy), sell: sellOf(buy, lineSell, l.margin_type, l.margin_value, l.markup_pct ?? null, card),
      min: l.min_charge ?? null, sell_min: l.sell_min ?? null, currency: l.currency_code ?? card.currency_code,
      transit_days: l.transit_days ?? null, via: l.via ?? null, frequency: l.frequency ?? null,
    }
  }).sort((a, b) => `${a.origin}${a.dest}${a.container ?? ''}`.localeCompare(`${b.origin}${b.dest}${b.container ?? ''}`))
  return { card, lines }
}

/** One draft customer rate card from one or more Setup cards. */
export async function rateCardFromSetup(cards: string[], account: string, from: string, to: string, title: string): Promise<string> {
  const { data, error } = await supabase.rpc('customer_rate_card_from_setup', { p_cards: cards, p_account: account, p_from: from, p_to: to, p_title: title })
  if (error) throw new Error(error.message)
  const id = data as string
  await updateCard(id, { ...DEFAULT_TERMS, fx: await fxFor('USD') }).catch(() => undefined)
  return id
}
