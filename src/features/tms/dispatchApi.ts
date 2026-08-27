import { supabase } from '@/supabase'

export type DispatchTab = 'assigned' | 'unassigned' | 'incomplete' | 'completed'
export const DISPATCH_TABS: { key: DispatchTab; label: string }[] = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'incomplete', label: 'Incomplete/Failed' },
  { key: 'completed', label: 'Completed' },
]

const ACTIVE_ASSIGNED = ['assigned', 'inTransit', 'atDepot', 'assignedLeg2', 'inTransitLeg2']

export type VehicleCap = { id: string; registration_number: string; payload_kg: number | null; cube_capacity_m3: number | null; has_tail_lift: boolean; is_reefer: boolean }
export type DriverRow = { id: string; first_name: string; last_name: string; current_registration: string | null; count: number; vehicle: VehicleCap | null }

export async function listDrivers(): Promise<DriverRow[]> {
  const { data: drivers, error } = await supabase.from('tms_drivers').select('id,first_name,last_name,current_registration').eq('active', true).order('first_name')
  if (error) throw error
  const { data: vehicles } = await supabase.from('tms_vehicles').select('id,registration_number,payload_kg,cube_capacity_m3,has_tail_lift,is_reefer').eq('active', true)
  const vmap = new Map<string, VehicleCap>()
  ;(vehicles ?? []).forEach((v: any) => vmap.set(v.registration_number, v))
  const { data: counts } = await supabase.from('tms_consignments').select('assigned_driver_leg1').in('status', ACTIVE_ASSIGNED).eq('archived', false)
  const cmap = new Map<string, number>()
  ;(counts ?? []).forEach((r: any) => { if (r.assigned_driver_leg1) cmap.set(r.assigned_driver_leg1, (cmap.get(r.assigned_driver_leg1) ?? 0) + 1) })
  return (drivers ?? []).map((d: any) => ({ ...d, count: cmap.get(d.id) ?? 0, vehicle: d.current_registration ? vmap.get(d.current_registration) ?? null : null }))
}

export type CardRow = {
  id: string; consignment_no: string | null; order_type: string; status: string; goods_type: string
  sender_company: string | null; sender_address: string | null
  receiver_company: string | null; receiver_address: string | null
  preferred_pickup_at: string | null; assigned_at: string | null; assigned_driver_leg1: string | null
  signature_required: boolean; photo_pod_required: boolean; tail_lift_required: boolean; temperature_control: boolean
  cargo: { units: number | null; weight_kg: number | null; total_cube_m3: number | null }[]
}

const CARD_SELECT =
  'id,consignment_no,order_type,status,goods_type,sender_company,sender_address,receiver_company,receiver_address,preferred_pickup_at,assigned_at,assigned_driver_leg1,signature_required,photo_pod_required,tail_lift_required,temperature_control,cargo:tms_consignment_cargo(units,weight_kg,total_cube_m3)'

function applyTab(q: any, tab: DispatchTab) {
  switch (tab) {
    case 'assigned': return q.in('status', ACTIVE_ASSIGNED).eq('archived', false)
    case 'unassigned': return q.eq('status', 'unassigned').eq('archived', false)
    case 'incomplete': return q.in('status', ['failed', 'inComplete'])
    case 'completed': return q.in('status', ['complete', 'checked_in']).eq('archived', false)
  }
}

export async function listDispatchConsignments(tab: DispatchTab): Promise<CardRow[]> {
  let q = supabase.from('tms_consignments').select(CARD_SELECT)
  q = applyTab(q, tab).order('preferred_pickup_at', { ascending: true, nullsFirst: false })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CardRow[]
}

export type Kpis = { unassigned: number; assigned: number; inTransit: number; complete: number; incomplete: number; total: number }
export async function boardKpis(): Promise<Kpis> {
  const { data, error } = await supabase.from('tms_consignments').select('status,archived')
  if (error) throw error
  const rows = (data ?? []) as { status: string; archived: boolean }[]
  const active = rows.filter((r) => !r.archived)
  const c = (f: (s: string) => boolean) => active.filter((r) => f(r.status)).length
  return {
    unassigned: c((s) => s === 'unassigned'),
    assigned: c((s) => ['assigned', 'assignedLeg2'].includes(s)),
    inTransit: c((s) => ['inTransit', 'inTransitLeg2', 'atDepot'].includes(s)),
    complete: c((s) => ['complete', 'checked_in'].includes(s)),
    incomplete: rows.filter((r) => ['failed', 'inComplete'].includes(r.status)).length,
    total: active.length,
  }
}

