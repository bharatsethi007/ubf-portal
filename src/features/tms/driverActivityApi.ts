import { supabase } from '@/supabase'

export type DriverActivity = {
  key: string
  at: string // ISO timestamp
  label: string
  kind: 'assigned' | 'unassigned' | 'pickup' | 'delivery' | 'status' | 'other'
  consignmentNo: string | null
  client: string | null // shipper for pickups, consignee for drop-offs
}

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned', unassigned: 'Unassigned', inTransit: 'In transit',
  atDepot: 'At depot', onHold: 'On hold', complete: 'Delivered', checked_in: 'Checked in',
  failed: 'Failed', inComplete: 'Incomplete', cancel: 'Cancelled', draft: 'Draft',
  archived: 'Archived', assignedLeg2: 'Assigned (leg 2)', inTransitLeg2: 'In transit (leg 2)',
}

// shipper (sender) for pickups, consignee (receiver) for drop-offs
function clientName(orderType: string | null, sender: string | null, receiver: string | null, kind: string): string | null {
  if (kind === 'pickup') return sender ?? receiver ?? null
  if (kind === 'delivery') return receiver ?? sender ?? null
  if (orderType === 'drop-off') return receiver ?? sender ?? null
  return sender ?? receiver ?? null
}

const nzDate = (input: number | string | Date) =>
  new Date(input).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
const isToday = (iso: string) => nzDate(iso) === nzDate(new Date())

export async function fetchDriverActivityToday(driverId: string): Promise<DriverActivity[]> {
  const out: DriverActivity[] = []

  // 1) event log (assignment + status changes), scoped to this driver's consignments
  const { data: events } = await supabase
    .from('tms_events')
    .select('id,event_code,to_status,note,created_at,tms_consignments!inner(consignment_no,order_type,sender_company,receiver_company,assigned_driver_leg1)')
    .eq('tms_consignments.assigned_driver_leg1', driverId)
    .order('created_at', { ascending: false })
    .limit(80)

  for (const e of (events ?? []) as any[]) {
    const c = e.tms_consignments
    if (!c) continue
    const status = e.to_status as string | null
    let kind: DriverActivity['kind'] = 'status'
    let label = status ? (STATUS_LABEL[status] ?? status) : 'Update'
    if (e.event_code === 'TMS_ALLOCATED') { kind = 'assigned'; label = 'Assigned' }
    else if (e.event_code === 'TMS_UNASSIGNED') { kind = 'unassigned'; label = 'Unassigned' }
    else if (status === 'complete' || status === 'checked_in') kind = 'delivery'
    out.push({
      key: `ev-${e.id}`, at: e.created_at, label, kind,
      consignmentNo: c.consignment_no ?? null,
      client: clientName(c.order_type, c.sender_company, c.receiver_company, kind),
    })
  }

  // 2) pickup / delivery timestamps recorded on the consignments themselves
  const { data: cons } = await supabase
    .from('tms_consignments')
    .select('id,consignment_no,order_type,sender_company,receiver_company,picked_up_at,delivered_at')
    .eq('assigned_driver_leg1', driverId).eq('archived', false)
    .or('picked_up_at.not.is.null,delivered_at.not.is.null')

  for (const c of (cons ?? []) as any[]) {
    if (c.picked_up_at) out.push({
      key: `pu-${c.id}`, at: c.picked_up_at, label: 'Picked up', kind: 'pickup',
      consignmentNo: c.consignment_no ?? null,
      client: clientName(c.order_type, c.sender_company, c.receiver_company, 'pickup'),
    })
    if (c.delivered_at) out.push({
      key: `dl-${c.id}`, at: c.delivered_at, label: 'Delivered', kind: 'delivery',
      consignmentNo: c.consignment_no ?? null,
      client: clientName(c.order_type, c.sender_company, c.receiver_company, 'delivery'),
    })
  }

  return out.filter((a) => isToday(a.at)).sort((a, b) => b.at.localeCompare(a.at))
}
