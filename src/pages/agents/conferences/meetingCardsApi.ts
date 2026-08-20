import { supabase } from '../../../supabase'
import { createAgent } from '../agentsApi'
import { addAgentContact } from './meetingsApi'

export type ExtractedCard = {
  person_name: string | null
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  website: string | null
  address: string | null
  country: string | null
}

export type MeetingCard = {
  id: string
  meeting_id: string
  agent_id: string | null
  image_url: string
  extracted: ExtractedCard | null
  sort_order: number
  created_at: string
}

export type CardScanResult = {
  card: ExtractedCard
  suggested_agent_match: { id: string; name: string } | null
}

export async function scanBusinessCard(
  image: { media_type: string; data_base64: string },
): Promise<CardScanResult> {
  const { data, error } = await supabase.functions.invoke('business-card-ocr', { body: { image } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return {
    card: data.card as ExtractedCard,
    suggested_agent_match: data.suggested_agent_match ?? null,
  }
}

export async function uploadCardImage(meetingId: string, file: File): Promise<string> {
  const path = `cards/${meetingId}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('conferences').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('conferences').getPublicUrl(path)
  return data.publicUrl
}

export async function addMeetingCard(
  meetingId: string,
  agentId: string | null,
  imageUrl: string,
  extracted: ExtractedCard,
): Promise<MeetingCard> {
  const { data: existing } = await supabase
    .from('meeting_cards')
    .select('sort_order')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('meeting_cards')
    .insert({
      meeting_id: meetingId,
      agent_id: agentId,
      image_url: imageUrl,
      extracted,
      sort_order: sortOrder,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as MeetingCard
}

export async function listMeetingCards(meetingId: string): Promise<MeetingCard[]> {
  const { data, error } = await supabase
    .from('meeting_cards')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as MeetingCard[]) ?? []
}

export async function deleteMeetingCard(cardId: string): Promise<void> {
  const { error } = await supabase.from('meeting_cards').delete().eq('id', cardId)
  if (error) throw error
}

function buildNote(card: ExtractedCard): string {
  const lines: string[] = []
  if (card.person_name) {
    lines.push(`Contact: ${card.person_name}${card.title ? ` (${card.title})` : ''}`)
  }
  if (card.email) lines.push(`Email: ${card.email}`)
  const phone = card.mobile ?? card.phone
  if (phone) lines.push(`Phone: ${phone}`)
  if (card.website) lines.push(`Website: ${card.website}`)
  if (card.address) lines.push(`Address: ${card.address}`)
  return lines.join('\n') || 'Created from business card scan.'
}

export async function createAgentFromCard(card: ExtractedCard): Promise<string> {
  const newId = await createAgent({
    name: card.company ?? card.person_name ?? 'New agent',
    country: card.country,
    status: 'prospect',
    notes: buildNote(card),
    network_codes: [],
  })

  if (card.person_name) {
    await addAgentContact(newId, {
      name: card.person_name,
      role: card.title,
      email: card.email,
      phone: card.mobile ?? card.phone,
    })
  }

  return newId
}
