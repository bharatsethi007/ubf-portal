import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import type { JsonRecord } from "./portconnectClient.ts"
import { fetchContainerVisitsImport } from "./portconnectClient.ts"
import {
  bookingPatchFromVisitFields,
  completePortConnectTask,
  containerPatchFromVisit,
  emptyVisitBookingFields,
  taskTriggersFromEvents,
  taskTriggersFromVisitTransition,
  visitBookingFieldsFromVisit,
} from "./portconnectBookingAutomation.ts"
import {
  mapVisitToContainerRow,
  timestampsFromStored,
  timestampsFromVisit,
} from "./portconnectVisitMap.ts"
import { mergeContainerTrackingRow } from "./portconnectVisitMerge.ts"

export type RefreshSummary = {
  ok: boolean
  containers_found: number
  fields_changed: number
  events_written: number
  containers_not_recognised: string[]
  last_refreshed_at: string
  error?: string
}

function pickImportVisit(visits: JsonRecord[]): JsonRecord | null {
  if (!visits.length) return null
  const imports = visits.filter((v) => {
    const cat = String(v.category ?? v.Category ?? "").toUpperCase()
    return !cat || cat === "IMPORT"
  })
  return imports[0] ?? visits[0]
}

function parseOverrides(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v) out[k] = true
  }
  return out
}

async function eventExists(
  db: SupabaseClient,
  bookingId: string,
  containerNo: string,
  event: DerivedRefreshEvent,
): Promise<boolean> {
  const { data } = await db
    .from("tracking_events")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("container_no", containerNo)
    .eq("event_type_code", event.event_type_code)
    .eq("event_datetime", event.event_datetime)
    .eq("source", "portconnect")
    .maybeSingle()
  return Boolean(data)
}

async function insertEvent(
  db: SupabaseClient,
  bookingId: string,
  containerNo: string,
  event: DerivedRefreshEvent,
  visit: JsonRecord,
): Promise<boolean> {
  if (await eventExists(db, bookingId, containerNo, event)) return false
  const { error } = await db.from("tracking_events").insert({
    booking_id: bookingId,
    container_no: containerNo,
    event_type_code: event.event_type_code,
    event_datetime: event.event_datetime,
    event_value: event.event_value,
    event_value2: event.event_value2,
    partner_port_code: event.partner_port_code,
    container_visit_id: event.container_visit_id,
    is_estimated: event.is_estimated,
    source: "portconnect",
    raw: visit,
  })
  if (error) throw new Error(error.message)
  return true
}

async function logSync(
  db: SupabaseClient,
  row: Record<string, unknown>,
): Promise<void> {
  await db.from("portconnect_sync_log").insert(row)
}

