import { supabase } from '@/supabase'

export type TmsBoardKey = 'current' | 'scheduled' | 'incomplete' | 'completed' | 'archived' | 'checkins'

export const TMS_BOARD_TABS: { key: TmsBoardKey; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'incomplete', label: 'Incomplete/Failed' },
  { key: 'completed', label: 'Recently Completed' },
  { key: 'archived', label: 'Archived' },
  { key: 'checkins', label: 'Check-Ins' },
]

const ACTIVE = ['unassigned', 'assigned', 'inTransit', 'atDepot', 'assignedLeg2', 'inTransitLeg2', 'onHold']

export type TmsConsignmentRow = {
  id: string
  consignment_no: string | null
  order_type: 'pick-up' | 'drop-off' | 'transfer'
  status: string
  goods_type: 'general' | 'dangerous'
  sender_company: string | null
  sender_address: string | null
  receiver_company: string | null
  receiver_address: string | null
  preferred_pickup_at: string | null
  estimated_delivery_at: string | null
  driver1: { first_name: string; last_name: string } | null
  booking_id: string | null
  job_unique: number | null
  shipment_ref: string | null
  booking: { booking_ref: string | null } | null
}

const ROW_SELECT =
  'id, consignment_no, order_type, status, goods_type, sender_company, sender_address, receiver_company, receiver_address, preferred_pickup_at, estimated_delivery_at, booking_id, job_unique, shipment_ref, driver1:tms_drivers!tms_consignments_assigned_driver_leg1_fkey(first_name,last_name), booking:bookings!tms_consignments_booking_id_fkey(booking_ref)'

function endOfTodayIso() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function applyBoard(q: any, board: TmsBoardKey) {
  const eot = endOfTodayIso()
  switch (board) {
    case 'current':
      return q.eq('archived', false).in('status', ACTIVE).or(`preferred_pickup_at.is.null,preferred_pickup_at.lte.${eot}`)
    case 'scheduled':
      return q.eq('archived', false).in('status', ACTIVE).gt('preferred_pickup_at', eot)
    case 'incomplete':
      return q.in('status', ['failed', 'inComplete'])
    case 'completed':
      return q.eq('archived', false).in('status', ['complete', 'checked_in'])
    case 'archived':
      return q.or('archived.eq.true,status.in.(archived,cancel)')
    case 'checkins':
      return q.eq('order_type', 'pick-up').eq('archived', false).not('status', 'in', '("complete","checked_in","failed","inComplete","cancel","archived")')
  }
}

export async function listConsignments(params: { board: TmsBoardKey; page: number; pageSize: number; search: string }) {
  const { board, page, pageSize, search } = params
  let q = supabase.from('tms_consignments').select(ROW_SELECT, { count: 'exact' })
  q = applyBoard(q, board)
  const s = search.trim()
  if (s) q = q.or(`consignment_no.ilike.%${s}%,sender_company.ilike.%${s}%,receiver_company.ilike.%${s}%,external_ref.ilike.%${s}%`)
  q = q.order('preferred_pickup_at', { ascending: true, nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1)
  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data ?? []) as TmsConsignmentRow[], total: count ?? 0 }
}

export async function boardCounts(): Promise<Record<TmsBoardKey, number>> {
  const entries = await Promise.all(
    TMS_BOARD_TABS.map(async ({ key }) => {
      let q = supabase.from('tms_consignments').select('id', { count: 'exact', head: true })
      q = applyBoard(q, key)
      const { count } = await q
      return [key, count ?? 0] as const
    }),
  )
  return Object.fromEntries(entries) as Record<TmsBoardKey, number>
}

export type TmsConsignmentDetail = TmsConsignmentRow & {
  source: string
  booking_id: string | null
  sender_contact: string | null; sender_phone: string | null; sender_email: string | null
  receiver_contact: string | null; receiver_phone: string | null; receiver_email: string | null
  delivery_instructions: string | null
  preferred_delivery_at: string | null
  po_number: string | null; supplier_name: string | null; reference: string | null
  special_instructions: { text?: string; importance?: string; createdAt?: string; byName?: string }[]
  signature_required: boolean; photo_pod_required: boolean; urgent: boolean; tail_lift_required: boolean
  customs_mpi: boolean; fragile: boolean; saturday_delivery: boolean; temperature_control: boolean
  dangerous_goods_reason: string | null
  cargo: { id: string; type: string; units: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null; weight_kg: number | null; total_cube_m3: number | null }[]
}

export async function fetchConsignment(id: string): Promise<TmsConsignmentDetail | null> {
  const { data, error } = await supabase
    .from('tms_consignments')
    .select('*, driver1:tms_drivers!tms_consignments_assigned_driver_leg1_fkey(first_name,last_name), cargo:tms_consignment_cargo(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as any) ?? null
}
