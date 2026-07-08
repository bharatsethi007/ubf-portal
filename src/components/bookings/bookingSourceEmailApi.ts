import { supabase } from '../../supabase'

const BUCKET = 'booking-emails'

export type BookingSourceEmail = {
  id: string
  subject: string | null
  from_address: string | null
  forwarded_by: string | null
  received_at: string | null
  raw_body: string | null
  attachment_paths: string[] | null
}

export async function loadBookingSourceEmail(bookingId: string): Promise<BookingSourceEmail | null> {
  const { data, error } = await supabase
    .from('booking_source_emails')
    .select('id, subject, from_address, forwarded_by, received_at, raw_body, attachment_paths')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as BookingSourceEmail | null
}

export async function signedEmailAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to create attachment link')
  return data.signedUrl
}

export function attachmentFileName(storagePath: string): string {
  const parts = storagePath.split('/')
  return parts[parts.length - 1] || storagePath
}
