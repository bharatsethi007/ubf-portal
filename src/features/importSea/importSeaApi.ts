import { supabase } from '../../supabase'
import type { ImportSeaBookingPatch, ImportSeaRow } from './types'

type AutoStop = Pick<ImportSeaRow, 'pc_auto_stopped_at' | 'pc_auto_stop_reason' | 'carrier_auto_stopped_at' | 'carrier_auto_stop_reason'>

/** Auto-stop state lives on booking_tracking; only stopped bookings come back, so this stays small. */
async function fetchAutoStops(bookingId?: string): Promise<Map<string, AutoStop>> {
  let q = supabase
    .from('booking_tracking')
    .select('booking_id, pc_auto_stopped_at, pc_auto_stop_reason, carrier_auto_stopped_at, carrier_auto_stop_reason')
    .or('pc_auto_stopped_at.not.is.null,carrier_auto_stopped_at.not.is.null')
  if (bookingId) q = q.eq('booking_id', bookingId)
  const { data } = await q
  const out = new Map<string, AutoStop>()
  for (const r of (data ?? []) as (AutoStop & { booking_id: string })[]) {
    const { booking_id, ...rest } = r
    out.set(booking_id, rest)
  }
  return out
}

type GateOut = Pick<ImportSeaRow, 'gate_out_at' | 'gate_out_count'>

/** Latest gate-out per booking from PortConnect tracking. Small: only gated containers come back. */
async function fetchGateOuts(bookingId?: string): Promise<Map<string, GateOut>> {
  let q = supabase.from('container_tracking').select('booking_id, gate_out_at').not('gate_out_at', 'is', null)
  if (bookingId) q = q.eq('booking_id', bookingId)
  const { data } = await q
  const out = new Map<string, GateOut>()
  for (const r of (data ?? []) as { booking_id: string; gate_out_at: string }[]) {
    const cur = out.get(r.booking_id)
    out.set(r.booking_id, {
      gate_out_at: !cur?.gate_out_at || r.gate_out_at > cur.gate_out_at ? r.gate_out_at : cur.gate_out_at,
      gate_out_count: (cur?.gate_out_count ?? 0) + 1,
    })
  }
  return out
}

export async function fetchImportSeaBoard(includeArchived = false): Promise<ImportSeaRow[]> {
  const [{ data, error }, stops, gates] = await Promise.all([
    supabase.rpc('get_import_sea_board', { p_include_archived: includeArchived }),
    fetchAutoStops().catch(() => new Map<string, AutoStop>()),
    fetchGateOuts().catch(() => new Map<string, GateOut>()),
  ])
  if (error) throw error
  return ((data ?? []) as ImportSeaRow[]).map((r) => ({ ...normalizeImportSeaRow(r), ...stops.get(r.id), ...gates.get(r.id) }))
}

/** Staff restart of an auto-stopped refresh; the automation picks it up on its next run. */
export async function restartTrackingAutomation(bookingId: string, kind: 'portconnect' | 'carrier'): Promise<void> {
  const { error } = await supabase.rpc('import_sea_tracking_restart', { p_booking: bookingId, p_kind: kind })
  if (error) throw error
}

function normalizeImportSeaRow(row: ImportSeaRow): ImportSeaRow {
  return {
    ...row,
    containers: row.containers ?? [],
    inv_approved: row.inv_approved ?? false,
    inv_sent: row.inv_sent ?? false,
    port_cleared: row.port_cleared ?? false,
    line_released: row.line_released ?? false,
    port_clearance_cancelled: row.port_clearance_cancelled ?? false,
    line_release_cancelled: row.line_release_cancelled ?? false,
    portconnect_enabled: row.portconnect_enabled ?? false,
    archived_at: row.archived_at ?? null,
    archived_by: row.archived_by ?? null,
    m_atf: row.m_atf ?? null,
    ubf_devanner: row.ubf_devanner ?? null,
  }
}

export async function fetchImportSeaBoardRow(bookingId: string): Promise<ImportSeaRow | null> {
  const { data, error } = await supabase.rpc('get_import_sea_board_row', {
    p_booking_id: bookingId,
  })
  if (error) throw error
  const row = (data as ImportSeaRow[] | null)?.[0]
  if (!row) return null
  const [stops, gates] = await Promise.all([
    fetchAutoStops(bookingId).catch(() => new Map<string, AutoStop>()),
    fetchGateOuts(bookingId).catch(() => new Map<string, GateOut>()),
  ])
  return { ...normalizeImportSeaRow(row), ...stops.get(row.id), ...gates.get(row.id) }
}

export async function updateImportSeaBooking(
  id: string,
  patch: ImportSeaBookingPatch,
): Promise<void> {
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
  if (error) throw error
}

/** Archive or unarchive one or many bookings (reversible). */
export async function setBookingsArchived(ids: string[], archived: boolean): Promise<void> {
  if (ids.length === 0) return
  const { data: auth } = await supabase.auth.getUser()
  const patch = archived
    ? { archived_at: new Date().toISOString(), archived_by: auth.user?.id ?? null }
    : { archived_at: null, archived_by: null }
  const { error } = await supabase.from('bookings').update(patch).in('id', ids)
  if (error) throw error
}

/** Hard-delete a booking. DB restrictive policy blocks ERP-matched (shipment_id) jobs. */
export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw error
}
