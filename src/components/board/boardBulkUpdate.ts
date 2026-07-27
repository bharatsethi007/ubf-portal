import { supabase } from '@/supabase'

export type BulkBookingUpdate = {
  id: string
  booking_ref?: string | null
  patch: Record<string, unknown>
}

export type BulkUpdateFailure = {
  id: string
  booking_ref: string | null
  error: string
}

export type BulkUpdateResult = {
  succeeded: string[]
  failed: BulkUpdateFailure[]
}

export async function bulkUpdateBookings(
  updates: BulkBookingUpdate[],
): Promise<BulkUpdateResult> {
  const succeeded: string[] = []
  const failed: BulkUpdateFailure[] = []

  for (const item of updates) {
    const { error } = await supabase.from('bookings').update(item.patch).eq('id', item.id)
    if (error) {
      failed.push({
        id: item.id,
        booking_ref: item.booking_ref ?? null,
        error: error.message,
      })
    } else {
      succeeded.push(item.id)
    }
  }

  return { succeeded, failed }
}
