import { supabase } from '../../supabase'

export type NoteTemplate = { id: string; name: string; body: string; scope: string }

type NoteTemplateRow = { id: string; name: string; body: string; scope: string }

function mapRow(row: NoteTemplateRow): NoteTemplate {
  return { id: String(row.id), name: row.name, body: row.body, scope: row.scope }
}

export async function fetchNoteTemplates(scope = 'external'): Promise<NoteTemplate[]> {
  const { data, error } = await supabase
    .from('note_templates')
    .select('id, name, body, scope')
    .eq('scope', scope)
    .order('name')
  if (error) throw error
  return ((data ?? []) as NoteTemplateRow[]).map(mapRow)
}

export async function createNoteTemplate(
  name: string,
  body: string,
  scope = 'external',
): Promise<NoteTemplate> {
  const { data, error } = await supabase
    .from('note_templates')
    .insert({ name, body, scope })
    .select('id, name, body, scope')
    .single()
  if (error) throw error
  return mapRow(data as NoteTemplateRow)
}
