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