export async function refreshBookingPortConnect(
  db: SupabaseClient,
  apiKey: string,
  bookingId: string,
): Promise<RefreshSummary> {
  const ranAt = new Date().toISOString()
  let containersFound = 0
  let fieldsChanged = 0
  let eventsWritten = 0
  const notRecognised: string[] = []

  const [{ data: containers }, { data: booking }] = await Promise.all([
    db.from("booking_containers").select("container_no").eq("booking_id", bookingId).order("sort_order"),
    db.from("bookings").select("field_overrides, last_free_day").eq("id", bookingId).maybeSingle(),
  ])

  const containerNos = [...new Set(
    (containers ?? [])
      .map((c) => String(c.container_no ?? "").trim().toUpperCase())
      .filter(Boolean),
  )]

  if (!containerNos.length) {
    return {
      ok: false,
      containers_found: 0,
      fields_changed: 0,
      events_written: 0,
      containers_not_recognised: [],
      last_refreshed_at: ranAt,
      error: "No containers on this booking",
    }
  }

  const overrides = parseOverrides(booking?.field_overrides)
  const bookingPatch: Record<string, unknown> = {}
  const taskTriggersDone = new Set<string>()

  for (const containerNo of containerNos) {
    const fetchResult = await fetchContainerVisitsImport(apiKey, containerNo)

    if (fetchResult.status === 401) {
      const msg = fetchResult.message ?? "PortConnect API key rejected (401)"
      await logSync(db, {
        booking_id: bookingId, container_no: containerNo, status: "error",
        http_status: 401, error: msg, fields_changed: 0, events_written: 0, ran_at: ranAt,
      })
      return { ok: false, containers_found: containersFound, fields_changed: fieldsChanged,
        events_written: eventsWritten, containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt, error: msg }
    }
    if (fetchResult.status === 403) {
      const msg = fetchResult.message ?? "PortConnect access forbidden (403)"
      await logSync(db, {
        booking_id: bookingId, container_no: containerNo, status: "error",
        http_status: 403, error: msg, fields_changed: 0, events_written: 0, ran_at: ranAt,
      })
      return { ok: false, containers_found: containersFound, fields_changed: fieldsChanged,
        events_written: eventsWritten, containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt, error: msg }
    }
    if (fetchResult.status === 429) {
      const msg = fetchResult.message ?? "PortConnect rate limit exceeded (429)"
      await logSync(db, {
        booking_id: bookingId, container_no: containerNo, status: "error",
        http_status: 429, error: msg, fields_changed: 0, events_written: 0, ran_at: ranAt,
      })
      return { ok: false, containers_found: containersFound, fields_changed: fieldsChanged,
        events_written: eventsWritten, containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt, error: msg }
    }
    if (fetchResult.status === 404 || !fetchResult.data?.length) {
      notRecognised.push(containerNo)
      await logSync(db, {
        booking_id: bookingId, container_no: containerNo, status: "not_found",
        http_status: fetchResult.status, error: fetchResult.message ?? "Container not recognised",
        fields_changed: 0, events_written: 0, ran_at: ranAt,
      })
      continue
    }
    if (fetchResult.status !== 200) {
      const msg = fetchResult.message ?? `PortConnect error (${fetchResult.status})`
      await logSync(db, {
        booking_id: bookingId, container_no: containerNo, status: "error",
        http_status: fetchResult.status, error: msg, fields_changed: 0, events_written: 0, ran_at: ranAt,
      })
      return { ok: false, containers_found: containersFound, fields_changed: fieldsChanged,
        events_written: eventsWritten, containers_not_recognised: notRecognised,
        last_refreshed_at: ranAt, error: msg }
    }

    const visits = fetchResult.data as JsonRecord[]
    const visit = pickImportVisit(visits)
    if (!visit) {
      notRecognised.push(containerNo)
      continue
    }

    containersFound += 1

    const { data: existingRow } = await db
      .from("container_tracking")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("container_no", containerNo)
      .maybeSingle()

    const before = timestampsFromStored(existingRow as Record<string, unknown> | null)
    const after = timestampsFromVisit(visit)
    const changed = countChangedFields(before, after)
    fieldsChanged += changed

    const mapped = mapVisitToContainerRow(visit, bookingId, containerNo)
    const row = mergeContainerTrackingRow(
      mapped,
      existingRow as Record<string, unknown> | null,
    )
    const { error: upsertErr } = await db.from("container_tracking").upsert(row, {
      onConflict: "booking_id,container_no",
    })
    if (upsertErr) throw new Error(upsertErr.message)

    const events = deriveRefreshEvents(visit, before, after)
    let containerEvents = 0
    for (const ev of events) {
      const inserted = await insertEvent(db, bookingId, containerNo, ev, visit)
      if (inserted) {
        containerEvents += 1
        eventsWritten += 1
      }
    }

    const beforeFields = existingRow?.raw
      ? visitBookingFieldsFromVisit(existingRow.raw as JsonRecord)
      : emptyVisitBookingFields()
    const afterFields = visitBookingFieldsFromVisit(visit)
    const visitPatch = bookingPatchFromVisitFields(visit, afterFields, overrides)
    for (const [k, v] of Object.entries(visitPatch)) {
      bookingPatch[k] = v
    }

    const { data: bcRow } = await db
      .from("booking_containers")
      .select("id, source")
      .eq("booking_id", bookingId)
      .eq("container_no", containerNo)
      .maybeSingle()

    if (bcRow) {
      const cPatch = containerPatchFromVisit(
        visit,
        containerNo,
        overrides,
        bcRow.source as string | null,
      )
      if (cPatch) {
        const { error: bcErr } = await db
          .from("booking_containers")
          .update(cPatch)
          .eq("id", bcRow.id)
        if (bcErr) throw new Error(bcErr.message)
      }
    }

    const triggers = new Set([
      ...taskTriggersFromEvents(events.map((e) => e.event_type_code)),
      ...taskTriggersFromVisitTransition(beforeFields, afterFields),
    ])
    for (const trigger of triggers) {
      const key = `${bookingId}:${trigger}`
      if (taskTriggersDone.has(key)) continue
      taskTriggersDone.add(key)
      await completePortConnectTask(db, bookingId, trigger)
    }

    await logSync(db, {
      booking_id: bookingId,
      container_no: containerNo,
      container_visit_id: row.container_visit_id ?? null,
      status: "ok",
      http_status: 200,
      error: null,
      fields_changed: changed,
      events_written: containerEvents,
      ran_at: ranAt,
    })
  }

  if (Object.keys(bookingPatch).length) {
    await db.from("bookings").update(bookingPatch).eq("id", bookingId)
  }

  await db.from("booking_tracking").upsert({
    booking_id: bookingId,
    last_portconnect_sync: ranAt,
    portconnect_error: notRecognised.length
      ? `Not recognised: ${notRecognised.join(", ")}`
      : null,
  }, { onConflict: "booking_id" })

  return {
    ok: true,
    containers_found: containersFound,
    fields_changed: fieldsChanged,
    events_written: eventsWritten,
    containers_not_recognised: notRecognised,
    last_refreshed_at: ranAt,
  }
}
