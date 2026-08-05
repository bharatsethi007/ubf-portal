import { supabase } from '../../../supabase'

export type DropOffDepot = {
  id: string
  code: string
  name: string
  active: boolean
  sort_order: number | null
}

export async function listDropOffDepots(): Promise<DropOffDepot[]> {
  const { data, error } = await supabase
    .from('drop_off_depots')
    .select('id, code, name, active, sort_order')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })
  if (error) throw error
  return (data ?? []) as DropOffDepot[]
}

export async function createDropOffDepot(code: string, name: string): Promise<void> {
  const { error } = await supabase.from('drop_off_depots').insert({ code: code.trim(), name: name.trim() })
  if (error) throw error
}

export async function updateDropOffDepot(id: string, patch: { code?: string; name?: string; active?: boolean }): Promise<void> {
  const { error } = await supabase.from('drop_off_depots').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteDropOffDepot(id: string): Promise<void> {
  const { error } = await supabase.from('drop_off_depots').delete().eq('id', id)
  if (error) throw error
}
