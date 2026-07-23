import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import type {
  BookingStatePatch,
  ContainerStatePatch,
  ParsedWebhookEvent,
  TrackingSettingsPatch,
} from "./types.ts"

export async function insertTrackingEvent(
  db: SupabaseClient,
  bookingId: string,
  event: ParsedWebhookEvent,
): Promise<"inserted" | "duplicate" | "error"> {
  const row = {
    subscription_event_id: event.subscriptionEventId,
    subscription_id: event.subscriptionId,
    subscription_container_id: event.subscriptionContainerId,
    booking_id: bookingId,
    container_no: event.containerNo,
    container_visit_id: event.containerVisitId,
    container_visit_uri: event.containerVisitUri,
    partner_port_code: event.partnerPortCode,
    container_visit_type_code: event.containerVisitTypeCode,
    event_type_code: event.eventTypeCode,
    event_datetime: event.eventDatetime,
    event_location: event.eventLocation,
    event_value: event.eventValue,
    event_value2: event.eventValue2,
    container_iso_type: event.containerIsoType,
    container_status: event.containerStatus,
    inbound_vessel_ref: event.inboundVesselRef,
    inbound_vessel_name: event.inboundVesselName,
    inbound_vessel_imo: event.inboundVesselImo,
    outbound_vessel_ref: event.outboundVesselRef,
    outbound_vessel_name: event.outboundVesselName,
    booking_reference: event.bookingReference,
    operator_scac: event.operatorScac,
    source: "portconnect",
    raw: event.raw,
  }

  const { error } = await db.from("tracking_events").insert(row)
  if (!error) return "inserted"
  if (error.code === "23505") return "duplicate"
  throw new Error(error.message)
}

export async function flushContainerState(
  db: SupabaseClient,
  bookingId: string,
  containerNo: string,
  patch: ContainerStatePatch,
): Promise<void> {
  if (!Object.keys(patch).length) return
  const { error } = await db.from("container_tracking").upsert(
    {
      booking_id: bookingId,
      container_no: containerNo,
      ...patch,
    },
    { onConflict: "booking_id,container_no" },
  )
  if (error) throw new Error(error.message)
}

export async function flushBookingState(
  db: SupabaseClient,
  bookingId: string,
  patch: BookingStatePatch,
): Promise<void> {
  if (!Object.keys(patch).length) return
  const { error } = await db.from("bookings").update(patch).eq("id", bookingId)
  if (error) throw new Error(error.message)
}

export async function flushTrackingSettings(
  db: SupabaseClient,
  bookingId: string,
  patch: TrackingSettingsPatch,
): Promise<void> {
  if (!Object.keys(patch).length) return
  const { error } = await db.from("booking_tracking").upsert(
    { booking_id: bookingId, ...patch },
    { onConflict: "booking_id" },
  )
  if (error) throw new Error(error.message)
}

export async function logWebhook(
  db: SupabaseClient,
  opts: {
    payload: unknown
    eventCount: number
    tokenValid: boolean
    httpStatus: number
    error: string | null
  },
): Promise<void> {
  await db.from("portconnect_webhook_log").insert({
    payload: opts.payload,
    event_count: opts.eventCount,
    token_valid: opts.tokenValid,
    http_status: opts.httpStatus,
    error: opts.error,
  })
}

export function getContainerPatch(
  map: Map<string, ContainerStatePatch>,
  bookingId: string,
  containerNo: string,
): ContainerStatePatch {
  const key = bucketKey(bookingId, containerNo)
  let hit = map.get(key)
  if (!hit) {
    hit = {}
    map.set(key, hit)
  }
  return hit
}

export function bucketKey(bookingId: string, containerNo: string): string {
  return `${bookingId}:${containerNo}`
}

export async function flushAllState(
  db: SupabaseClient,
  containerBuckets: Map<string, ContainerStatePatch>,
  bookingPatches: Map<string, BookingStatePatch>,
  settingsPatches: Map<string, TrackingSettingsPatch>,
): Promise<void> {
  for (const [key, patch] of containerBuckets) {
    const [bookingId, containerNo] = key.split(":")
    await flushContainerState(db, bookingId, containerNo, patch)
  }
  for (const [bookingId, patch] of bookingPatches) {
    await flushBookingState(db, bookingId, patch)
  }
  for (const [bookingId, patch] of settingsPatches) {
    await flushTrackingSettings(db, bookingId, patch)
  }
}
