import { supabase } from '@/supabase'

export type Recipient = { id: string; email: string; active: boolean }

export async function listRecipients(): Promise<Recipient[]> {
  const { data, error } = await supabase.from('tms_notification_recipients').select('id,email,active').order('email')
  if (error) throw error
  return (data ?? []) as Recipient[]
}

export async function addRecipient(email: string): Promise<void> {
  const { error } = await supabase.from('tms_notification_recipients').insert({ email: email.trim().toLowerCase() })
  if (error) throw error
}

export async function removeRecipient(id: string): Promise<void> {
  const { error } = await supabase.from('tms_notification_recipients').delete().eq('id', id)
  if (error) throw error
}

export async function setRecipientActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('tms_notification_recipients').update({ active }).eq('id', id)
  if (error) throw error
}
