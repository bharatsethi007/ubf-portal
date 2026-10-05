// Background freshness for public viewers. Throttled per booking so page views can't run up API costs.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { refreshBookingPortConnect } from "../_shared/portconnectRefreshRun.ts"
import { readSeaVantageCreds } from "../seavantage-refresh/seaVantageClient.ts"
import { refreshBookingSeaVantage } from "../seavantage-refresh/seavantageRefreshRun.ts"
import type { TrackStatus } from "./types.ts"

const HOUR = 3600_000
const SV_EVERY = 3 * HOUR
const PC_EVERY = 2 * HOUR
const LOCK = 20 * 60_000

const older = (iso: string | null | undefined, ms: number) => !iso || Date.now() - new Date(iso).getTime() > ms

export async function refreshIfStale(
  db: SupabaseClient, linkId: string, bookingId: string, status: TrackStatus, etaIso: string | null,
): Promise<void> {
  if (status === "delivered") return
  const { data: bt } = await db.from("booking_tracking")
    .select("seavantage_enabled,portconnect_enabled,last_seavantage_sync,last_portconnect_sync,seavantage_mbl_registered_at,carrier_fallback_sv")
    .eq("booking_id", bookingId).maybeSingle()

  // SeaVantage registration is billable: public views only refresh cargo staff already registered
  // (MBL registered when the booking has an MBL, else every container registered).
  const { data: bk } = await db.from("bookings").select("mbl_no").eq("id", bookingId).maybeSingle()
  let svRegistered = false
  // Maersk fallback bookings register per container, never by MBL.
  if (String(bk?.mbl_no ?? "").trim() && bt?.carrier_fallback_sv !== true) {
    svRegistered = Boolean(bt?.seavantage_mbl_registered_at)
  } else {
    const { data: boxes } = await db.from("booking_containers").select("seavantage_registered_at,seavantage_document_id").eq("booking_id", bookingId)
    svRegistered = Boolean(boxes?.length) && (boxes ?? []).every((b) => b.seavantage_registered_at || b.seavantage_document_id)
  }

  const daysToEta = etaIso ? (new Date(etaIso).getTime() - Date.now()) / (24 * HOUR) : null
  const wantSv = svRegistered && (status === "booked" || status === "sailing") && bt?.seavantage_enabled !== false && older(bt?.last_seavantage_sync, SV_EVERY)
  const nearPort = status !== "booked" && (status !== "sailing" || (daysToEta !== null && daysToEta < 4))
  const wantPc = nearPort && bt?.portconnect_enabled === true && older(bt?.last_portconnect_sync, PC_EVERY)
  if (!wantSv && !wantPc) return

  // Single-flight lock across all links for this booking.
  const cutoff = new Date(Date.now() - LOCK).toISOString()
  const { data: got } = await db.from("booking_share_links").update({ refresh_started_at: new Date().toISOString() })
    .eq("id", linkId).or(`refresh_started_at.is.null,refresh_started_at.lt.${cutoff}`).select("id")
  if (!got?.length) return
  const { data: busy } = await db.from("booking_share_links").select("id")
    .eq("booking_id", bookingId).neq("id", linkId).gt("refresh_started_at", cutoff).limit(1)
  if (busy?.length) return

  if (wantSv) {
    const creds = readSeaVantageCreds()
    if (creds) {
      try {
        const r = await refreshBookingSeaVantage(db, creds, bookingId)
        await db.from("booking_tracking").upsert({ booking_id: bookingId, last_seavantage_sync: r.last_refreshed_at }, { onConflict: "booking_id" })
      } catch (e) { console.error("sv refresh", String(e)) }
    }
  }
  if (wantPc) {
    const key = Deno.env.get("PORTCONNECT_API_KEY") ?? ""
    if (key) {
      try { await refreshBookingPortConnect(db, key, bookingId) } catch (e) { console.error("pc refresh", String(e)) }
    }
  }
}
