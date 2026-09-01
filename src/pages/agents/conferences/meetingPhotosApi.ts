import { supabase } from '../../../supabase'

export type MeetingPhoto = {
  id: string
  meeting_id: string
  image_url: string
  caption: string | null
  sort_order: number
  created_at: string
}

export async function listMeetingPhotos(meetingId: string): Promise<MeetingPhoto[]> {
  const { data, error } = await supabase
    .from('meeting_photos')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as MeetingPhoto[]) ?? []
}

export async function uploadMeetingPhoto(meetingId: string, file: File): Promise<MeetingPhoto> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `meeting-photos/${meetingId}/${Date.now()}-${safeName}`
  const up = await supabase.storage.from('conferences').upload(path, file, { upsert: true })
  if (up.error) throw up.error
  const { data: pub } = supabase.storage.from('conferences').getPublicUrl(path)

  const { data: existing } = await supabase
    .from('meeting_photos')
    .select('sort_order')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('meeting_photos')
    .insert({ meeting_id: meetingId, image_url: pub.publicUrl, sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data as MeetingPhoto
}

export async function deleteMeetingPhoto(id: string): Promise<void> {
  const { error } = await supabase.from('meeting_photos').delete().eq('id', id)
  if (error) throw error
}
