import { supabase } from '../../../supabase'

export type MeetingStatus = 'upcoming' | 'completed' | 'cancelled' | 'no_show'

export type ConferenceMeeting = {
  id: string
  conference_id: string
  meeting_date: string
  start_time: string
  end_time: string
  agent_id: string | null
  manual_agent_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: MeetingStatus
  cancel_reason: string | null
  notes: string | null
  ai_summary: string | null
  transcript: string | null
  audio_url: string | null
  transcribe_status: string
  created_at: string
  updated_at: string
  agent_name?: string | null
}

export type MeetingContactOption = {
  source: 'erp' | 'portal'
  name: string
  role: string | null
  email: string | null
  phone: string | null
}

type MeetingRow = ConferenceMeeting & {
  agents: { name: string } | null
}

export type CreateMeetingInput = {
  conference_id: string
  meeting_date: string
  start_time: string
  end_time: string
  agent_id: string | null
  manual_agent_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
}

function mapMeeting(row: MeetingRow): ConferenceMeeting {
  const { agents, ...meeting } = row
  return { ...meeting, agent_name: agents?.name ?? null }
}

export async function listDayMeetings(
  conferenceId: string,
  day: string,
): Promise<ConferenceMeeting[]> {
  const { data, error } = await supabase
    .from('conference_meetings')
    .select('*, agents(name)')
    .eq('conference_id', conferenceId)
    .eq('meeting_date', day)
    .order('start_time', { ascending: true })
  if (error) throw error
  return ((data as MeetingRow[]) ?? []).map(mapMeeting)
}

export async function createMeeting(input: CreateMeetingInput): Promise<string> {
  const { data, error } = await supabase
    .from('conference_meetings')
    .insert(input)
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateMeeting(
  id: string,
  patch: Partial<
    Pick<
      ConferenceMeeting,
      | 'start_time'
      | 'end_time'
      | 'agent_id'
      | 'manual_agent_name'
      | 'contact_name'
      | 'contact_email'
      | 'contact_phone'
      | 'status'
      | 'cancel_reason'
      | 'notes'
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from('conference_meetings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setMeetingStatus(
  id: string,
  status: MeetingStatus,
  cancelReason?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('conference_meetings')
    .update({
      status,
      cancel_reason: cancelReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('conference_meetings').delete().eq('id', id)
  if (error) throw error
}

export async function listAgentContactOptions(agentId: string): Promise<MeetingContactOption[]> {
  let erpAccountCode: string | null = null
  try {
    const { data } = await supabase
      .from('agents')
      .select('erp_account_code')
      .eq('id', agentId)
      .maybeSingle()
    erpAccountCode = data?.erp_account_code ?? null
  } catch {
    /* ignore */
  }

  const portal: MeetingContactOption[] = []
  try {
    const { data } = await supabase
      .from('agent_contacts')
      .select('name, role, email, phone')
      .eq('agent_id', agentId)
    for (const row of data ?? []) {
      portal.push({
        source: 'portal',
        name: row.name as string,
        role: (row.role as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
      })
    }
  } catch {
    /* ignore */
  }

  const erp: MeetingContactOption[] = []
  if (erpAccountCode) {
    try {
      const { data } = await supabase
        .from('contacts')
        .select('first_name, last_name, email, phone, is_prime')
        .eq('account_id', erpAccountCode)
      const sorted = [...(data ?? [])].sort(
        (a, b) => (b.is_prime ? 1 : 0) - (a.is_prime ? 1 : 0),
      )
      for (const row of sorted) {
        const name =
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          (row.email as string) ||
          'Contact'
        erp.push({
          source: 'erp',
          name,
          role: null,
          email: (row.email as string | null) ?? null,
          phone: (row.phone as string | null) ?? null,
        })
      }
    } catch {
      /* ignore */
    }
  }

  return [...portal, ...erp]
}

export async function addAgentContact(
  agentId: string,
  c: { name: string; role?: string | null; email?: string | null; phone?: string | null },
): Promise<void> {
  const { error } = await supabase.from('agent_contacts').insert({
    agent_id: agentId,
    name: c.name,
    role: c.role ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
  })
  if (error) throw error
}
