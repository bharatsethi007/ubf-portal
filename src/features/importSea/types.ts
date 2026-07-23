export type ImportSeaContainer = {
  container_no: string | null
  container_type: string | null
  iso_type?: string | null
  iso_desc?: string | null
  source?: string | null
  conflict_status?: string | null
  erp_container_type?: string | null
  resolved_at?: string | null
  hazard_count?: number | null
  hazards?: unknown
}

export type ImportSeaRow = {
  id: string
  booking_ref: string | null
  job_no: string | null
  customer_id: string | null
  customer_name: string | null
  eta: string | null
  atf: string | null
  shipping_line: string | null
  discharge_port: string | null
  swb_released: boolean | null
  tlx_release_on_hand: boolean | null
  doc_handover_at: string | null
  bacc_sent: boolean | null
  cleared: boolean | null
  truck_booked: boolean | null
  port_cleared: boolean | null
  line_released: boolean | null
  port_clearance_cancelled: boolean | null
  line_release_cancelled: boolean | null
  last_free_day: string | null
  discharge_date: string | null
  delivery_date: string | null
  container_return_date: string | null
  hold_reason: string | null
  hold_code: string | null
  hold_label: string | null
  handled_by: string | null
  handler_name: string | null
  handler_initials: string | null
  discharge_comment: string | null
  containers: ImportSeaContainer[] | null
  matched: boolean
  erp_ref_confirmed_at: string | null
}

/** Columns written back to `bookings` on inline edit. */
export type ImportSeaBookingPatch = {
  swb_released?: boolean
  tlx_release_on_hand?: boolean
  doc_handover_at?: string | null
  m_eta?: string | null
  m_atf?: string | null
  m_shipping_line?: string | null
  m_discharge_port?: string | null
  bacc_sent?: boolean
  cleared?: boolean
  truck_booked?: boolean
  last_free_day?: string | null
  discharge_date?: string | null
  delivery_date?: string | null
  container_return_date?: string | null
  hold_reason?: string | null
}
