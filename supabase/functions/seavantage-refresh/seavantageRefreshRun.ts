import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  extractSvRows, fetchPastTrack, registerCargo,
  type SvCreds, type SvResult, type TrackingEventRow, type VesselPositionRow,
} from "./seaVantageClient.ts"

export type SvRefreshSummary = {
  ok: boolean; skipped?: boolean; reason?: string; carrier?: string | null; sv_carrier_code?: string | null
  containers_registered: number; containers_found: number; events_written: number; positions_written: number
  containers_no_data: string[]; last_refreshed_at: string; error?: string; tracked_by?: string
}

type CarrierRoute = { line_code: string; sv_carrier_code: string | null; is_maersk: boolean; verified: boolean }

async function setStatus(db: SupabaseClient, bookingId: string, patch: Record<string, unknown>): Promise<void> {
  await db.from("booking_tracking").upsert({ booking_id: bookingId, ...patch }, { onConflict: "booking_id" })
}

async function svEventExists(db: SupabaseClient, bookingId: string, carrierEventId: string): Promise<boolean> {
  const { data } = await db.from("tracking_events").select("id")
    .eq("booking_id", bookingId).eq("carrier_event_id", carrierEventId).eq("source", "seavantage").maybeSingle()
  return Boolean(data)
}

async function insertEvents(db: SupabaseClient, bookingId: string, rows: TrackingEventRow[]): Promise<number> {
  let written = 0
  for (const row of rows) {
    if (row.carrier_event_id && await svEventExists(db, bookingId, row.carrier_event_id)) continue
    const { error } = await db.from("tracking_events").insert(row)
    if (error) {
      const m = String(error.message).toLowerCase()
      if (m.includes("duplicate") || m.includes("unique")) continue
      throw new Error(error.message)
    }
    written += 1
  }
  return written
}

async function insertPositions(db: SupabaseClient, rows: VesselPositionRow[]): Promise<number> {
  if (!rows.length) return 0
  const byKey = new Map<string, VesselPositionRow[]>()
  const noKey: VesselPositionRow[] = []
  for (const r of rows) {
    const key = r.imo ?? r.mmsi
    if (!key) { noKey.push(r); continue }
    const arr = byKey.get(key) ?? []
    arr.push(r); byKey.set(key, arr)
  }
  const toInsert: VesselPositionRow[] = [...noKey]
  for (const [key, group] of byKey) {
    const { data } = await db.from("vessel_positions").select("position_timestamp")
      .eq("vessel_key", key).order("position_timestamp", { ascending: false }).limit(1).maybeSingle()
    const latest = data?.position_timestamp ? new Date(data.position_timestamp as string).getTime() : 0
    const seen = new Set<string>()
    for (const r of group) {
      if (new Date(r.position_timestamp).getTime() <= latest) continue
      if (seen.has(r.position_timestamp)) continue
      seen.add(r.position_timestamp)
      toInsert.push(r)
    }
  }
  if (!toInsert.length) return 0
  const { error } = await db.from("vessel_positions").insert(toInsert)
  if (!error) return toInsert.length
  const m = String(error.message).toLowerCase()
  if (!(m.includes("duplicate") || m.includes("unique"))) throw new Error(error.message)
  let n = 0
  for (const r of toInsert) { const { error: e2 } = await db.from("vessel_positions").insert(r); if (!e2) n += 1 }
  return n
}

