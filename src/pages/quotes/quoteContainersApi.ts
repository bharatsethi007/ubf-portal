import { supabase } from '../../supabase'

export type ContainerSize = '20' | '40' | '40HC' | '45HC'
export type ContainerType =
  | 'standard' | 'reefer' | 'opentop' | 'flatrack' | 'isotank' | 'openside'

export type QuoteContainerDraft = {
  ord: number
  container_size: ContainerSize
  container_type: ContainerType
  qty: number
  weight_per_container_mt: number | null
  commodity: string | null
}

export type QuoteContainer = QuoteContainerDraft & {
  id: string
  quote_id: string
  created_at: string
}

export function emptyContainerGroup(ord = 0): QuoteContainerDraft {
  return {
    ord,
    container_size: '20',
    container_type: 'standard',
    qty: 1,
    weight_per_container_mt: null,
    commodity: null,
  }
}

export async function fetchQuoteContainers(quoteId: string): Promise<QuoteContainer[]> {
  const { data, error } = await supabase
    .from('quote_containers')
    .select('*')
    .eq('quote_id', quoteId)
    .order('ord', { ascending: true })
  if (error) throw error
  return (data as QuoteContainer[]) ?? []
}

// Replace all container rows for a quote in one shot (used on create + edit save).
export async function replaceQuoteContainers(
  quoteId: string,
  groups: QuoteContainerDraft[],
): Promise<void> {
  const del = await supabase.from('quote_containers').delete().eq('quote_id', quoteId)
  if (del.error) throw del.error
  if (groups.length === 0) return
  const rows = groups.map((g, i) => ({ ...g, ord: i, quote_id: quoteId }))
  const { error } = await supabase.from('quote_containers').insert(rows)
  if (error) throw error
}
