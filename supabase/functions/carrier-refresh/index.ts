// STAFF — on-demand Maersk (shipping-line) carrier tracking refresh for a booking.
// Mirrors portconnect-refresh: staff-gated, service-role writes, summary response.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { cors, json, requireStaff } from "../_shared/portalCommon.ts"
import { readMaerskCreds } from "../_shared/maerskClient.ts"
import { refreshBookingCarrier } from "../_shared/carrierRefreshRun.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : ""
    if (!bookingId) return json({ error: "booking_id is required" }, 400)

    const creds = readMaerskCreds()
    if (!creds) {
      return json({ error: "MAERSK_CONSUMER_KEY / MAERSK_CONSUMER_SECRET not configured" }, 500)
    }

    const summary = await refreshBookingCarrier(gate.db, creds, bookingId)
    if (!summary.ok) return json({ error: summary.error ?? "Refresh failed", ...summary }, 502)
    return json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