export function cardTotals(c: CardRow) {
  const pc = c.cargo.reduce((t, l) => t + (l.units ?? 0), 0)
  const kg = c.cargo.reduce((t, l) => t + (l.weight_kg ?? 0), 0)
  const cbm = c.cargo.reduce((t, l) => t + (l.total_cube_m3 ?? 0), 0)
  return { pc, kg, cbm: +cbm.toFixed(3) }
}

export async function assignConsignment(card: CardRow, driver: DriverRow) {
  const { error } = await supabase.from('tms_consignments').update({
    assigned_driver_leg1: driver.id, assigned_vehicle_id: driver.vehicle?.id ?? null,
    status: 'assigned', assigned_at: new Date().toISOString(),
  }).eq('id', card.id)
  if (error) throw error
  await supabase.from('tms_events').insert({
    consignment_id: card.id, event_code: 'TMS_ALLOCATED', to_status: 'assigned',
    note: `Assigned to ${driver.first_name} ${driver.last_name}${driver.vehicle ? ' / ' + driver.vehicle.registration_number : ''}`,
  })
}

export async function unassignConsignment(id: string) {
  const { error } = await supabase.from('tms_consignments').update({
    assigned_driver_leg1: null, assigned_vehicle_id: null, status: 'unassigned', assigned_at: null,
  }).eq('id', id)
  if (error) throw error
  await supabase.from('tms_events').insert({ consignment_id: id, event_code: 'TMS_UNASSIGNED', to_status: 'unassigned' })
}

// ---- Kanban ----
export const KANBAN_COLUMNS: { key: string; label: string; status: string }[] = [
  { key: 'unassigned', label: 'Unassigned', status: 'unassigned' },
  { key: 'assigned', label: 'Assigned', status: 'assigned' },
  { key: 'inTransit', label: 'In Transit', status: 'inTransit' },
  { key: 'complete', label: 'Completed', status: 'complete' },
  { key: 'failed', label: 'Incomplete/Failed', status: 'failed' },
]

export function kanbanBucket(status: string): string {
  if (['assigned', 'assignedLeg2'].includes(status)) return 'assigned'
  if (['inTransit', 'inTransitLeg2', 'atDepot'].includes(status)) return 'inTransit'
  if (['complete', 'checked_in'].includes(status)) return 'complete'
  if (['failed', 'inComplete'].includes(status)) return 'failed'
  return 'unassigned'
}

export async function listKanbanConsignments(): Promise<CardRow[]> {
  const { data, error } = await supabase.from('tms_consignments').select(CARD_SELECT)
    .eq('archived', false).not('status', 'in', '("cancel","archived")')
    .order('preferred_pickup_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as CardRow[]
}

export async function setConsignmentStatus(id: string, status: string) {
  const patch: any = { status }
  if (status === 'unassigned') { patch.assigned_driver_leg1 = null; patch.assigned_vehicle_id = null; patch.assigned_at = null }
  const { error } = await supabase.from('tms_consignments').update(patch).eq('id', id)
  if (error) throw error
  await supabase.from('tms_events').insert({ consignment_id: id, event_code: 'TMS_STATUS', to_status: status })
}

export async function completeConsignment(id: string) {
  const { error } = await supabase.from('tms_consignments').update({
    status: 'complete', delivered_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  await supabase.from('tms_events').insert({
    consignment_id: id, event_code: 'TMS_STATUS', to_status: 'complete', note: 'Manually completed',
  })
}

export async function assignConsignmentToDriver(consignmentId: string, driver: DriverRow) {
  const { error } = await supabase.from('tms_consignments').update({
    assigned_driver_leg1: driver.id, assigned_vehicle_id: driver.vehicle?.id ?? null,
    status: 'assigned', assigned_at: new Date().toISOString(),
  }).eq('id', consignmentId)
  if (error) throw error
  await supabase.from('tms_events').insert({
    consignment_id: consignmentId, event_code: 'TMS_ALLOCATED', to_status: 'assigned',
    note: `Assigned to ${driver.first_name} ${driver.last_name}${driver.vehicle ? ' / ' + driver.vehicle.registration_number : ''}`,
  })
}
