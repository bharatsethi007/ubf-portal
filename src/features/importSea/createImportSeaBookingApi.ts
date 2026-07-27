import { supabase } from '@/supabase'
import { upsertBookingContainer } from '@/features/bookingRecord/containers/bookingContainersApi'

export type CreateImportSeaBookingInput = {
  account_id: string
  consignee_account_id: string | null
  importer_account_id: string | null
  job_no: string | null
  m_eta: string | null
  handled_by: string | null
  created_by: string | null
  containers: Array<{
    container_no: string
    container_type?: string | null
    seal_no?: string | null
  }>
}

export type CreatedImportSeaBooking = {
  id: string
  booking_ref: string
}

export async function createImportSeaBooking(
  input: CreateImportSeaBookingInput,
): Promise<CreatedImportSeaBooking> {
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      module: 'IS',
      mode: 'sea_import',
      source: 'manual',
      status: 'new',
      account_id: input.account_id,
      consignee_account_id: input.consignee_account_id,
      importer_account_id: input.importer_account_id,
      job_no: input.job_no,
      m_eta: input.m_eta,
      handled_by: input.handled_by,
      created_by: input.created_by,
      is_consolidation: false,
      is_dg: false,
      is_temp_controlled: false,
      is_valuable: false,
      is_oog: false,
    })
    .select('id, booking_ref')
    .single()

  if (bookingErr || !booking) {
    throw new Error(bookingErr?.message ?? 'Failed to create booking')
  }

  const bookingId = booking.id as string

  for (const [index, container] of input.containers.entries()) {
    await upsertBookingContainer(bookingId, {
      container_no: container.container_no,
      container_type: container.container_type ?? null,
      seal_no: container.seal_no ?? null,
      sort_order: index,
    })
  }

  return {
    id: bookingId,
    booking_ref: String(booking.booking_ref),
  }
}
