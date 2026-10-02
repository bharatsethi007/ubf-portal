import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  carrierFromContainerPrefix,
  fetchMaerskEventsByContainer,
  fetchMaerskToken,
  mapMaerskEvent,
  type MaerskCreds,
} from "./maerskClient.ts"
import { readSeaVantageCreds } from "../seavantage-refresh/seaVantageClient.ts"
import { refreshBookingSeaVantage, type SvRefreshSummary } from "../seavantage-refresh/seavantageRefreshRun.ts"

export type CarrierRefreshSummary = {
  ok: boolean
  containers_found: number
  events_written: number
  containers_not_recognised: string[]
  matched_carrier: string | null
  last_refreshed_at: string
  error?: string
  fallback?: "seavantage"
  seavantage?: SvRefreshSummary
}

async function setCarrierStatus(db: SupabaseClient, bookingId: string, patch: Record<string, unknown>): Promise<void> {
  await db.from("booking_tracking").upsert({ booking_id: bookingId, ...patch }, { onConflict: "booking_id" })
}

async function carrierEventExistsById(db: SupabaseClient, bookingId: string, carrierEventId: string): Promise<boolean> {
  const { data } = await db.from("tracking_events").select("id")
    .eq("booking_id", bookingId).eq("carrier_event_id", carrierEventId).eq("source", "carrier").maybeSingle()
  return Boolean(data)
}

async function carrierEventExistsByComposite(
  db: SupabaseClient, bookingId: string, containerNo: string | null, eventTypeCode: string, eventDatetime: string,
): Promise<boolean> {
  let q = db.from("tracking_events").select("id")
    .eq("booking_id", bookingId).eq("event_type_code", eventTypeCode)
    .eq("event_datetime", eventDatetime).eq("source", "carrier")
  q = containerNo ? q.eq("container_no", containerNo) : q.is("container_no", null)
  const { data } = await q.maybeSingle()
  return Boolean(data)
}

async function runSeaVantageFallback(
  db: SupabaseClient, bookingId: string, base: CarrierRefreshSummary,
): Promise<CarrierRefreshSummary> {
  const svCreds = readSeaVantageCreds()
  if (!svCreds) return { ...base, fallback: "seavantage", error: "SeaVantage credentials not configured" }
  const sv = await refreshBookingSeaVantage(db, svCreds, bookingId)
  return { ...base, ok: sv.ok, fallback: "seavantage", seavantage: sv, ...(sv.ok ? {} : { error: sv.error }) }
}

export async function refreshBookingCarrier(
  db: SupabaseClient, creds: MaerskCreds, bookingId: string, opts: { token?: string } = {},
): Promise<CarrierRefreshSummary> {
  const ranAt = new Date().toISOString()
  const base = (): CarrierRefreshSummary => ({
    ok: true, containers_found: 0, events_written: 0, containers_not_recognised: [],
    matched_carrier: null, last_refreshed_at: ranAt,
  })
  const empty = (error: string): CarrierRefreshSummary => ({ ...base(), ok: false, error })

  const [{ data: settings }, { data: containers }] = await Promise.all([
    db.from("booking_tracking").select("carrier_enabled, carrier_fallback_sv").eq("booking_id", bookingId).maybeSingle(),
    db.from("booking_containers").select("container_no").eq("booking_id", bookingId).order("sort_order"),
  ])

  if (!settings?.carrier_enabled) return empty("Shipping line tracking is not enabled for this booking")
  if (settings.carrier_fallback_sv === true) return runSeaVantageFallback(db, bookingId, base())

  const containerNos = [...new Set(
    (containers ?? []).map((c) => String(c.container_no ?? "").trim().toUpperCase()).filter(Boolean),
  )]
  if (!containerNos.length) return empty("No containers on this booking")

  let token = opts.token
  if (!token) {
    try {
      token = await fetchMaerskToken(creds)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await setCarrierStatus(db, bookingId, { carrier_error: msg })
      return empty(msg)
    }
  }

  let containersFound = 0
  let eventsWritten = 0
  const notRecognised: string[] = []
  const noDataDetail: string[] = []
  const matchedCarriers = new Set<string>()

  const fail = (msg: string): CarrierRefreshSummary => ({
    ok: false, containers_found: containersFound, events_written: eventsWritten,
    containers_not_recognised: notRecognised, matched_carrier: matchedCarriers.values().next().value ?? null,
    last_refreshed_at: ranAt, error: msg,
  })

  for (const containerNo of containerNos) {
    const carrier = carrierFromContainerPrefix(containerNo)
    const result = await fetchMaerskEventsByContainer(creds, token, containerNo)

    if (result.status === 401 || result.status === 403) {
      const msg = result.message ?? `Maersk auth failed (${result.status})`
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return fail(msg)
    }
    if (result.status === 429) {
      const msg = result.message ?? "Maersk rate limit exceeded (429)"
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return fail(msg)
    }
    if (result.status === 404 || result.events.length === 0) {
      notRecognised.push(containerNo)
      noDataDetail.push(`${containerNo} (${result.status === 404 ? "404" : "empty"})`)
      continue
    }
    if (result.status >= 400) {
      const msg = result.message ?? `Maersk error (${result.status})`
      await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: msg })
      return fail(msg)
    }

    containersFound += 1
    matchedCarriers.add(carrier.name)

    for (const ev of result.events) {
      const row = mapMaerskEvent(bookingId, containerNo, carrier.scac, ev)
      if (!row) continue
      const dup = row.carrier_event_id
        ? await carrierEventExistsById(db, bookingId, row.carrier_event_id)
        : await carrierEventExistsByComposite(db, bookingId, row.container_no, row.event_type_code, row.event_datetime)
      if (dup) continue
      const { error } = await db.from("tracking_events").insert(row)
      if (error) {
        const m = String(error.message).toLowerCase()
        if (m.includes("duplicate") || m.includes("unique")) continue
        throw new Error(error.message)
      }
      eventsWritten += 1
    }
  }

  const summary: CarrierRefreshSummary = {
    ok: true, containers_found: containersFound, events_written: eventsWritten,
    containers_not_recognised: notRecognised, matched_carrier: matchedCarriers.values().next().value ?? null,
    last_refreshed_at: ranAt,
  }

  if (notRecognised.length && !containersFound) {
    const reason = `No Maersk events for: ${noDataDetail.join(", ")}`
    await setCarrierStatus(db, bookingId, {
      last_carrier_sync: ranAt,
      carrier_error: `${reason}. Switched to SeaVantage.`,
      carrier_fallback_sv: true,
      carrier_fallback_at: ranAt,
      carrier_fallback_reason: reason,
    })
    return runSeaVantageFallback(db, bookingId, summary)
  }

  await setCarrierStatus(db, bookingId, { last_carrier_sync: ranAt, carrier_error: null })
  return summary
}
