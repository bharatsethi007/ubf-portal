import { supabase } from '../../supabase'

// Shared shape for Kanban cards and Calendar events. Wider than the list row
// because cards surface pickup/delivery dates and the calendar keys on them.
export type BoardQuote = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  shipment_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  created_by: string | null
  created_at: string
  pickup_date: string | null
  delivery_date: string | null
}

// The three date columns that actually exist on `quotes` (no ETD/ETA column).
export type DateBasis = 'created_at' | 'pickup_date' | 'delivery_date'

export const DATE_BASES: { value: DateBasis; label: string; color: string }[] = [
  { value: 'created_at', label: 'Created', color: '#0EA5E9' },
  { value: 'pickup_date', label: 'Pickup', color: '#8B5CF6' },
  { value: 'delivery_date', label: 'Delivery', color: '#2563EB' },
]

const BOARD_COLS =
  'id, quote_no, status, customer_name, shipment_mode, shipment_type, from_port_code, to_port_code, created_by, created_at, pickup_date, delivery_date'

// Kanban loads the whole board (capped) and groups client-side by status.
export async function listBoardQuotes(search: string): Promise<BoardQuote[]> {
  let query = supabase
    .from('quotes')
    .select(BOARD_COLS)
    .order('created_at', { ascending: false })
    .limit(1000)

  const term = search.trim()
  if (term) query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`)

  const { data, error } = await query
  if (error) throw error
  return (data as BoardQuote[]) ?? []
}

// Calendar loads only rows whose chosen date falls inside the visible window.
// `toIso` is exclusive (pass the day after the last visible day).
export async function listCalendarQuotes(
  basis: DateBasis,
  fromIso: string,
  toIso: string,
  search: string,
): Promise<BoardQuote[]> {
  let query = supabase
    .from('quotes')
    .select(BOARD_COLS)
    .not(basis, 'is', null)
    .gte(basis, fromIso)
    .lt(basis, toIso)
    .order(basis, { ascending: true })
    .limit(1000)

  const term = search.trim()
  if (term) query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`)

  const { data, error } = await query
  if (error) throw error
  return (data as BoardQuote[]) ?? []
}
