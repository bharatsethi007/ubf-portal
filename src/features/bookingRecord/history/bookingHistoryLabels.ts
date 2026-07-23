/** Friendly labels aligned with BookingDetailsSections. */
export const BOOKING_FIELD_LABELS: Record<string, string> = {
  account_id: 'Client',
  consignee_account_id: 'Consignee',
  importer_account_id: 'Importer',
  booking_ref: 'Booking ref',
  job_no: 'Job #',
  mode: 'Mode',
  hold_reason: 'Hold notes',
  hold_code: 'Hold',
  handled_by: 'Handled by',
  m_eta: 'ETA',
  m_atf: 'ATF',
  m_shipping_line: 'Shipping line',
  m_discharge_port: 'Discharge port',
  swb_released: 'SWB released',
  tlx_release_on_hand: 'TLX release on hand',
  doc_handover_at: 'Doc handover',
  bacc_sent: 'BACC sent',
  cleared: 'UBF cleared',
  truck_booked: 'Truck booked',
  last_free_day: 'Last free day',
  discharge_date: 'Discharge date',
  delivery_date: 'Delivery date',
  container_return_date: 'Container return',
  shipment_id: 'Shipment match',
}

export const BOOLEAN_BOOKING_FIELDS = new Set([
  'swb_released',
  'tlx_release_on_hand',
  'bacc_sent',
  'cleared',
  'truck_booked',
])

export const DATE_BOOKING_FIELDS = new Set([
  'm_eta',
  'm_atf',
  'doc_handover_at',
  'last_free_day',
  'discharge_date',
  'delivery_date',
  'container_return_date',
  'erp_ref_confirmed_at',
])

export function bookingFieldLabel(field: string | null): string {
  if (!field) return 'Field'
  return BOOKING_FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/\bm\b/g, 'M')
}
