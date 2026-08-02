import { supabase } from '../../supabase'

export type FclRateCardRow = {
  id: string
  shipping_line_code: string
  shipping_line_name: string | null
  title: string | null
  currency_code: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type FclRateCardListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
}

export async function listFclRateCards(
  args: FclRateCardListArgs,
): Promise<{ rows: FclRateCardRow[]; total: number }> {
  const { page, pageSize, search, status } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('rate_cards')
    .select(
      'id, shipping_line_code, title, currency_code, valid_from, valid_to, status, created_at, shipping_lines(name), rate_card_fcl_lines(count)',
      { count: 'exact' },
    )
    .eq('rate_type', 'fcl')
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const term = search.trim()
  if (term) {
    query = query.or(`title.ilike.%${term}%,shipping_line_code.ilike.%${term}%`)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: FclRateCardRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const line = Array.isArray(r.shipping_lines) ? r.shipping_lines[0] : r.shipping_lines
    const counts = r.rate_card_fcl_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      shipping_line_code: String(r.shipping_line_code),
      shipping_line_name: line?.name ? String(line.name) : null,
      title: r.title ? String(r.title) : null,
      currency_code: r.currency_code ? String(r.currency_code) : null,
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export type NewFclRateCard = {
  shipping_line_code: string
  title: string
  currency_code: string
  valid_from: string
  valid_to: string
}

export async function createFclRateCard(input: NewFclRateCard): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert({
      shipping_line_code: input.shipping_line_code,
      rate_type: 'fcl',
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
