import { supabase } from '@/supabase'

export type ShareLink = {
  id: string
  token: string
  created_at: string
  expires_at: string
  revoked_at: string | null
  last_viewed_at: string | null
  view_count: number
}

export const shareUrl = (token: string) => `${window.location.origin}/t/${token}`

export async function listShareLinks(bookingId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('booking_share_links')
    .select('id,token,created_at,expires_at,revoked_at,last_viewed_at,view_count')
    .eq('booking_id', bookingId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ShareLink[]
}

export async function createShareLink(bookingId: string, days = 90): Promise<ShareLink> {
  const { data, error } = await supabase.rpc('create_booking_share_link', { p_booking_id: bookingId, p_days: days })
  if (error) throw error
  return data as ShareLink
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase.from('booking_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
