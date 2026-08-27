import { supabase } from '@/supabase'

export type DriverActivity = {
  key: string
  at: string // ISO timestamp
  label: string
  kind: 'assigned' | 'unassigned' | 'pickup' | 'delivery' | 'status' | 'stop' | 'other'
  consignmentNo: string | null
  client: string | null // shipper for pickups, consignee for drop-offs
  durationMin?: number
  highlight?: boolean
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

// ---- Navman stop detection (from GPS breadcrumbs) ----
const STOP_RADIUS_M = 60     // fixes within this belong to the same stop
const STOP_MIN_MIN = 3       // ignore anything shorter (lights, crawl)
const MATCH_RADIUS_M = 150   // stop counts as "at" a job if within this of its coords
const HIGHLIGHT_MIN = 10     // dwell length that gets flagged

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const normReg = (s?: string | null) => (s ?? '').replace(/\s+/g, '').toUpperCase()

async function fetchDriverStopsToday(driverId: string): Promise<DriverActivity[]> {
  // resolve the driver's Navman vehicle by registration
  const { data: drv } = await supabase.from('tms_drivers').select('current_registration').eq('id', driverId).maybeSingle()
  const reg = normReg((drv as any)?.current_registration)
  if (!reg) return []
  const { data: vehicles } = await supabase.from('dispatch_vehicles').select('tn_vehicle_id,registration')
  const vehicle = (vehicles ?? []).find((v: any) => normReg(v.registration) === reg) as any
  if (!vehicle) return []

  // recent breadcrumbs (Navman emits while moving, so a stop shows as a gap / tight cluster)
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const { data: posDesc } = await supabase
    .from('dispatch_vehicle_positions')
    .select('latitude,longitude,position_timestamp,location')
    .eq('tn_vehicle_id', vehicle.tn_vehicle_id)
    .gte('position_timestamp', since)
    .order('position_timestamp', { ascending: false })
    .limit(1500)
  const fixes = ((posDesc ?? []) as any[])
    .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude), t: new Date(p.position_timestamp).getTime(), location: p.location as string | null }))
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng) && Number.isFinite(f.t))
    .sort((a, b) => a.t - b.t)
  if (fixes.length < 2) return []

  // consignment endpoints to match a stop against a pickup / drop-off
  const { data: cons } = await supabase
    .from('tms_consignments')
    .select('consignment_no,sender_company,sender_lat,sender_lng,receiver_company,receiver_lat,receiver_lng')
    .eq('assigned_driver_leg1', driverId).eq('archived', false)
  const ends: Array<{ lat: number; lng: number; type: 'pickup' | 'delivery'; company: string | null; no: string | null }> = []
  for (const c of (cons ?? []) as any[]) {
    if (c.sender_lat != null && c.sender_lng != null) ends.push({ lat: Number(c.sender_lat), lng: Number(c.sender_lng), type: 'pickup', company: c.sender_company, no: c.consignment_no })
    if (c.receiver_lat != null && c.receiver_lng != null) ends.push({ lat: Number(c.receiver_lat), lng: Number(c.receiver_lng), type: 'delivery', company: c.receiver_company, no: c.consignment_no })
  }

  const out: DriverActivity[] = []
  let i = 0
  while (i < fixes.length) {
    let j = i
    while (j + 1 < fixes.length && metersBetween(fixes[i].lat, fixes[i].lng, fixes[j + 1].lat, fixes[j + 1].lng) <= STOP_RADIUS_M) j++
    const start = fixes[i].t
    // depart = next moving fix, or "now" for an ongoing stop (parked trucks emit nothing)
    const depart = j + 1 < fixes.length ? fixes[j + 1].t : Date.now()
    const durMin = Math.round((depart - start) / 60000)
    if (durMin >= STOP_MIN_MIN) {
      let best: { type: 'pickup' | 'delivery'; company: string | null; no: string | null; d: number } | null = null
      for (const e of ends) {
        const d = metersBetween(fixes[i].lat, fixes[i].lng, e.lat, e.lng)
        if (d <= MATCH_RADIUS_M && (!best || d < best.d)) best = { type: e.type, company: e.company, no: e.no, d }
      }
      const loc = fixes[j].location ?? fixes[i].location
      out.push({
        key: `stop-${start}`,
        at: new Date(start).toISOString(),
        kind: 'stop',
        label: `Stopped ${durMin} min`,
        consignmentNo: best?.no ?? null,
        client: best ? `${best.type === 'pickup' ? 'Pickup' : 'Delivery'} · ${best.company ?? ''}` : (loc ?? null),
        durationMin: durMin,
        highlight: durMin >= HIGHLIGHT_MIN,
      })
    }
    i = j + 1
  }
  return out
}

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

  // 3) Navman GPS stops (non-fatal — never block the rest of the feed)
  try { out.push(...await fetchDriverStopsToday(driverId)) } catch { /* ignore */ }

  return out.filter((a) => isToday(a.at)).sort((a, b) => b.at.localeCompare(a.at))
}
