import { supabase } from '../../supabase'
import type { ImportSeaBookingPatch, ImportSeaRow } from './types'

export async function fetchImportSeaBoard(includeArchived = false): Promise<ImportSeaRow[]> {
  const { data, error } = await supabase.rpc('get_import_sea_board', {
    p_include_archived: includeArchived,
  })
  if (error) throw error
  return ((data ?? []) as ImportSeaRow[]).map(normalizeImportSeaRow)
}

function normalizeImportSeaRow(row: ImportSeaRow): ImportSeaRow {
  return {
    ...row,
    containers: row.containers ?? [],
    inv_approved: row.inv_approved ?? false,
    inv_sent: row.inv_sent ?? false,
    port_cleared: row.port_cleared ?? false,
    line_released: row.line_released ?? false,
    port_clearance_cancelled: row.port_clearance_cancelled ?? false,
    line_release_cancelled: row.line_release_cancelled ?? false,
    portconnect_enabled: row.portconnect_enabled ?? false,
    archived_at: row.archived_at ?? null,
    archived_by: row.archived_by ?? null,
    m_atf: row.m_atf ?? null,
    ubf_devanner: row.ubf_devanner ?? null,
  }
}

export async function fetchImportSeaBoardRow(bookingId: string): Promise<ImportSeaRow | null> {
  const { data, error } = await supabase.rpc('get_import_sea_board_row', {
    p_booking_id: bookingId,
  })
  if (error) throw error
  const row = (data as ImportSeaRow[] | null)?.[0]
  return row ? normalizeImportSeaRow(row) : null
}

export async function updateImportSeaBooking(
  id: string,
  patch: ImportSeaBookingPatch,
): Promise<void> {
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
  if (error) throw error
}

/** Archive or unarchive one or many bookings (reversible). */
export async function setBookingsArchived(ids: string[], archived: boolean): Promise<void> {
  if (ids.length === 0) return
  const { data: auth } = await supabase.auth.getUser()
  const patch = archived
    ? { archived_at: new Date().toISOString(), archived_by: auth.user?.id ?? null }
    : { archived_at: null, archived_by: null }
  const { error } = await supabase.from('bookings').update(patch).in('id', ids)
  if (error) throw error
}

/** Hard-delete a booking. DB restrictive policy blocks ERP-matched (shipment_id) jobs. */
export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw error
}
