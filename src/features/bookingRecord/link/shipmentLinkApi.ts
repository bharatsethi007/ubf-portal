import { supabase } from '../../../supabase'

export type LinkContainer = { container_no: string; container_size: string | null }
export type LinkShipment = {
  job_unique: number
  job_no: number | null
  consol_key: string | null
  consignee_name: string | null
  customer_account_id: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  eta: string | null
  master_bill: string | null
  status: string | null
  containers: LinkContainer[]
  invoice_count: number
  invoice_total: number | null
  already_linked: boolean
}

export async function findConsigneeShipments(accountId: string | null, consigneeName: string | null): Promise<LinkShipment[]> {
  if (!accountId && !consigneeName) return []
  const { data, error } = await supabase.rpc('find_consignee_shipments', {
    p_account_id: accountId,
    p_consignee_name: consigneeName,
    p_limit: 25,
  })
  if (error) throw error
  return (data ?? []) as LinkShipment[]
}

export async function linkBookingToShipment(bookingId: string, jobUnique: number, consolKey: string | null): Promise<void> {
  const { error } = await supabase.from('bookings')
    .update({ shipment_id: jobUnique, job_no: consolKey, erp_ref_confirmed_at: new Date().toISOString() })
    .eq('id', bookingId)
  if (error) throw error
}

export async function unlinkBookingShipment(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ shipment_id: null, erp_ref_confirmed_at: null })
    .eq('id', bookingId)
  if (error) throw error
}
