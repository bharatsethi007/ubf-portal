import { supabase } from '../../supabase'
import type { BookingDocument } from '../../types/bookingDocument'
import type { Container } from '../../types/container'
import type { Invoice } from '../../types/invoice'

export type JobDetailBooking = {
  id: string
  booking_ref: string | null
  job_no: string | null
  account_id: string | null
  shipment_id: number | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  m_eta: string | null
  m_atf: string | null
  m_shipping_line: string | null
  m_discharge_port: string | null
  swb_released: boolean | null
  tlx_release_on_hand: boolean | null
  doc_handover_at: string | null
  bacc_sent: boolean | null
  cleared: boolean | null
  truck_booked: boolean | null
  last_free_day: string | null
  discharge_date: string | null
  delivery_date: string | null
  container_return_date: string | null
  hold_reason: string | null
  discharge_comment: string | null
  erp_internal_job_no: string | null
  erp_ref_confirmed_at: string | null
  status: string | null
}

export type JobDetailShipment = {
  job_unique: number
  job_no: number | null
  house_bill: string | null
  master_bill: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  status: string | null
  consol_key: string | null
  customer_ref: string | null
  load_type: string | null
}

export type TrackingEvent = {
  id: string | number
  event_at: string | null
  event_type: string | null
  description: string | null
  location: string | null
}

const BOOKING_SELECT = `
  id, booking_ref, job_no, account_id, shipment_id, origin, destination, vessel_flight,
  etd, eta, m_eta, m_atf, m_shipping_line, m_discharge_port,
  swb_released, tlx_release_on_hand, doc_handover_at, bacc_sent, cleared, truck_booked,
  last_free_day, discharge_date, delivery_date, container_return_date,
  hold_reason, discharge_comment, erp_internal_job_no, erp_ref_confirmed_at, status
`

const SHIPMENT_SELECT = `
  job_unique, job_no, house_bill, master_bill, origin, destination, vessel_flight,
  etd, eta, departed, arrived, status, consol_key, customer_ref, load_type
`

export async function fetchJobBooking(id: string): Promise<JobDetailBooking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as JobDetailBooking
}

export async function fetchJobShipment(jobUnique: number): Promise<JobDetailShipment | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select(SHIPMENT_SELECT)
    .eq('job_unique', jobUnique)
    .maybeSingle()
  if (error || !data) return null
  return data as JobDetailShipment
}

export async function fetchJobTracking(_jobUnique: number | null): Promise<TrackingEvent[]> {
  return []
}

export async function fetchJobContainers(consolKey: string | null): Promise<Container[]> {
  if (!consolKey) return []
  const { data, error } = await supabase
    .from('containers')
    .select('c_number, seal, container_size, avail_from, avail_to')
    .eq('consol_key', consolKey)
    .order('c_number')
  if (error || !data) return []
  return data as Container[]
}

export async function fetchJobDocuments(bookingId: string): Promise<BookingDocument[]> {
  const { data, error } = await supabase
    .from('booking_documents')
    .select('id, booking_id, file_name, storage_path, mime_type, size_bytes, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as BookingDocument[]
}

export async function fetchJobInvoices(jobUnique: number | null): Promise<Invoice[]> {
  if (jobUnique == null) return []
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_no, doctype, module, job_unique, doc_date, date_due, amt_local, balance, tax_amount, currency')
    .eq('job_unique', jobUnique)
    .order('doc_date', { ascending: false })
  if (error || !data) return []
  return data as Invoice[]
}
