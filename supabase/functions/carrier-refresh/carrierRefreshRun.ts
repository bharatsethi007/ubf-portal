import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  fetchMaerskEventsByContainer,
  fetchMaerskToken,
  mapMaerskEvent,
  type MaerskCreds,
} from "./maerskClient.ts"

export type CarrierRefreshSummary = {
  ok: boolean
  containers_found: number
  events_written: number
  containers_not_recognised: string[]
  last_refreshed_at: string
  error?: string
}

async function setCarrierStatus(
  db: SupabaseClient,
  bookingId: string,
  patch: { last_carrier_sync?: string; carrier_error?: string | null },
): Promise<void> {
  await db
    .from("booking_tracking")
    .upsert({ booking_id: bookingId, ...patch }, { onConflict: "booking_id" })
}

/** True if a carrier event with this stable Maersk eventID already exists. */
async function carrierEventExistsById(
  db: SupabaseClient,
  bookingId: string,
  carrierEventId: string,
): Promise<boolean> {
  const { data } = await db
    .from("tracking_events")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("carrier_event_id", carrierEventId)
    .eq("source", "carrier")
    .maybeSingle()
  return Boolean(data)
}

/** Fallback dedupe when an event has no eventID: match on the natural key. */
async function carrierEventExistsByComposite(
  db: SupabaseClient,
  bookingId: string,
  containerNo: string | null,
  eventTypeCode: string,
  eventDatetime: string,
): Promise<boolean> {
  let q = db
    .from("tracking_events")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type_code", eventTypeCode)
    .eq("event_datetime", eventDatetime)
    .eq("source", "carrier")
  q = containerNo ? q.eq("container_no", containerNo) : q.is("container_no", null)
  const { data } = await q.maybeSingle()
  return Boolean(data)
}

export async function refreshBookingCarrier(
  db: SupabaseClient,
  creds: MaerskCreds,
  bookingId: string,
): Promise<CarrierRefreshSummary> {
  const ranAt = new Date().toISOString()
  const empty = (error: string): CarrierRefreshSummary => ({
    ok: false,
    containers_found: 0,
    events_written: 0,
    containers_not_recognised: [],
    last_refreshed_at: ranAt,
    error,
  })

  const [{ data: settings }, { data: containers }] = await Promise.all([
    db
      .from("booking_tracking")
      .select("carrier_enabled, carrier_scac")
      .eq("booking_id", bookingId)
      .maybeSingle(),
    db
      .from("booking_containers")
      .select("container_no")
      .eq("booking_id", bookingId)
      .order("sort_order"),
  ])

  if (!settings?.carrier_enabled) {
    return empty("Shipping line tracking is not enabled for this booking")
  }
  const scac = (settings.carrier_scac ?? "").trim() || null
  if (!scac) return empty("Select a carrier SCAC before refreshing")

  const containerNos = [
    ...new Set(
      (containers ?? [])
        .map((c) => String(c.container_no ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
  if (!containerNos.length) return empty("No containers on this booking")

  let token: string
  try {
    token = await fetchMaerskToken(creds)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setCarrierStatus(db, bookingId, { carrier_error: msg })
    return empty(msg)
  }

  let containersFound = 0
  let eventsWritten = 0
  const notRecognised: string[] = []

  for (const containerNo of containerNos) {
    const result = await fetchMaerskEventsByContainer(creds, token, containerNo)

    // Hard failures: surface immediately and stop.
    if (result.status === 401 || result.status === 403) {
      const msg = result.message ?? `Maersk auth failed (${result.status})`
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return {
        ok: false,
        containers_found: containersFound,
        events_written: eventsWritten,
        containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt,
        error: msg,
      }
    }
    if (result.status === 429) {
      const msg = result.message ?? "Maersk rate limit exceeded (429)"
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return {
        ok: false,
        containers_found: containersFound,
        events_written: eventsWritten,
        containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt,
        error: msg,
      }
    }

    // Soft "no data" for this container: note and continue.
    if (result.status === 404 || result.events.length === 0) {
      notRecognised.push(containerNo)
      continue
    }

    if (result.status >= 400) {
      const msg = result.message ?? `Maersk error (${result.status})`
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return {
        ok: false,
        containers_found: containersFound,
        events_written: eventsWritten,
        containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt,
        error: msg,
      }
    }

    containersFound += 1

    for (const ev of result.events) {
      const row = mapMaerskEvent(bookingId, containerNo, scac, ev)
      if (!row) continue

      const dup = row.carrier_event_id
        ? await carrierEventExistsById(db, bookingId, row.carrier_event_id)
        : await carrierEventExistsByComposite(
          db,
          bookingId,
          row.container_no,
          row.event_type_code,
          row.event_datetime,
        )
      if (dup) continue

      const { error } = await db.from("tracking_events").insert(row)
      if (error) {
        // Safety-net unique index (booking_id, carrier_event_id) can raise on a
        // concurrent refresh race — treat duplicate as already-written, else throw.
        const m = String(error.message).toLowerCase()
        if (m.includes("duplicate") || m.includes("unique")) continue
        throw new Error(error.message)
      }
      eventsWritten += 1
    }
  }

  await setCarrierStatus(db, bookingId, {
    last_carrier_sync: ranAt,
    carrier_error:
      notRecognised.length && !containersFound
        ? `No Maersk events for: ${notRecognised.join(", ")}`
        : null,
  })

  return {
    ok: true,
    containers_found: containersFound,
    events_written: eventsWritten,
    containers_not_recognised: notRecognised,
    last_refreshed_at: ranAt,
  }
}
