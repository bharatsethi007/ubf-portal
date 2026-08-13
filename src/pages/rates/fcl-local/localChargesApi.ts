import { supabase } from '../../../supabase'

export type LocalChargeSheetRow = {
  id: string
  title: string | null
  direction: string
  movement: string
  port_codes: string[]
  shipping_line_codes: string[]
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type LocalChargeSheetListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
  direction: string
}

export type NewLocalChargeSheet = {
  title: string
  direction: 'origin' | 'dest'
  movement: 'import' | 'export'
  valid_from: string
  valid_to: string
}

export async function listLocalChargeSheets(
  args: LocalChargeSheetListArgs,
): Promise<{ rows: LocalChargeSheetRow[]; total: number }> {
  const { page, pageSize, search, status, direction } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('local_charge_sheets')
    .select(
      'id, title, direction, movement, port_codes, shipping_line_codes, valid_from, valid_to, status, created_at, local_charge_lines(count)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (direction !== 'all') query = query.eq('direction', direction)

  const term = search.trim()
  if (term) query = query.ilike('title', `%${term}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: LocalChargeSheetRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const counts = r.local_charge_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      title: r.title ? String(r.title) : null,
      direction: String(r.direction),
      movement: String(r.movement),
      port_codes: Array.isArray(r.port_codes) ? r.port_codes.map(String) : [],
      shipping_line_codes: Array.isArray(r.shipping_line_codes) ? r.shipping_line_codes.map(String) : [],
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export async function createLocalChargeSheet(input: NewLocalChargeSheet): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('local_charge_sheets')
    .insert({
      title: input.title || null,
      direction: input.direction,
      movement: input.movement,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: String(data.id) }
}
