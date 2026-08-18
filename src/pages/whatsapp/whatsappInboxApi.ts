import { supabase } from '../../supabase'

export type WhatsAppConversation = {
  contact_id: string
  wa_id: string
  account_name: string | null
  verified: boolean
  opted_in: boolean
  last_body: string | null
  last_direction: 'inbound' | 'outbound' | null
  last_at: string | null
  needs_action_count: number
  has_tracking: boolean
  has_booking: boolean
  has_quote: boolean
}

export type WhatsAppMessage = {
  id: string
  contact_id: string
  direction: 'inbound' | 'outbound'
  msg_type: string | null
  body: string | null
  media_path: string | null
  related_booking_id: string | null
  created_at: string
}

export async function listConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WhatsAppConversation[]
}

export async function listMessages(contactId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as WhatsAppMessage[]
}

export async function signedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('whatsapp-media').createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function sendReply(contactId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('whatsapp-reply', {
    body: { contact_id: contactId, text },
  })
  const payload = (data ?? {}) as { error?: string; message?: string }
  if (error) throw new Error(payload.message ?? payload.error ?? error.message)
  if (payload.error) throw new Error(payload.error)
}

export async function needsActionTotal(): Promise<number> {
  const rows = await listConversations()
  return rows.reduce((sum, c) => sum + (c.needs_action_count ?? 0), 0)
}
