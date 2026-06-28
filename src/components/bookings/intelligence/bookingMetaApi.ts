import { supabase } from '../../../supabase'
import type { BookingModule } from '../../../types/booking'
import type { BookingMeta } from './types'

export async function fetchBookingMeta(module: BookingModule | undefined): Promise<BookingMeta | null> {
  if (!module) return null

  try {
    const { data, error } = await supabase.rpc('get_booking_meta', { p_module: module })
    if (error || data == null || typeof data !== 'object') return null

    const row = data as Record<string, unknown>
    const mode_label = typeof row.mode_label === 'string' ? row.mode_label.trim() : ''
    const ops_mailbox = typeof row.ops_mailbox === 'string' ? row.ops_mailbox.trim() : ''
    if (!mode_label && !ops_mailbox) return null

    return {
      mode_label: mode_label || '-',
      ops_mailbox: ops_mailbox || '',
    }
  } catch {
    return null
  }
}
