import { supabase } from '../../supabase'
import type { ImportSeaBookingPatch, ImportSeaRow } from './types'

export async function fetchImportSeaBoard(): Promise<ImportSeaRow[]> {
  const { data, error } = await supabase.rpc('get_import_sea_board')
  if (error) throw error
  return ((data ?? []) as ImportSeaRow[]).map(normalizeImportSeaRow)
}

function normalizeImportSeaRow(row: ImportSeaRow): ImportSeaRow {
  return {
    ...row,
    containers: row.containers ?? [],
    port_cleared: row.port_cleared ?? false,
    line_released: row.line_released ?? false,
    port_clearance_cancelled: row.port_clearance_cancelled ?? false,
    line_release_cancelled: row.line_release_cancelled ?? false,
    portconnect_enabled: row.portconnect_enabled ?? false,
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
