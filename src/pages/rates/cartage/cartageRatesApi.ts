import { supabase } from '../../../supabase'

export type CartageRateCardRow = {
  id: string
  vendor_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type CartageRateCardListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
}

export async function listCartageRateCards(
  args: CartageRateCardListArgs,
): Promise<{ rows: CartageRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('rate_cards')
    .select(
      'id, vendor_name, title, currency_code, valid_from, valid_to, status, created_at, rate_card_cartage_fcl_lines(count), rate_card_cartage_ltl_lanes(count)',
      { count: 'exact' },
    )
    .eq('rate_type', 'cartage')
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const term = search.trim()
  if (term) query = query.or(`title.ilike.%${term}%,vendor_name.ilike.%${term}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: CartageRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const fcl = Array.isArray(r.rate_card_cartage_fcl_lines) ? Number(r.rate_card_cartage_fcl_lines[0]?.count ?? 0) : 0
    const ltl = Array.isArray(r.rate_card_cartage_ltl_lanes) ? Number(r.rate_card_cartage_ltl_lanes[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      vendor_name: r.vendor_name ? String(r.vendor_name) : null,
      title: r.title ? String(r.title) : null,
      currency_code: r.currency_code ? String(r.currency_code) : null,
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count: fcl + ltl,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export type NewCartageRateCard = {
  vendor_account_id?: string
  vendor_name?: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createCartageRateCard(input: NewCartageRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      vendor_account_id: input.vendor_account_id || null,
      vendor_name: input.vendor_name || null,
      shipping_line_code: null,
      rate_type: 'cartage',
      title: input.title || null,
      currency_code: input.currency_code || null,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: String(data.id) }
}