export async function refreshBookingSeaVantage(
  db: SupabaseClient, creds: SvCreds, bookingId: string,
): Promise<SvRefreshSummary> {
  const ranAt = new Date().toISOString()
  let registered = 0, found = 0, events = 0, positions = 0
  const noData: string[] = []
  let trackedBy = "container"

  const fail = (error: string): SvRefreshSummary => ({
    ok: false, containers_registered: registered, containers_found: found,
    events_written: events, positions_written: positions, containers_no_data: noData, last_refreshed_at: ranAt, error,
  })
  const skip = (reason: string, carrier?: string | null): SvRefreshSummary => ({
    ok: true, skipped: true, reason, carrier: carrier ?? null,
    containers_registered: 0, containers_found: 0, events_written: 0, positions_written: 0,
    containers_no_data: [], last_refreshed_at: ranAt,
  })

  const { data: tracking } = await db.from("booking_tracking")
    .select("seavantage_enabled, seavantage_mbl_document_id, seavantage_mbl_registered_at")
    .eq("booking_id", bookingId).maybeSingle()
  if (tracking && tracking.seavantage_enabled === false) return skip("SeaVantage tracking disabled for this booking")

  const { data: routeRows } = await db.rpc("resolve_booking_carrier", { p_booking_id: bookingId })
  const route = (Array.isArray(routeRows) ? routeRows[0] : routeRows) as CarrierRoute | null | undefined
  if (!route?.line_code) return fail("No carrier resolved for this booking — pick a shipping line, or the container prefix isn't recognised")
  const lineCode = String(route.line_code)
  if (route.is_maersk) return skip("Maersk group — tracked via the free Maersk API, not SeaVantage", lineCode)
  if (!route.verified || !route.sv_carrier_code) return fail(`SeaVantage code for "${lineCode}" is not verified yet`)
  const svCode = String(route.sv_carrier_code)

  const { data: booking } = await db.from("bookings").select("mbl_no").eq("id", bookingId).maybeSingle()
  const mblNo = String(booking?.mbl_no ?? "").trim().toUpperCase() || null

  const ingest = async (refValue: string, pt: SvResult<Record<string, unknown>>): Promise<boolean> => {
    if (!pt.ok || !pt.data) { noData.push(refValue); return false }
    const { events: evRows, positions: posRows } = extractSvRows(bookingId, refValue, svCode, pt.data)
    if (!evRows.length && !posRows.length) { noData.push(refValue); return false }
    found += 1
    events += await insertEvents(db, bookingId, evRows)
    positions += await insertPositions(db, posRows)
    return true
  }
  const authOrRate = (r: SvResult<unknown>): SvRefreshSummary | null => {
    if (r.status === 401 || r.status === 403) return fail(`SeaVantage auth failed (${r.status})`)
    if (r.status === 429) return fail("SeaVantage rate limit (429)")
    return null
  }

  if (mblNo) {
    trackedBy = "mbl"
    const mblDoc = (tracking?.seavantage_mbl_document_id as string | null) ?? null
    const mblRegAt = (tracking?.seavantage_mbl_registered_at as string | null) ?? null
    if (!mblDoc && !mblRegAt) {
      const reg = await registerCargo(creds, svCode, { mblNo })
      const hard = authOrRate(reg)
      if (hard) { await setStatus(db, bookingId, { last_seavantage_sync: ranAt, seavantage_error: hard.error }); return hard }
      if (reg.ok && reg.data?.documentId) {
        await setStatus(db, bookingId, { seavantage_mbl_document_id: reg.data.documentId, seavantage_mbl_registered_at: ranAt })
        registered += 1
      }
    }
    const pt = await fetchPastTrack(creds, { mblNo })
    const hard = authOrRate(pt)
    if (hard) { await setStatus(db, bookingId, { last_seavantage_sync: ranAt, seavantage_error: hard.error }); return hard }
    const hadData = await ingest(mblNo, pt)
    if (hadData && !mblDoc && !mblRegAt) await setStatus(db, bookingId, { seavantage_mbl_registered_at: ranAt })
  } else {
    const { data: containers } = await db.from("booking_containers")
      .select("id, container_no, seavantage_document_id, seavantage_registered_at")
      .eq("booking_id", bookingId).order("sort_order")
    const list = (containers ?? [])
      .map((c) => ({
        id: c.id as number,
        no: String(c.container_no ?? "").trim().toUpperCase(),
        doc: (c.seavantage_document_id as string | null) ?? null,
        regAt: (c.seavantage_registered_at as string | null) ?? null,
      }))
      .filter((c) => c.no)
    if (!list.length) return fail("No containers or MBL on this booking")

    for (const c of list) {
      if (!c.doc && !c.regAt) {
        const reg = await registerCargo(creds, svCode, { containerNo: c.no })
        const hard = authOrRate(reg)
        if (hard) { await setStatus(db, bookingId, { last_seavantage_sync: ranAt, seavantage_error: hard.error }); return hard }
        if (reg.ok && reg.data?.documentId) {
          await db.from("booking_containers")
            .update({ seavantage_document_id: reg.data.documentId, seavantage_registered_at: ranAt }).eq("id", c.id)
          registered += 1
          c.doc = reg.data.documentId
        }
      }
      const pt = await fetchPastTrack(creds, { containerNo: c.no })
      const hard = authOrRate(pt)
      if (hard) { await setStatus(db, bookingId, { last_seavantage_sync: ranAt, seavantage_error: hard.error }); return hard }
      const hadData = await ingest(c.no, pt)
      if (hadData && !c.doc && !c.regAt) {
        await db.from("booking_containers").update({ seavantage_registered_at: ranAt }).eq("id", c.id)
      }
    }
  }

  await setStatus(db, bookingId, {
    last_seavantage_sync: ranAt,
    seavantage_error: noData.length && !found ? `No SeaVantage data for: ${noData.join(", ")}` : null,
  })

  return {
    ok: true, carrier: lineCode, sv_carrier_code: svCode, tracked_by: trackedBy,
    containers_registered: registered, containers_found: found,
    events_written: events, positions_written: positions,
    containers_no_data: noData, last_refreshed_at: ranAt,
  }
}
