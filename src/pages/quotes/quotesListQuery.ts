import { supabase } from '../../supabase'
import type { PortPair, QuotesMode } from './quotesStatsApi'

export const QUOTE_LIST_COLS =
  'id, quote_no, status, customer_name, shipment_mode, shipment_type, from_port_code, to_port_code, created_at, created_by, source, movement_type, lost_reason, lost_note, expires_at'

export type QuoteListFilters = {
  statusTab: string
  mode: QuotesMode
  search: string
  lane: PortPair
}

// One place for list filters, shared by the table and CSV export.
export function buildQuotesQuery(f: QuoteListFilters, withCount = false) {
  let query = supabase
    .from('quotes')
    .select(QUOTE_LIST_COLS, withCount ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false })

  if (f.statusTab !== 'all') query = query.eq('status', f.statusTab)
  if (f.mode === 'air') query = query.or('shipment_type.ilike.Air,shipment_mode.ilike.%air%')
  else if (f.mode === 'fcl') query = query.ilike('shipment_type', 'FCL')
  else if (f.mode === 'lcl') query = query.ilike('shipment_type', 'LCL')

  const term = f.search.trim()
  if (term) query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`)
  if (f.lane.from) query = query.ilike('from_port_code', f.lane.from)
  if (f.lane.to) query = query.ilike('to_port_code', f.lane.to)
  return query
}
