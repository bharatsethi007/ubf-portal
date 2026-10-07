import { supabase } from '../../supabase'

// Server copies header, cargo, containers and rate responses (as drafts). Returns new quote id.
export async function copyQuote(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('copy_quote', { p_id: id })
  if (error) throw error
  return data as string
}
