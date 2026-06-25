import { supabase } from '../../supabase'
import type { BookingCargoLine } from '../../types/bookingCargoLine'

const CARGO_SELECT =
  'id, booking_id, ord, pieces, length_unit, length, width, height, cbm, weight_unit, weight, goods_desc'

export async function loadCargoLines(bookingId: string): Promise<BookingCargoLine[]> {
  const { data, error } = await supabase
    .from('booking_cargo_lines')
    .select(CARGO_SELECT)
    .eq('booking_id', bookingId)
    .order('ord', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BookingCargoLine[]
}

function insertRows(bookingId: string, lines: Partial<BookingCargoLine>[]) {
  return lines.map((line, index) => {
    const { id: _id, booking_id: _bid, ord: _ord, ...fields } = line
    return { ...fields, booking_id: bookingId, ord: index }
  })
}

export async function saveCargoLines(bookingId: string, lines: Partial<BookingCargoLine>[]): Promise<void> {
  const { error: deleteErr } = await supabase.from('booking_cargo_lines').delete().eq('booking_id', bookingId)
  if (deleteErr) throw new Error(deleteErr.message)
  if (!lines.length) return
  const { error: insertErr } = await supabase.from('booking_cargo_lines').insert(insertRows(bookingId, lines))
  if (insertErr) throw new Error(insertErr.message)
}
