export type EaUrgency = 'ok' | 'soon' | 'today' | 'overdue' | 'blocked'

/** One row of v_ea_bookings (deterministic stage + next action, computed in SQL). */
export type EaRow = {
  id: string
  booking_ref: string
  source: string
  status: string
  destination: string | null
  consignee_city: string | null
  consignee_name: string | null
  consignee_account_id: string | null
  consignee_code_name: string | null
  shipper_name: string | null
  shipper_account_id: string | null
  shipper_code_name: string | null
  bill_to_account_id: string | null
  bill_to_name: string | null
  pieces: number | null
  weight_kg: number | null
  chargeable_weight_kg: number | null
  volume_m3: number | null
  act_pcs: number | null
  act_kg: number | null
  act_cbm: number | null
  cargo_ready_date: string | null
  is_dg: boolean | null
  is_consolidation: boolean | null
  collection_mode: 'pickup' | 'dropoff' | null
  consol_id: string | null
  consol_flight: string | null
  consol_date: string | null
  consol_status: string | null
  quote_no: string | null
  tms_no: string | null
  thread_count: number
  owner_initials: string | null
  owner_name: string | null
  handled_by: string | null
  stage: number
  next_action: string
  action_due: string | null
  urgency: EaUrgency
  priority: number
  created_at: string
}

export type AirConsol = {
  id: string
  origin: string
  destination: string
  airline: string | null
  flight_no: string
  flight_date: string
  cutoff_at: string | null
  mawb: string | null
  status: 'planned' | 'confirmed' | 'closed' | 'exported' | 'departed' | 'cancelled'
  exported_at: string | null
  transit_port: string | null
  flight2_no: string | null
  flight2_date: string | null
  eta_date: string | null
  handled_by: string | null
  notes: string | null
  houses: number
  pieces: number
  kg: number
  chg_kg: number
}

export type EaView = 'open' | 'review' | 'pickup' | 'warehouse' | 'allocated' | 'departed'

export const EA_VIEWS: { id: EaView; label: string }[] = [
  { id: 'open', label: 'All open' },
  { id: 'review', label: 'Needs review' },
  { id: 'pickup', label: 'To pick up' },
  { id: 'warehouse', label: 'In warehouse' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'departed', label: 'Departed' },
]

export const STAGE_LABELS: Record<number, string> = {
  [-1]: 'Draft',
  0: 'Booked',
  1: 'Pickup booked',
  2: 'In warehouse',
  3: 'SLI in',
  4: 'Allocated',
  5: 'Exported',
  6: 'Departed',
}

export function viewOf(r: EaRow): EaView {
  if (r.stage < 0) return 'review'
  if (r.stage <= 1) return 'pickup'
  if (r.stage <= 3) return 'warehouse'
  if (r.stage <= 5) return 'allocated'
  return 'departed'
}

export const SOURCE_LABEL: Record<string, string> = {
  email_import: 'Email',
  email_parsed: 'Email',
  customer_portal: 'Portal',
  quote: 'Quote',
  manual: 'Manual',
}

/** Effective figures: warehouse actuals win over booked. */
export function cargoOf(r: EaRow) {
  const pcs = r.act_pcs ?? r.pieces
  const kg = r.act_kg ?? r.weight_kg
  const cbm = r.act_cbm ?? r.volume_m3
  const vol = cbm != null ? cbm * 167 : null
  const chg = r.chargeable_weight_kg ?? (kg != null || vol != null ? Math.ceil(Math.max(kg ?? 0, vol ?? 0)) : null)
  return { pcs, kg, cbm, chg }
}

export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : Number(n).toLocaleString('en-NZ', { maximumFractionDigits: d })

/** IATA AWB: 3-digit prefix + 7-digit serial + check digit (serial mod 7). */
export function awbOk(mawb: string | null | undefined) {
  const d = (mawb ?? '').replace(/\D/g, '')
  if (d.length !== 11) return false
  return Number(d.slice(3, 10)) % 7 === Number(d[10])
}

export const fmtAwb = (mawb: string | null | undefined) => {
  const d = (mawb ?? '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3)}` : (mawb ?? '')
}
