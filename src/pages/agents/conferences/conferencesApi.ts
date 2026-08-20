import { supabase } from '../../../supabase'

export type Conference = {
  id: string
  name: string
  network_id: string | null
  location_name: string | null
  location_place_id: string | null
  location_lat: number | null
  location_lng: number | null
  start_date: string
  end_date: string
  default_meeting_minutes: number
  cover_image_url: string | null
  header_image_url: string | null
  created_at: string
}

export type ConferenceCard = Conference & {
  network_code: string | null
  meeting_count: number
}

export type CreateConferenceInput = {
  name: string
  network_id: string | null
  location_name: string | null
  location_place_id: string | null
  location_lat: number | null
  location_lng: number | null
  start_date: string
  end_date: string
  default_meeting_minutes: number
}

type ConferenceRow = Conference & {
  freight_networks: { code: string } | null
}

export function conferenceBucket(c: {
  start_date: string
  end_date: string
}): 'current' | 'upcoming' | 'past' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${c.start_date}T00:00:00`)
  const end = new Date(`${c.end_date}T00:00:00`)
  end.setHours(23, 59, 59, 999)
  if (today >= start && today <= end) return 'current'
  if (today < start) return 'upcoming'
  return 'past'
}

export async function listConferences(): Promise<ConferenceCard[]> {
  const [{ data, error }, { data: meetings, error: meetingsError }] = await Promise.all([
    supabase
      .from('conferences')
      .select('*, freight_networks(code)')
      .order('start_date', { ascending: false }),
    supabase.from('conference_meetings').select('conference_id'),
  ])
  if (error) throw error
  if (meetingsError) throw meetingsError

  const counts = new Map<string, number>()
  for (const row of meetings ?? []) {
    const id = row.conference_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return ((data as ConferenceRow[]) ?? []).map((row) => {
    const { freight_networks, ...conference } = row
    return {
      ...conference,
      network_code: freight_networks?.code ?? null,
      meeting_count: counts.get(row.id) ?? 0,
    }
  })
}

export async function createConference(input: CreateConferenceInput): Promise<string> {
  const { data, error } = await supabase
    .from('conferences')
    .insert({ ...input })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export type ConferencePhoto = {
  id: string
  conference_id: string
  image_url: string
  caption: string | null
  sort_order: number
  created_at: string
}

export type ConferenceStats = {
  total_meetings: number
  agents_met: number
  agents_revisited: number
}

export type ViewMode = 'desktop' | 'mobile'

export type ConferenceDetail = Conference & {
  network_code: string | null
}

export async function fetchConference(id: string): Promise<ConferenceDetail | null> {
  const { data, error } = await supabase
    .from('conferences')
    .select('*, freight_networks(code)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { freight_networks, ...conference } = data as ConferenceRow
  return {
    ...conference,
    network_code: freight_networks?.code ?? null,
  }
}

export async function updateConferenceSettings(
  id: string,
  patch: Partial<{
    default_meeting_minutes: number
    name: string
    cover_image_url: string | null
    header_image_url: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('conferences').update(patch).eq('id', id)
  if (error) throw error
}

export async function listConferencePhotos(conferenceId: string): Promise<ConferencePhoto[]> {
  const { data, error } = await supabase
    .from('conference_photos')
    .select('*')
    .eq('conference_id', conferenceId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as ConferencePhoto[]) ?? []
}

export async function addConferencePhoto(
  conferenceId: string,
  imageUrl: string,
): Promise<ConferencePhoto> {
  const { data, error } = await supabase
    .from('conference_photos')
    .insert({ conference_id: conferenceId, image_url: imageUrl, sort_order: 0 })
    .select('*')
    .single()
  if (error) throw error
  return data as ConferencePhoto
}

export async function deleteConferencePhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('conference_photos').delete().eq('id', photoId)
  if (error) throw error
}

export async function fetchConferenceStats(conferenceId: string): Promise<ConferenceStats> {
  const { data: meetings, error } = await supabase
    .from('conference_meetings')
    .select('agent_id, status')
    .eq('conference_id', conferenceId)
  if (error) throw error

  const rows = meetings ?? []
  const completedAgentIds = new Set<string>()
  for (const row of rows) {
    if (row.status === 'completed' && row.agent_id) {
      completedAgentIds.add(row.agent_id as string)
    }
  }

  let agentsRevisited = 0
  if (completedAgentIds.size > 0) {
    const { data: prior, error: priorError } = await supabase
      .from('conference_meetings')
      .select('agent_id')
      .eq('status', 'completed')
      .neq('conference_id', conferenceId)
      .in('agent_id', [...completedAgentIds])
    if (priorError) throw priorError
    agentsRevisited = new Set((prior ?? []).map((r) => r.agent_id as string)).size
  }

  return {
    total_meetings: rows.length,
    agents_met: completedAgentIds.size,
    agents_revisited: agentsRevisited,
  }
}

export async function getViewPref(userId: string): Promise<ViewMode | null> {
  const { data, error } = await supabase
    .from('conference_view_prefs')
    .select('view_mode')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.view_mode as ViewMode | null) ?? null
}

export async function setViewPref(userId: string, mode: ViewMode): Promise<void> {
  const { error } = await supabase.from('conference_view_prefs').upsert({
    user_id: userId,
    view_mode: mode,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function uploadConferenceImage(
  conferenceId: string,
  file: File,
  kind: 'cover' | 'header' | 'gallery',
): Promise<string> {
  const path = `${conferenceId}/${kind}-${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('conferences').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('conferences').getPublicUrl(path)
  return data.publicUrl
}
