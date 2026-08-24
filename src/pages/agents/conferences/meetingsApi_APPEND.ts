
export type AgentContact = {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
}

export async function listAgentContacts(agentId: string): Promise<AgentContact[]> {
  const { data, error } = await supabase
    .from('agent_contacts')
    .select('id, name, role, email, phone')
    .eq('agent_id', agentId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data as AgentContact[]) ?? []
}

export async function deleteAgentContact(id: string): Promise<void> {
  const { error } = await supabase.from('agent_contacts').delete().eq('id', id)
  if (error) throw error
}

export async function addAgentContactDedup(
  agentId: string,
  c: { name: string; role?: string | null; email?: string | null; phone?: string | null },
): Promise<'added' | 'duplicate'> {
  const existing = await listAgentContacts(agentId)
  const email = c.email?.trim().toLowerCase() || null
  const name = c.name.trim().toLowerCase()
  const dup = existing.some((e) =>
    email ? e.email?.trim().toLowerCase() === email : e.name.trim().toLowerCase() === name,
  )
  if (dup) return 'duplicate'
  await addAgentContact(agentId, c)
  return 'added'
}
