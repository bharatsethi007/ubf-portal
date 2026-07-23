import { supabase } from '@/supabase'
import { withContainerOverride, withoutContainerOverride } from '../bookingFieldOverrides'
import type {
  BookingContainerRow,
  BookingContainerUpsert,
  ContainerConflictResolution,
} from './bookingContainerTypes'

async function currentActor(): Promise<{ id: string | null; email: string | null }> {
  const { data } = await supabase.auth.getUser()
  return { id: data.user?.id ?? null, email: data.user?.email ?? null }
}

async function logConflictResolution(
  bookingId: string,
  containerNo: string,
  conflictStatus: string,
  resolution: ContainerConflictResolution,
  actor: { id: string | null; email: string | null },
): Promise<void> {
  const { error } = await supabase.from('booking_history').insert({
    booking_id: bookingId,
    field: `container:${containerNo}`,
    old_value: conflictStatus,
    new_value: resolution,
    action: 'container_conflict_resolved',
    actor_id: actor.id,
    actor_name: actor.email,
  })
  if (error) throw error
}

const SELECT = `
  id, booking_id, container_no, container_type, iso_type_code,
  seal_no, source, sort_order, created_at, created_by,
  conflict_status, erp_container_no, erp_container_type,
  conflict_detected_at, resolved_at, resolved_by, resolution
`

const TRACKING_SELECT = `
  container_no, hazard_count, hazards, iso_type, iso_desc, container_type
`

function mergeTracking(
  rows: BookingContainerRow[],
  tracking: Array<Record<string, unknown>>,
): BookingContainerRow[] {
  const byNo = new Map(
    tracking.map((t) => [String(t.container_no ?? '').trim().toUpperCase(), t]),
  )
  return rows.map((row) => {
    const t = byNo.get(row.container_no.trim().toUpperCase())
    if (!t) return row
    return {
      ...row,
      hazard_count: (t.hazard_count as number | null) ?? 0,
      hazards: t.hazards,
      iso_type: (t.iso_type as string | null) ?? null,
      iso_desc: (t.iso_desc as string | null) ?? null,
      tracking_container_type: (t.container_type as string | null) ?? null,
    }
  })
}

export async function revertContainerToPortConnect(
  bookingId: string,
  containerId: string,
  containerNo: string,
  currentOverrides: Record<string, boolean> | null | undefined,
): Promise<{ row: BookingContainerRow; field_overrides: Record<string, boolean> }> {
  const field_overrides = withoutContainerOverride(containerNo, currentOverrides)

  const { error: bookingErr } = await supabase
    .from('bookings')
    .update({ field_overrides })
    .eq('id', bookingId)
  if (bookingErr) throw bookingErr

  const { data, error } = await supabase
    .from('booking_containers')
    .update({ source: 'portconnect' })
    .eq('id', containerId)
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Container not found')

  return { row: data as BookingContainerRow, field_overrides }
}

export async function overrideContainerToManual(
  bookingId: string,
  containerId: string,
  containerNo: string,
  currentOverrides: Record<string, boolean> | null | undefined,
): Promise<{ row: BookingContainerRow; field_overrides: Record<string, boolean> }> {
  const field_overrides = withContainerOverride(containerNo, currentOverrides)

  const { error: bookingErr } = await supabase
    .from('bookings')
    .update({ field_overrides })
    .eq('id', bookingId)
  if (bookingErr) throw bookingErr

  const { data, error } = await supabase
    .from('booking_containers')
    .update({ source: 'manual' })
    .eq('id', containerId)
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Container not found')

  return { row: data as BookingContainerRow, field_overrides }
}

export async function fetchBookingContainers(bookingId: string): Promise<BookingContainerRow[]> {
  const [{ data, error }, { data: tracking, error: trackErr }] = await Promise.all([
    supabase
      .from('booking_containers')
      .select(SELECT)
      .eq('booking_id', bookingId)
      .order('sort_order')
      .order('container_no'),
    supabase
      .from('container_tracking')
      .select(TRACKING_SELECT)
      .eq('booking_id', bookingId),
  ])
  if (error) throw error
  if (trackErr) throw trackErr
  return mergeTracking((data ?? []) as BookingContainerRow[], tracking ?? [])
}

export async function upsertBookingContainer(
  bookingId: string,
  row: BookingContainerUpsert & { id?: string },
): Promise<BookingContainerRow> {
  const payload = {
    booking_id: bookingId,
    container_no: row.container_no,
    container_type: row.container_type ?? null,
    seal_no: row.seal_no ?? null,
    sort_order: row.sort_order ?? 0,
    source: 'manual' as const,
  }

  if (row.id) {
    const { data, error } = await supabase
      .from('booking_containers')
      .update({
        container_no: payload.container_no,
        container_type: payload.container_type,
        seal_no: payload.seal_no,
        sort_order: payload.sort_order,
      })
      .eq('id', row.id)
      .eq('source', 'manual')
      .select(SELECT)
      .single()
    if (error) throw error
    if (!data) throw new Error('Container not found or not editable')
    return data as BookingContainerRow
  }

  const { data, error } = await supabase
    .from('booking_containers')
    .insert(payload)
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to create container')
  return data as BookingContainerRow
}

export async function deleteBookingContainer(id: string): Promise<BookingContainerRow> {
  const { data, error } = await supabase
    .from('booking_containers')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Container not found or not removable')
  return data as BookingContainerRow
}

export async function resolveContainerConflict(
  bookingId: string,
  containerId: string,
  resolution: ContainerConflictResolution,
): Promise<BookingContainerRow> {
  const { data: existing, error: fetchError } = await supabase
    .from('booking_containers')
    .select(SELECT)
    .eq('id', containerId)
    .eq('booking_id', bookingId)
    .single()
  if (fetchError) throw fetchError
  if (!existing) throw new Error('Container not found')

  const row = existing as BookingContainerRow
  if (row.conflict_status === 'none' || row.resolved_at) {
    throw new Error('Container has no unresolved conflict')
  }

  const actor = await currentActor()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    conflict_status: 'none',
    resolution,
    resolved_at: now,
    resolved_by: actor.id,
  }

  if (resolution === 'kept_erp') {
    patch.container_type = row.erp_container_type ?? row.container_type
    patch.source = 'erp'
    patch.erp_container_no = null
    patch.erp_container_type = null
  }

  const { data, error } = await supabase
    .from('booking_containers')
    .update(patch)
    .eq('id', containerId)
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to resolve conflict')

  await logConflictResolution(
    bookingId,
    row.container_no,
    row.conflict_status,
    resolution,
    actor,
  )

  return data as BookingContainerRow
}

export function containerNumbers(rows: BookingContainerRow[]): string[] {
  return rows.map((r) => r.container_no.trim()).filter(Boolean)
}
