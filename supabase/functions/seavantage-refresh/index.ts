// STAFF — on-demand SeaVantage tracking refresh for one booking (non-Maersk carriers).
// Maersk stays on the free carrier-refresh function. Staff-gated, service-role writes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { cors, json, requireStaff } from "../_shared/portalCommon.ts"
import { readSeaVantageCreds } from "./seaVantageClient.ts"
import { refreshBookingSeaVantage } from "./seavantageRefreshRun.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)
  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response
    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : ""
    if (!bookingId) return json({ error: "booking_id is required" }, 400)
    const creds = readSeaVantageCreds()
    if (!creds) return json({ error: "SEAVANTAGE_USERNAME / SEAVANTAGE_PASSWORD not configured" }, 500)
    const summary = await refreshBookingSeaVantage(gate.db, creds, bookingId)
    if (!summary.ok) return json({ error: summary.error ?? "Refresh failed", ...summary }, 502)
    return json(summary)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
