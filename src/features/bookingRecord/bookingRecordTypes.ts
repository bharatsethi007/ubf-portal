import type { BookingDocument } from '@/types/bookingDocument'
import type { BookingContainerRow } from './containers/bookingContainerTypes'

export type StaffUser = {
  user_id: string
  email: string
  initials?: string | null
}

export type BookingRecord = {
  id: string
  booking_ref: string | null
  job_no: string | null
  account_id: string | null
  mode: string | null
  shipment_id: number | null
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
  hold_code: string | null
  hold_label: string | null
  handled_by: string | null
  erp_ref_confirmed_at: string | null
  field_overrides?: Record<string, boolean> | null
  consignee_account_id: string | null
  importer_account_id: string | null
  customer_name: string | null
  consignee_name: string | null
  importer_name: string | null
}

export type BookingShipment = {
  job_unique: number
  job_no: number | null
  eta: string | null
  etd: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  consol_key: string | null
}

export type BookingTask = {
  id: string
  booking_id: string
  title: string
  is_default: boolean
  sort_order: number
  status: 'open' | 'done' | 'na'
  assigned_to: string | null
  due_date: string | null
  completed_at: string | null
  completed_by: string | null
  assignee?: StaffUser | null
}

export type BookingHistoryRow = {
  id: number
  booking_id: string
  field: string | null
  old_value: string | null
  new_value: string | null
  action: string
  actor_id: string | null
  actor_name: string | null
  created_at: string
}

export type BookingRecordBundle = {
  booking: BookingRecord
  shipment: BookingShipment | null
  containers: BookingContainerRow[]
  documents: BookingDocument[]
  tasks: BookingTask[]
}

export type BookingRecordPatch = {
  account_id?: string | null
  consignee_account_id?: string | null
  importer_account_id?: string | null
  mode?: string | null
  job_no?: string | null
  hold_reason?: string | null
  hold_code?: string | null
  handled_by?: string | null
  m_eta?: string | null
  m_atf?: string | null
  m_shipping_line?: string | null
  m_discharge_port?: string | null
  swb_released?: boolean
  tlx_release_on_hand?: boolean
  doc_handover_at?: string | null
  bacc_sent?: boolean
  cleared?: boolean
  truck_booked?: boolean
  last_free_day?: string | null
  discharge_date?: string | null
  delivery_date?: string | null
  container_return_date?: string | null
  field_overrides?: Record<string, boolean>
}
