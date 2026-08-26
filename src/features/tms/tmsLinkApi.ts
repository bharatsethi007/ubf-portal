import { supabase } from '@/supabase'

export type BookingHit = { id: string; booking_ref: string | null; module: string | null; consignee_name: string | null }
export async function searchBookings(q: string): Promise<BookingHit[]> {
  const { data, error } = await supabase.rpc('tms_search_bookings', { q: q.trim() })
  if (error) throw error
  return (data ?? []) as BookingHit[]
}

export type ShipmentHit = { job_unique: number; house_bill: string | null; master_bill: string | null; consignee_name: string | null; module: string | null }
export async function searchShipments(q: string): Promise<ShipmentHit[]> {
  const { data, error } = await supabase.rpc('tms_search_shipments', { q: q.trim() })
  if (error) throw error
  return (data ?? []) as ShipmentHit[]
}

export async function setBookingLink(consignmentId: string, bookingId: string) {
  const { error } = await supabase.from('tms_consignments').update({ booking_id: bookingId }).eq('id', consignmentId)
  if (error) throw error
}
export async function clearBookingLink(consignmentId: string) {
  const { error } = await supabase.from('tms_consignments').update({ booking_id: null }).eq('id', consignmentId)
  if (error) throw error
}
export async function setShipmentLink(consignmentId: string, jobUnique: number, houseBill: string | null) {
  const { error } = await supabase.from('tms_consignments').update({ job_unique: jobUnique, shipment_ref: houseBill }).eq('id', consignmentId)
  if (error) throw error
}
export async function clearShipmentLink(consignmentId: string) {
  const { error } = await supabase.from('tms_consignments').update({ job_unique: null, shipment_ref: null }).eq('id', consignmentId)
  if (error) throw error
}
