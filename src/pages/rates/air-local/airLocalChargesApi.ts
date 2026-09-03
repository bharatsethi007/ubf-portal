import { supabase } from '../../../supabase'

export type AirLocalChargeSheetRow = {
  id: string
  title: string | null
  direction: string
  movement: string
  airport_codes: string[]
  airline_codes: string[]
  valid_from: string | null
  valid_to: string | null
  status: string
  line_count: number
  created_at: string
}

export type AirLocalChargeSheetListArgs = {
  page: number
  pageSize: number
  search: string
  status: string
  direction: string
}

export type NewAirLocalChargeSheet = {
  title: string
  direction: 'origin' | 'dest'
  movement: 'import' | 'export'
  valid_from: string
  valid_to: string
}

export async function listAirLocalChargeSheets(
  args: AirLocalChargeSheetListArgs,
): Promise<{ rows: AirLocalChargeSheetRow[]; total: number }> {
  const { page, pageSize, search, status, direction } = args
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('air_local_charge_sheets')
    .select(
      'id, title, direction, movement, airport_codes, airline_codes, valid_from, valid_to, status, created_at, air_local_charge_lines(count)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (direction !== 'all') query = query.eq('direction', direction)

  const term = search.trim()
  if (term) query = query.ilike('title', `%${term}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  const rows: AirLocalChargeSheetRow[] = ((data as Record<string, any>[]) ?? []).map((r) => {
    const counts = r.air_local_charge_lines
    const line_count = Array.isArray(counts) ? Number(counts[0]?.count ?? 0) : 0
    return {
      id: String(r.id),
      title: r.title ? String(r.title) : null,
      direction: String(r.direction),
      movement: String(r.movement),
      airport_codes: Array.isArray(r.airport_codes) ? r.airport_codes.map(String) : [],
      airline_codes: Array.isArray(r.airline_codes) ? r.airline_codes.map(String) : [],
      valid_from: r.valid_from ? String(r.valid_from) : null,
      valid_to: r.valid_to ? String(r.valid_to) : null,
      status: String(r.status),
      line_count,
      created_at: String(r.created_at),
    }
  })
  return { rows, total: count ?? 0 }
}

export async function createAirLocalChargeSheet(input: NewAirLocalChargeSheet): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('air_local_charge_sheets')
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
