import { supabase } from '../../../supabase'

export type CartageTemplate = { id: string; name: string; body: string }

export async function listCartageTemplates(): Promise<CartageTemplate[]> {
  const { data, error } = await supabase
    .from('cartage_templates')
    .select('id, name, body')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as CartageTemplate[]
}

export async function createCartageTemplate(name: string, body: string): Promise<void> {
  const { error } = await supabase.from('cartage_templates').insert({ name: name.trim(), body })
  if (error) throw error
}

export async function updateCartageTemplate(id: string, patch: { name?: string; body?: string }): Promise<void> {
  const { error } = await supabase.from('cartage_templates').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteCartageTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('cartage_templates').delete().eq('id', id)
  if (error) throw error
}
