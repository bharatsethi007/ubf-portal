import { supabase } from '../../../../supabase'

export type PortalBookingStatus = 'requested' | 'confirmed' | 'in_erp' | 'declined'

export type PortalBooking = {
  id: string
  shipment_id: number | null
  booking_ref: string | null
  module: string | null
  mode: string | null
  load_type: 'FCL' | 'LCL' | null
  status: string | null
  source: string | null
  created_at: string
  origin: string | null
  destination: string | null
  etd: string | null
  eta: string | null
  vessel: string | null
  incoterm: string | null
  goods_description: string | null
  pieces: number | null
  packing_type: string | null
  weight_kg: number | null
  cbm: number | null
  container_type: string | null
  container_count: number | null
  cargo_ready_date: string | null
  is_dg: boolean | null
  special_instructions: string | null
  consignee_name: string | null
  portal_status: PortalBookingStatus
  customer_ref: string | null
}

const COLS = `id, shipment_id, booking_ref, module, mode, load_type, status, source, created_at, origin, destination,
  etd, eta, vessel, incoterm, goods_description, pieces, packing_type, weight_kg, cbm, container_type,
  container_count, cargo_ready_date, is_dg, special_instructions, consignee_name, portal_status, customer_ref`

export async function listPortalBookings(): Promise<PortalBooking[]> {
  const { data, error } = await supabase.from('portal_bookings').select(COLS).order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error('Could not load bookings')
  return (data ?? []) as PortalBooking[]
}

export type BookingRequest = {
  direction: 'import' | 'export'
  mode: 'sea' | 'air'
  load_type: 'FCL' | 'LCL' | ''
  origin: string
  destination: string
  incoterm: string
  cargo_ready_date: string
  goods_description: string
  pieces: string
  packing_type: string
  weight_kg: string
  cbm: string
  container_type: string
  container_count: string
  is_dg: boolean
  un_number: string
  dg_class: string
  is_temp_controlled: boolean
  temp_range: string
  shipper: string
  consignee: string
  consignee_address: string
  customer_ref: string
  notes: string
}

export async function requestBooking(req: BookingRequest): Promise<{ booking_id: string; booking_ref: string }> {
  const { data, error } = await supabase.rpc('portal_request_booking', { p: req })
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, '') || 'Could not submit booking')
  const row = Array.isArray(data) ? data[0] : data
  return row as { booking_id: string; booking_ref: string }
}

export const STATUS_LABEL: Record<PortalBookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_erp: 'Shipment created',
  declined: 'Declined',
}

export const STATUS_TONE: Record<PortalBookingStatus, 'grey' | 'blue' | 'green' | 'red'> = {
  requested: 'grey',
  confirmed: 'blue',
  in_erp: 'green',
  declined: 'red',
}

export function bookingModeLabel(b: Pick<PortalBooking, 'mode' | 'load_type'>): string {
  const [m, dir] = (b.mode ?? '').split('_')
  const base = m === 'air' ? 'Air' : 'Sea'
  const d = dir === 'import' ? 'import' : dir === 'export' ? 'export' : ''
  return [base, b.load_type, d].filter(Boolean).join(' · ')
}

export const CONTAINER_TYPES = ['20GP', '40GP', '40HQ', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR']
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
export const PACKING = ['Pallets', 'Cartons', 'Crates', 'Pieces', 'Drums', 'Bags', 'Rolls', 'Bundles']
