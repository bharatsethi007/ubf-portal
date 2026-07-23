import { supabase } from '@/supabase'
import type {
  BookingTrackingEvent,
  BookingTrackingPatch,
  BookingTrackingSettings,
  ContainerTrackingRow,
} from './trackingTypes'
import { CONTAINER_SELECT } from './containerTrackingSelect'

const SETTINGS_SELECT = `
  booking_id, portconnect_enabled, carrier_enabled, carrier_scac,
  last_portconnect_sync, last_carrier_sync, portconnect_error, carrier_error
`

const EVENT_SELECT = `
  id, subscription_event_id, subscription_id, subscription_container_id,
  booking_id, container_no, container_visit_id, container_visit_uri,
  partner_port_code, container_visit_type_code, event_type_code, event_datetime,
  event_location, event_value, event_value2, container_iso_type, container_status,
  inbound_vessel_ref, inbound_vessel_name, inbound_vessel_imo,
  outbound_vessel_ref, outbound_vessel_name, booking_reference, operator_scac,
  source, received_at, is_estimated
`

export function defaultTrackingSettings(bookingId: string): BookingTrackingSettings {
  return {
    booking_id: bookingId,
    portconnect_enabled: false,
    carrier_enabled: false,
    carrier_scac: null,
    last_portconnect_sync: null,
    last_carrier_sync: null,
    portconnect_error: null,
    carrier_error: null,
  }
}

export async function fetchBookingTrackingSettings(
  bookingId: string,
): Promise<BookingTrackingSettings> {
  const { data, error } = await supabase
    .from('booking_tracking')
    .select(SETTINGS_SELECT)
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  if (!data) return defaultTrackingSettings(bookingId)
  return data as BookingTrackingSettings
}

export async function upsertBookingTrackingSettings(
  bookingId: string,
  patch: BookingTrackingPatch,
): Promise<BookingTrackingSettings> {
  const { data, error } = await supabase
    .from('booking_tracking')
    .upsert({ booking_id: bookingId, ...patch }, { onConflict: 'booking_id' })
    .select(SETTINGS_SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to save tracking settings')
  return data as BookingTrackingSettings
}

export async function fetchContainerTrackingRows(
  bookingId: string,
): Promise<ContainerTrackingRow[]> {
  const { data, error } = await supabase
    .from('container_tracking')
    .select(CONTAINER_SELECT)
    .eq('booking_id', bookingId)
    .order('container_no')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...(row as ContainerTrackingRow),
    raw: (row as { raw?: Record<string, unknown> | null }).raw ?? null,
  }))
}

export async function fetchBookingTrackingEvents(
  bookingId: string,
): Promise<BookingTrackingEvent[]> {
  const { data, error } = await supabase
    .from('tracking_events')
    .select(EVENT_SELECT)
    .eq('booking_id', bookingId)
    .order('event_datetime', { ascending: false })
  if (error) throw error
  return (data ?? []) as BookingTrackingEvent[]
}

export async function fetchLastPortConnectRefresh(
  bookingId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('portconnect_sync_log')
    .select('ran_at')
    .eq('booking_id', bookingId)
    .eq('status', 'ok')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.ran_at as string | undefined) ?? null
}
