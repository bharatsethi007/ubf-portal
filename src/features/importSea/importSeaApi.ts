import { supabase } from '../../supabase'
import type { ImportSeaBookingPatch, ImportSeaRow } from './types'

export async function fetchImportSeaBoard(): Promise<ImportSeaRow[]> {
  const { data, error } = await supabase.rpc('get_import_sea_board')
  if (error) throw error
  return (data ?? []) as ImportSeaRow[]
}

export async function updateImportSeaBooking(
  id: string,
  patch: ImportSeaBookingPatch,
): Promise<void> {
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
  if (error) throw error
}
