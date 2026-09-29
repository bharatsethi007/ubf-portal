import { supabase } from '@/supabase'

export type ReviewAction = 'confirm' | 'decline'

export async function reviewPortalBooking(bookingId: string, action: ReviewAction, reason?: string): Promise<{ status: string; reason: string | null }> {
  const { data, error } = await supabase.rpc('staff_review_portal_booking', {
    p_booking: bookingId,
    p_action: action,
    p_reason: reason ?? null,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { new_status: string; reason: string | null } | undefined
  return { status: row?.new_status ?? (action === 'confirm' ? 'confirmed' : 'rejected'), reason: row?.reason ?? null }
}

export type SentNotice = { event: string; recipient: string | null; sent_at: string }

export async function fetchSentNotices(bookingId: string): Promise<SentNotice[]> {
  const { data } = await supabase
    .from('portal_booking_notifications')
    .select('event, recipient, sent_at')
    .eq('booking_id', bookingId)
    .order('sent_at')
  return (data ?? []) as SentNotice[]
}

export const DECLINE_REASONS = [
  'No space on the requested sailing',
  'Rates have changed, we will send a new quote',
  'We cannot carry this cargo type',
  'Duplicate of an existing booking',
]

export const NOTICE_LABEL: Record<string, string> = {
  new_request: 'Team alerted',
  confirmed: 'Customer told: confirmed',
  declined: 'Customer told: declined',
  in_erp: 'Customer told: shipment live',
}

/** Where the request is, from the team's point of view. */
export function reviewState(status: string | null, linked: boolean): 'review' | 'confirmed' | 'declined' | 'in_erp' {
  if (linked || status === 'entered' || status === 'synced') return 'in_erp'
  if (status === 'rejected') return 'declined'
  if (status === 'confirmed' || status === 'sli_requested' || status === 'sli_received' || status === 'xml_ready') return 'confirmed'
  return 'review'
}
